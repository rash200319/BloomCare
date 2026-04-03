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

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private buildTriageItem(payload: any): any | null {
    const vitals = payload?.vitals ?? payload;
    const patientId = String(payload?.patient_id ?? vitals?.patient_id ?? '').trim();
    if (!patientId) {
      return null;
    }

    const systolic = this.clamp(Number(vitals?.systolic ?? 120), 60, 220);
    const diastolic = this.clamp(
      Math.min(Number(vitals?.diastolic ?? 80), systolic - 1),
      40,
      140
    );
    const riskScoreRaw = Number(payload?.risk_score ?? payload?.riskScore ?? 0.5);
    const riskScore = Number.isFinite(riskScoreRaw) ? Math.max(0, Math.min(1, riskScoreRaw)) : 0.5;
    const riskLevel = String(payload?.risk_level ?? payload?.riskLevel ?? '').toLowerCase();

    return {
      patient_id: patientId,
      encounter_id: payload?.encounter_id ?? `mobile-${Date.now()}`,
      gestational_age_weeks: this.clamp(Number(vitals?.gestational_age_weeks ?? 20), 4, 42),
      collected_at: payload?.created_at ?? payload?.recorded_at ?? new Date().toISOString(),
      age: this.clamp(Number(vitals?.age ?? 28), 10, 60),
      blood_pressure: {
        systolic,
        diastolic,
      },
      bmi: this.clamp(Number(vitals?.bmi ?? 24.5), 10, 80),
      heart_rate: this.clamp(Number(vitals?.heart_rate ?? 78), 30, 200),
      temperature: this.clamp(Number(vitals?.temperature ?? 36.8), 35, 42),
      blood_sugar: this.clamp(Number(vitals?.bs ?? vitals?.blood_sugar ?? 95), 20, 600),
      hemoglobin: this.clamp(Number(vitals?.hemoglobin ?? 12), 2, 25),
      pcos: Boolean(Number(vitals?.pcos ?? 0)),
      previous_complications: Boolean(Number(vitals?.previous_complications ?? 0)),
      preexisting_diabetes: Boolean(Number(vitals?.preexisting_diabetes ?? 0)),
      mental_health: this.clamp(Number(vitals?.mental_health ?? 3), 0, 10),
      sleep_pattern: this.clamp(Number(vitals?.sleep_pattern ?? 7), 0, 24),
      exercise: this.clamp(Number(vitals?.exercise ?? 3), 0, 24),
      education: this.clamp(Number(vitals?.education ?? 4), 0, 10),
      edge_risk_classification:
        riskLevel === 'high' || riskScore >= 0.7 ? 'escalate' : 'routine_care',
      edge_risk_score: riskScore,
      device_id: 'mobile-offline',
    };
  }

  /**
   * Sync patient appointments (requires online)
   */
  async syncPatientAppointments(patientId: string, token: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/appointments/patient/${patientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const appointments = await response.json();
      if (Array.isArray(appointments)) {
        const cachedAppointments: CachedAppointment[] = appointments.map((appt: any) => ({
          appointment_id: appt.appointment_id || appt.id,
          patient_id: appt.patient_id || patientId,
          title: appt.title || appt.appointment_type || 'Appointment',
          description: appt.description,
          scheduled_for: appt.scheduled_for || appt.appointment_date || appt.date,
          appointment_type: appt.appointment_type || appt.title,
          status: appt.status || appt.appointment_status || 'scheduled',
          created_at: appt.created_at || appt.createdAt || new Date().toISOString(),
          updated_at: appt.updated_at || appt.updatedAt || new Date().toISOString(),
        }));

        await offlineDatabase.cacheAppointments(cachedAppointments);
      }
    } catch {
      return;
    }
  }

  /**
   * Sync patient insights (requires online)
   */
  async syncPatientInsights(patientId: string, token: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/insights/patient/${patientId}/this-week`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) return;

      const insight = await response.json();
      if (insight && typeof insight === 'object') {
        const cachedInsight: CachedInsight = {
          insight_id: String(insight.insight_id || insight.id || `${patientId}-weekly-insight`),
          patient_id: patientId,
          title: String(insight.development_description || 'Weekly Insight'),
          content: JSON.stringify(insight),
          insight_type: 'weekly_development',
          created_at: String(insight.last_updated || new Date().toISOString()),
          updated_at: String(insight.last_updated || new Date().toISOString()),
        };

        await offlineDatabase.cacheInsights([cachedInsight]);
      }
    } catch {
      return;
    }
  }

  /**
   * Sync patient screening history (requires online)
   */
  async syncPatientScreeningHistory(patientId: string, token: string, limit: number = 50): Promise<void> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/triage/history?patient_id=${patientId}&limit=${limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) return;

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
    } catch {
      return;
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
    } catch {
      return { success: false, itemsSynced: 0 };
    }
  }

  /**
   * Sync assigned patients for frontline staff (morning sync)
   */
  async syncAssignedPatients(staffId: string, token: string): Promise<void> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/patients?skip=0&limit=500`,
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
        const patientId = String(payload?.patient_id ?? sync.patient_id ?? '').trim();
        if (patientId.startsWith('local-patient-')) {
          continue;
        }
        const triageItem = this.buildTriageItem(payload);

        if (!triageItem) {
          await offlineDatabase.markSyncFailed(sync.record_id);
          failed++;
          continue;
        }

        if (sync.entity_type === 'screening') {
          const response = await fetch(`${API_BASE_URL}/triage/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ items: [triageItem] }),
          });

          if (response.ok) {
            await offlineDatabase.markSyncSuccess(sync.record_id);
            synced++;
          } else {
            await offlineDatabase.markSyncFailed(sync.record_id);
            failed++;
          }
        } else if (sync.entity_type === 'vitals') {
          const response = await fetch(`${API_BASE_URL}/triage/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ items: [triageItem] }),
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
