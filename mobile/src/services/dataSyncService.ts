import { API_BASE_URL } from '../config/api';
import offlineDatabase, { CachedAppointment, CachedInsight } from './offlineDatabase';
import authService from './authService';
import networkStatusService from './networkStatusService';

/**
 * DataSyncService - Handles syncing patient and staff data between mobile app and server
 *
 * For Patients:
 * - Syncs personal appointments, insights, and screening history
 * - Tracks pending vitals submissions
 * - Safe locally filtered operations when offline
 *
 * For Frontline Staff:
 * - Syncs assigned patient list with morning sync
 * - Caches patient profiles and mini-history
 * - Uploads vitals and screening data
 */
class DataSyncService {
  private isSyncing: boolean = false;

  /**
   * Sync patient appointments (requires online)
   */
  async syncPatientAppointments(patientId: string, token: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/appointments?patient_id=${patientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch appointments');

      const appointments = await response.json();
      if (Array.isArray(appointments)) {
        const cachedAppointments: CachedAppointment[] = appointments.map((appt: any) => ({
          appointment_id: appt.appointment_id || appt.id,
          patient_id: patientId,
          title: appt.title || 'Appointment',
          description: appt.description,
          scheduled_for: appt.scheduled_for,
          appointment_type: appt.appointment_type,
          status: appt.status || 'scheduled',
          created_at: appt.created_at,
          updated_at: appt.updated_at,
        }));

        await offlineDatabase.cacheAppointments(cachedAppointments);
      }
    } catch (error) {
      console.error('Failed to sync appointments:', error);
    }
  }

  /**
   * Sync patient insights (requires online)
   */
  async syncPatientInsights(patientId: string, token: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/insights?patient_id=${patientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch insights');

      const insights = await response.json();
      if (Array.isArray(insights)) {
        const cachedInsights: CachedInsight[] = insights.map((insight: any) => ({
          insight_id: insight.insight_id || insight.id,
          patient_id: patientId,
          title: insight.title,
          content: insight.content,
          insight_type: insight.insight_type,
          created_at: insight.created_at,
          updated_at: insight.updated_at,
        }));

        await offlineDatabase.cacheInsights(cachedInsights);
      }
    } catch (error) {
      console.error('Failed to sync insights:', error);
    }
  }

  /**
   * Sync patient screening history (requires online)
   */
  async syncPatientScreeningHistory(patientId: string, token: string, limit: number = 50): Promise<void> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/screening/history?patient_id=${patientId}&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch screening history');

      const screenings = await response.json();
      if (Array.isArray(screenings)) {
        const cachedScreenings = screenings.map((screening: any) => ({
          screening_id: screening.screening_id || screening.id,
          patient_id: patientId,
          vitals_json: JSON.stringify(screening.vitals || screening),
          risk_level: screening.risk_level || 'low',
          risk_score: screening.risk_score || 0,
          recommendations: JSON.stringify(screening.recommendations || []),
          created_at: screening.created_at,
          updated_at: screening.updated_at,
        }));

        await offlineDatabase.cacheScreenings(cachedScreenings);
      }
    } catch (error) {
      console.error('Failed to sync screening history:', error);
    }
  }

  /**
   * Full sync for patient: appointments + insights + screening history
   */
  async syncPatientData(patientId: string): Promise<{ success: boolean; itemsSynced: number }> {
    if (!networkStatusService.getStatus()) {
      return { success: false, itemsSynced: 0 };
    }

    const token = await authService.getStoredToken();
    if (!token) return { success: false, itemsSynced: 0 };

    const startTime = Date.now();
    let itemsSynced = 0;

    try {
      await this.syncPatientAppointments(patientId, token);
      await this.syncPatientInsights(patientId, token);
      await this.syncPatientScreeningHistory(patientId, token);
      itemsSynced = 3; // 3 data types synced

      const duration = Date.now() - startTime;
      await offlineDatabase.logSync(patientId, 'patient_full_sync', itemsSynced, duration);

      return { success: true, itemsSynced };
    } catch (error) {
      console.error('Patient data sync failed:', error);
      return { success: false, itemsSynced: 0 };
    }
  }

  /**
   * Sync assigned patients for frontline staff (morning sync)
   */
  async syncAssignedPatients(staffId: string, token: string): Promise<void> {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const response = await fetch(
        `${API_BASE_URL}/patients/assigned?midwife_id=${staffId}&date=${today}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error('Failed to fetch assigned patients');

      const patients = await response.json();
      if (Array.isArray(patients)) {
        await offlineDatabase.cachePatientProfiles(patients);

        // Also sync screening history for each patient
        for (const patient of patients) {
          try {
            await this.syncPatientScreeningHistory(patient.patient_id || patient.id, token, 10);
          } catch (error) {
            console.error(`Failed to sync history for patient ${patient.patient_id}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to sync assigned patients:', error);
    }
  }

  /**
   * Upload pending vitals (frontline staff)
   */
  async uploadPendingVitals(): Promise<{ synced: number; failed: number }> {
    if (!networkStatusService.getStatus()) {
      return { synced: 0, failed: 0 };
    }

    const token = await authService.getStoredToken();
    if (!token) return { synced: 0, failed: 0 };

    const pendingSyncs = await offlineDatabase.getPendingSyncs();
    let synced = 0;
    let failed = 0;

    for (const sync of pendingSyncs) {
      try {
        const payload = JSON.parse(sync.payload_json);

        if (sync.entity_type === 'screening') {
          const response = await fetch(`${API_BASE_URL}/screening`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            await offlineDatabase.markSyncSuccess(sync.record_id);
            synced++;
          } else {
            await offlineDatabase.markSyncFailed(sync.record_id);
            failed++;
          }
        } else if (sync.entity_type === 'vitals') {
          const response = await fetch(`${API_BASE_URL}/vitals`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            await offlineDatabase.markSyncSuccess(sync.record_id);
            synced++;
          } else {
            await offlineDatabase.markSyncFailed(sync.record_id);
            failed++;
          }
        }
      } catch (error) {
        console.error(`Failed to upload sync ${sync.record_id}:`, error);
        failed++;
      }
    }

    return { synced, failed };
  }

  /**
   * Background sync with retry logic
   */
  async backgroundSync(patientId?: string): Promise<{ success: boolean; message: string }> {
    if (this.isSyncing) {
      return { success: false, message: 'Sync already in progress' };
    }

    if (!networkStatusService.getStatus()) {
      return { success: false, message: 'No internet connection' };
    }

    this.isSyncing = true;

    try {
      const user = authService.getUser();
      if (!user) {
        return { success: false, message: 'Not authenticated' };
      }

      if (user.role === 'patient' && patientId) {
        await this.syncPatientData(patientId);
        return { success: true, message: 'Patient data synced' };
      } else if (user.role === 'frontline_staff') {
        const token = await authService.getStoredToken();
        if (token) {
          await this.syncAssignedPatients(user.id, token);
          const uploadResult = await this.uploadPendingVitals();
          return {
            success: true,
            message: `Synced assigned patients. Uploaded ${uploadResult.synced} vitals`,
          };
        }
      }

      return { success: true, message: 'Sync completed' };
    } catch (error) {
      console.error('Background sync error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Add pending operation for later sync
   */
  async addPendingOperation(
    entityType: string,
    operation: string,
    patientId: string | null,
    payload: any
  ): Promise<string> {
    return await offlineDatabase.addPendingSync(entityType, operation, patientId, payload);
  }

  /**
   * Get sync status
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }
}

const dataSyncService = new DataSyncService();
export default dataSyncService;
