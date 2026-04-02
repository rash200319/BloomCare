import offlineDatabase, { CachedAppointment, CachedInsight, CachedScreening } from './offlineDatabase';
import dataSyncService from './dataSyncService';
import networkStatusService from './networkStatusService';
import authService from './authService';
import { API_BASE_URL } from '../config/api';

/**
 * PatientOperationsService
 * Provides offline-first operations for patient data
 * - Reads from local cache first
 * - Syncs with server when online
 */
class PatientOperationsService {
  /**
   * Get patient appointments (offline + online)
   */
  async getAppointments(patientId: string): Promise<CachedAppointment[]> {
    try {
      // Check if online and attempt sync
      if (networkStatusService.getStatus() && authService.getToken()) {
        await dataSyncService.syncPatientAppointments(patientId, authService.getToken()!);
      }

      // Return from local cache
      return await offlineDatabase.getAppointmentsForPatient(patientId);
    } catch (error) {
      console.error('Failed to get appointments:', error);
      // Still return from cache even if sync failed
      return await offlineDatabase.getAppointmentsForPatient(patientId);
    }
  }

  /**
   * Get upcoming appointments (offline + online)
   */
  async getUpcomingAppointments(patientId: string): Promise<CachedAppointment[]> {
    try {
      // Check if online and attempt sync
      if (networkStatusService.getStatus() && authService.getToken()) {
        await dataSyncService.syncPatientAppointments(patientId, authService.getToken()!);
      }

      // Return from local cache
      return await offlineDatabase.getUpcomingAppointments(patientId);
    } catch (error) {
      console.error('Failed to get upcoming appointments:', error);
      return await offlineDatabase.getUpcomingAppointments(patientId);
    }
  }

  /**
   * Get patient insights (offline + online)
   */
  async getInsights(patientId: string): Promise<CachedInsight[]> {
    try {
      // Check if online and attempt sync
      if (networkStatusService.getStatus() && authService.getToken()) {
        await dataSyncService.syncPatientInsights(patientId, authService.getToken()!);
      }

      // Return from local cache
      return await offlineDatabase.getInsightsForPatient(patientId);
    } catch (error) {
      console.error('Failed to get insights:', error);
      return await offlineDatabase.getInsightsForPatient(patientId);
    }
  }

  /**
   * Get screening history (offline + online)
   */
  async getScreeningHistory(patientId: string, limit?: number): Promise<CachedScreening[]> {
    try {
      // Check if online and attempt sync
      if (networkStatusService.getStatus() && authService.getToken()) {
        await dataSyncService.syncPatientScreeningHistory(patientId, authService.getToken()!, limit || 50);
      }

      // Return from local cache
      return await offlineDatabase.getScreeningHistory(patientId, limit);
    } catch (error) {
      console.error('Failed to get screening history:', error);
      return await offlineDatabase.getScreeningHistory(patientId, limit);
    }
  }

  /**
   * Get latest screening
   */
  async getLatestScreening(patientId: string): Promise<CachedScreening | null> {
    try {
      // Check if online and attempt sync latest
      if (networkStatusService.getStatus() && authService.getToken()) {
        await dataSyncService.syncPatientScreeningHistory(patientId, authService.getToken()!, 1);
      }

      return await offlineDatabase.getLatestScreening(patientId);
    } catch (error) {
      console.error('Failed to get latest screening:', error);
      return await offlineDatabase.getLatestScreening(patientId);
    }
  }

  /**
   * Record new vital signs with offline support
   * Returns immediately, syncs in background when online
   */
  async recordVitals(patientId: string, vitals: any): Promise<{ recordId: string; synced: boolean }> {
    const recordId = `screening-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    try {
      // Save to pending sync queue
      await offlineDatabase.addPendingSync('screening', 'create', patientId, {
        patient_id: patientId,
        vitals: vitals,
        recorded_at: now,
      });

      // Try to sync immediately if online
      const isOnline = networkStatusService.getStatus();
      if (isOnline) {
        const token = await authService.getStoredToken();
        if (token) {
          try {
            const response = await fetch(`${API_BASE_URL}/screening`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ patient_id: patientId, vitals, recorded_at: now }),
            });

            if (response.ok) {
              await offlineDatabase.markSyncSuccess(recordId);
              return { recordId, synced: true };
            }
          } catch (error) {
            console.error('Failed to sync vitals:', error);
          }
        }
      }

      // Return with sync=false - will sync later
      return { recordId, synced: false };
    } catch (error) {
      console.error('Failed to record vitals:', error);
      throw error;
    }
  }

  /**
   * Sync all pending patient operations
   */
  async syncPending(): Promise<{ synced: number; pending: number }> {
    if (!networkStatusService.getStatus()) {
      return { synced: 0, pending: 0 };
    }

    const result = await dataSyncService.uploadPendingVitals();
    const remaining = await offlineDatabase.getPendingSyncs();

    return { synced: result.synced, pending: remaining.length };
  }

  /**
   * Check if patient data is available offline
   */
  async hasOfflineData(patientId: string): Promise<boolean> {
    try {
      const profile = await offlineDatabase.getPatientProfile(patientId);
      return !!profile;
    } catch (error) {
      return false;
    }
  }
}

const patientOperationsService = new PatientOperationsService();
export default patientOperationsService;
