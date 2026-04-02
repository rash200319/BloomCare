import offlineDatabase from './offlineDatabase';
import dataSyncService from './dataSyncService';
import networkStatusService from './networkStatusService';
import authService from './authService';
import { API_BASE_URL } from '../config/api';

/**
 * FrontlineStaffOperationsService
 * Handles patient management and vitals submission for frontline staff
 * - Downloads assigned patient list on morning sync
 * - Allows offline patient search and screening
 * - Queues vitals for upload when online
 */
class FrontlineStaffOperationsService {
  /**
   * Morning sync: download assigned patients and their recent history
   */
  async performMorningSync(staffId: string): Promise<{ success: boolean; patientCount: number }> {
    if (!networkStatusService.getStatus()) {
      return { success: false, patientCount: 0 };
    }

    const token = await authService.getStoredToken();
    if (!token) {
      return { success: false, patientCount: 0 };
    }

    try {
      await dataSyncService.syncAssignedPatients(staffId, token);

      const allPatients = await offlineDatabase.getAllPatientProfiles();
      return { success: true, patientCount: allPatients.length };
    } catch (error) {
      console.error('Morning sync failed:', error);
      return { success: false, patientCount: 0 };
    }
  }

  /**
   * Get all assigned patients (from cache)
   */
  async getAssignedPatients(): Promise<any[]> {
    return await offlineDatabase.getAllPatientProfiles();
  }

  /**
   * Search patients by name, NIC, or contact
   */
  async searchPatients(query: string): Promise<any[]> {
    if (!query.trim()) {
      return await this.getAssignedPatients();
    }

    return await offlineDatabase.searchPatients(query);
  }

  /**
   * Get patient details
   */
  async getPatientDetails(patientId: string): Promise<any | null> {
    return await offlineDatabase.getPatientProfile(patientId);
  }

  /**
   * Get patient screening history
   */
  async getPatientScreeningHistory(patientId: string): Promise<any[]> {
    try {
      // Try to sync if online
      if (networkStatusService.getStatus()) {
        const token = await authService.getStoredToken();
        if (token) {
          await dataSyncService.syncPatientScreeningHistory(patientId, token, 20);
        }
      }

      return await offlineDatabase.getScreeningHistory(patientId, 20);
    } catch (error) {
      console.error('Failed to get screening history:', error);
      return await offlineDatabase.getScreeningHistory(patientId, 20);
    }
  }

  /**
   * Submit vitals for patient
   * Works offline - queues for upload
   */
  async submitPatientVitals(patientId: string, vitals: any): Promise<{ recordId: string; queued: boolean }> {
    const recordId = `vitals-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      // Add to pending operations
      await offlineDatabase.addPendingSync('vitals', 'create', patientId, {
        patient_id: patientId,
        vitals: vitals,
        recorded_by_staff: authService.getUser()?.id,
        recorded_at: new Date().toISOString(),
      });

      // Try immediate upload if online
      const isOnline = networkStatusService.getStatus();
      if (isOnline) {
        const token = await authService.getStoredToken();
        if (token) {
          try {
            const response = await fetch(`${API_BASE_URL}/patients/${patientId}/vitals`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                vitals,
                recorded_at: new Date().toISOString(),
              }),
            });

            if (response.ok) {
              await offlineDatabase.markSyncSuccess(recordId);
              return { recordId, queued: false };
            }
          } catch (error) {
            console.error('Immediate vitals upload failed, queuing for later:', error);
          }
        }
      }

      return { recordId, queued: true };
    } catch (error) {
      console.error('Failed to submit vitals:', error);
      throw error;
    }
  }

  /**
   * Create new patient screening
   * Works offline - queues for upload
   */
  async createPatientScreening(
    patientId: string,
    vitals: any,
    riskLevel: string,
    riskScore: number,
    recommendations: string[]
  ): Promise<{ recordId: string; queued: boolean }> {
    const recordId = `screening-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      // Add to pending operations
      await offlineDatabase.addPendingSync('screening', 'create', patientId, {
        patient_id: patientId,
        vitals,
        risk_level: riskLevel,
        risk_score: riskScore,
        recommendations,
        created_by: authService.getUser()?.id,
        created_at: new Date().toISOString(),
      });

      // Try immediate upload if online
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
              body: JSON.stringify({
                patient_id: patientId,
                vitals,
                risk_level: riskLevel,
                risk_score: riskScore,
                recommendations,
              }),
            });

            if (response.ok) {
              // Cache the screening locally
              const responseData = await response.json();
              await offlineDatabase.cacheScreening({
                screening_id: responseData.id || recordId,
                patient_id: patientId,
                vitals_json: JSON.stringify(vitals),
                risk_level: riskLevel,
                risk_score: riskScore,
                recommendations: JSON.stringify(recommendations),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

              await offlineDatabase.markSyncSuccess(recordId);
              return { recordId, queued: false };
            }
          } catch (error) {
            console.error('Immediate screening upload failed, queuing for later:', error);
          }
        }
      }

      return { recordId, queued: true };
    } catch (error) {
      console.error('Failed to create screening:', error);
      throw error;
    }
  }

  /**
   * Sync pending operations (vitals, screenings)
   */
  async syncPendingOperations(): Promise<{ synced: number; failed: number }> {
    if (!networkStatusService.getStatus()) {
      return { synced: 0, failed: 0 };
    }

    return await dataSyncService.uploadPendingVitals();
  }

  /**
   * Get pending operation count
   */
  async getPendingOperationCount(): Promise<number> {
    const pending = await offlineDatabase.getPendingSyncs();
    return pending.length;
  }

  /**
   * Get offline status for patient list
   */
  async hasOfflinePatients(): Promise<boolean> {
    const patients = await offlineDatabase.getAllPatientProfiles();
    return patients.length > 0;
  }
}

const frontlineStaffOperationsService = new FrontlineStaffOperationsService();
export default frontlineStaffOperationsService;
