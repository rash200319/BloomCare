import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from './authService';

/**
 * BackgroundSync Service
 * 
 * Purpose: Automatically sync local data to server when internet becomes available
 * This enables the "Register Once, Sync Many" workflow:
 * - User stores encrypted JWT token in SecureStore
 * - When offline, all screening records stored locally
 * - When internet returns, token is used to authenticate and upload all pending data
 */

interface PendingRecord {
  id: string;
  patientName: string;
  vitals: any;
  riskScore: number;
  riskLevel: string;
  recommendations: string[];
  timestamp: number;
}

const API_BASE_URL = 'http://192.168.56.1:8000/api/v1';
const PENDING_RECORDS_KEY = 'bloomcare_pending_records';

class BackgroundSyncService {
  private syncInProgress = false;
  private syncCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Start monitoring for connectivity and syncing when available
   * Call this in your app's main component (e.g., App.tsx)
   */
  startMonitoring(): void {
    // Check for pending syncs every 30 seconds when app is active
    this.syncCheckInterval = setInterval(() => {
      this.attemptSync();
    }, 30000);

    // Try sync immediately
    this.attemptSync();
  }

  /**
   * Stop monitoring for connectivity changes
   * Call this when app is closing
   */
  stopMonitoring(): void {
    if (this.syncCheckInterval) {
      clearInterval(this.syncCheckInterval);
      this.syncCheckInterval = null;
    }
  }

  /**
   * Add a screening record to the pending queue
   * Records are stored locally and synced to server when online
   */
  async queueScreeningRecord(
    patientName: string,
    vitals: any,
    riskScore: number,
    riskLevel: string,
    recommendations: string[]
  ): Promise<void> {
    try {
      const token = authService.getToken();
      if (token) {
        // If online, try to sync immediately
        try {
          await this.syncScreeningRecord(
            patientName,
            vitals,
            riskScore,
            riskLevel,
            recommendations,
            token
          );
          console.log('Record synced immediately');
          return;
        } catch (error) {
          console.log('Sync failed, queuing for later');
          // Fall through to queue it
        }
      }

      // Queue record for later sync
      const record: PendingRecord = {
        id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        patientName,
        vitals,
        riskScore,
        riskLevel,
        recommendations,
        timestamp: Date.now(),
      };

      const pending = await this.getPendingRecords();
      pending.push(record);
      await AsyncStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify(pending));

      console.log(`Record queued for sync. Pending: ${pending.length}`);
    } catch (error) {
      console.error('Failed to queue record:', error);
      throw error;
    }
  }

  /**
   * Attempt to sync all pending records to server
   * Uses stored token from SecureStore for authentication
   */
  private async attemptSync(): Promise<void> {
    if (this.syncInProgress) return;

    const token = await authService.getStoredToken();
    if (!token) {
      console.log('No stored token, cannot sync');
      return;
    }

    this.syncInProgress = true;

    try {
      const pending = await this.getPendingRecords();
      if (pending.length === 0) {
        console.log('No pending records to sync');
        return;
      }

      console.log(`Starting sync of ${pending.length} pending records...`);

      let successCount = 0;
      let failedRecords: PendingRecord[] = [];

      for (const record of pending) {
        try {
          await this.syncScreeningRecord(
            record.patientName,
            record.vitals,
            record.riskScore,
            record.riskLevel,
            record.recommendations,
            token
          );
          successCount++;
        } catch (error) {
          console.error(`Failed to sync record ${record.id}:`, error);
          failedRecords.push(record);
        }
      }

      // Update pending records to only failed ones
      await AsyncStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify(failedRecords));

      console.log(`Sync complete: ${successCount} synced, ${failedRecords.length} still pending`);
    } catch (error) {
      console.error('Sync attempt failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync a single screening record to backend
   */
  private async syncScreeningRecord(
    patientName: string,
    vitals: any,
    riskScore: number,
    riskLevel: string,
    recommendations: string[],
    token: string
  ): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/screening/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        patient_name: patientName,
        vitals,
        risk_score: riskScore,
        risk_level: riskLevel,
        recommendations,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync failed with status ${response.status}`);
    }

    console.log(`Synced record for ${patientName}`);
  }

  /**
   * Get all pending records from local storage
   */
  private async getPendingRecords(): Promise<PendingRecord[]> {
    try {
      const data = await AsyncStorage.getItem(PENDING_RECORDS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get pending records:', error);
      return [];
    }
  }

  /**
   * Get count of pending records
   */
  async getPendingCount(): Promise<number> {
    const pending = await this.getPendingRecords();
    return pending.length;
  }

  /**
   * Force immediate sync (useful for user-triggered sync button)
   */
  async forceSync(): Promise<{ synced: number; failed: number }> {
    const token = await authService.getStoredToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const pending = await this.getPendingRecords();
    if (pending.length === 0) {
      return { synced: 0, failed: 0 };
    }

    let successCount = 0;
    let failedRecords: PendingRecord[] = [];

    for (const record of pending) {
      try {
        await this.syncScreeningRecord(
          record.patientName,
          record.vitals,
          record.riskScore,
          record.riskLevel,
          record.recommendations,
          token
        );
        successCount++;
      } catch (error) {
        failedRecords.push(record);
      }
    }

    await AsyncStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify(failedRecords));

    return {
      synced: successCount,
      failed: failedRecords.length,
    };
  }

  /**
   * Clear all pending records (use with caution)
   */
  async clearPending(): Promise<void> {
    await AsyncStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify([]));
    console.log('Pending records cleared');
  }
}

export default new BackgroundSyncService();
