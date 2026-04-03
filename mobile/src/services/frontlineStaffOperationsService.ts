import offlineDatabase from './offlineDatabase';
import dataSyncService from './dataSyncService';
import networkStatusService from './networkStatusService';
import authService from './authService';
import { API_BASE_URL } from '../config/api';
import { syncDirtyVitalsUpdates } from './syncService';

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
    const fallbackId = `vitals-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      // Add to pending operations
      const recordId = await offlineDatabase.addPendingSync('vitals', 'create', patientId, {
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
            const response = await fetch(`${API_BASE_URL}/triage/sync`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                items: [
                  {
                    patient_id: patientId,
                    encounter_id: `mobile-${Date.now()}`,
                    gestational_age_weeks: Number(vitals?.gestational_age_weeks ?? 20),
                    collected_at: new Date().toISOString(),
                    age: Number(vitals?.age ?? 28),
                    blood_pressure: {
                      systolic: Number(vitals?.systolic ?? 120),
                      diastolic: Number(vitals?.diastolic ?? 80),
                    },
                    bmi: Number(vitals?.bmi ?? 24.5),
                    heart_rate: Number(vitals?.heart_rate ?? 78),
                    temperature: Number(vitals?.temperature ?? 36.8),
                    blood_sugar: Number(vitals?.bs ?? vitals?.blood_sugar ?? 95),
                    hemoglobin: Number(vitals?.hemoglobin ?? 12),
                    pcos: Boolean(Number(vitals?.pcos ?? 0)),
                    previous_complications: Boolean(Number(vitals?.previous_complications ?? 0)),
                    preexisting_diabetes: Boolean(Number(vitals?.preexisting_diabetes ?? 0)),
                    mental_health: Number(vitals?.mental_health ?? 3),
                    sleep_pattern: Number(vitals?.sleep_pattern ?? 7),
                    exercise: Number(vitals?.exercise ?? 3),
                    education: Number(vitals?.education ?? 4),
                    edge_risk_classification: Number(vitals?.map ?? 0) >= 95 ? 'escalate' : 'routine_care',
                    edge_risk_score: 0.5,
                    device_id: 'mobile-offline',
                  },
                ],
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

    return { recordId: fallbackId, queued: true };
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
    const fallbackId = `screening-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      // Add to pending operations
      const recordId = await offlineDatabase.addPendingSync('screening', 'create', patientId, {
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
            const response = await fetch(`${API_BASE_URL}/triage/sync`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                items: [
                  {
                    patient_id: patientId,
                    encounter_id: `mobile-${Date.now()}`,
                    gestational_age_weeks: Number(vitals?.gestational_age_weeks ?? 20),
                    collected_at: new Date().toISOString(),
                    age: Number(vitals?.age ?? 28),
                    blood_pressure: {
                      systolic: Number(vitals?.systolic ?? 120),
                      diastolic: Number(vitals?.diastolic ?? 80),
                    },
                    bmi: Number(vitals?.bmi ?? 24.5),
                    heart_rate: Number(vitals?.heart_rate ?? 78),
                    temperature: Number(vitals?.temperature ?? 36.8),
                    blood_sugar: Number(vitals?.bs ?? vitals?.blood_sugar ?? 95),
                    hemoglobin: Number(vitals?.hemoglobin ?? 12),
                    pcos: Boolean(Number(vitals?.pcos ?? 0)),
                    previous_complications: Boolean(Number(vitals?.previous_complications ?? 0)),
                    preexisting_diabetes: Boolean(Number(vitals?.preexisting_diabetes ?? 0)),
                    mental_health: Number(vitals?.mental_health ?? 3),
                    sleep_pattern: Number(vitals?.sleep_pattern ?? 7),
                    exercise: Number(vitals?.exercise ?? 3),
                    education: Number(vitals?.education ?? 4),
                    edge_risk_classification:
                      String(riskLevel).toLowerCase() === 'high' || Number(riskScore) >= 0.7
                        ? 'escalate'
                        : 'routine_care',
                    edge_risk_score: Math.max(0, Math.min(1, Number(riskScore) || 0.5)),
                    device_id: 'mobile-offline',
                  },
                ],
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

    return { recordId: fallbackId, queued: true };
  }

  /**
   * Sync pending operations (vitals, screenings)
   */
  async syncPendingOperations(): Promise<{ synced: number; failed: number }> {
    if (!networkStatusService.getStatus()) {
      return { synced: 0, failed: 0 };
    }

    const [pendingSyncResult, dirtySyncResult] = await Promise.all([
      dataSyncService.uploadPendingVitals(),
      syncDirtyVitalsUpdates(),
    ]);

    return {
      synced: pendingSyncResult.synced + dirtySyncResult.synced,
      failed: pendingSyncResult.failed + dirtySyncResult.pending,
    };
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
