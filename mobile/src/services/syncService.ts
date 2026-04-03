import {
  PatientMiniProfile,
  PendingScreening,
  Stage1VitalsInput,
} from '../types';
import authService from './authService';
import patientCacheService from './patientCacheService';
import offlineDatabase from './offlineDatabase';
import { readPendingQueue, writePendingQueue } from './offlineQueue';
import { API_BASE_URL, STAGE1_PREDICT_URL } from '../config/api';

const DEFAULT_TIMEOUT_MS = 8000;

interface MorningSyncResult {
  assignedCount: number;
  historyCount: number;
  syncedAt: string;
}

interface DirtySyncResult {
  pending: number;
  synced: number;
}

export interface FrontlinePatientRegistration {
  full_name: string;
  national_id: string;
  due_date?: string;
  age?: number;
  contact_number?: string;
  emergency_contact?: string;
  blood_group?: string;
}

export interface FrontlineAppointmentDraft {
  patient_id: string;
  appointment_date: string;
  appointment_type?: string;
  duration_minutes?: number;
  notes?: string;
}

const authHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const normalizeMiniProfile = (raw: any): PatientMiniProfile => ({
  patient_id: String(raw.patient_id ?? raw.id ?? ''),
  national_id: raw.national_id ? String(raw.national_id) : undefined,
  patient_name: String(raw.patient_name ?? raw.full_name ?? 'Unknown Patient'),
  age: typeof raw.age === 'number' ? raw.age : undefined,
  gestation_weeks:
    typeof raw.gestation_weeks === 'number' ? raw.gestation_weeks : undefined,
  risk_level: raw.risk_level === 'high' ? 'high' : 'low',
  last_screening_at: raw.last_screening_at ?? raw.updated_at ?? undefined,
  history_note: raw.history_note ?? undefined,
});

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const buildPendingRecord = (vitals: Stage1VitalsInput): PendingScreening => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  createdAt: new Date().toISOString(),
  vitals
});

export const submitRiskOnline = async (
  vitals: Stage1VitalsInput,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const { bs, ...rest } = vitals;
    const apiPayload = {
      ...rest,
      blood_sugar: bs,
    };

    return await fetch(STAGE1_PREDICT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
      body: JSON.stringify(apiPayload),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const syncPendingRecords = async (): Promise<{ pending: number; synced: number }> => {
  const queue = await readPendingQueue();
  if (queue.length === 0) {
    return { pending: 0, synced: 0 };
  }

  const unsynced: PendingScreening[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      const response = await submitRiskOnline(item.vitals, 5000);
      if (!response.ok) {
        unsynced.push(item);
      } else {
        synced += 1;
      }
    } catch {
      unsynced.push(item);
    }
  }

  await writePendingQueue(unsynced);
  return { pending: unsynced.length, synced };
};

export const getApiUrl = (): string => STAGE1_PREDICT_URL;

/**
 * Morning Sync (Sync & Go):
 * Download assigned patient mini-profiles and recent stage-1 history
 * while midwife is still at office Wi-Fi.
 */
export const morningSyncAssignedPatients = async (
  midwifeUserId: string
): Promise<MorningSyncResult> => {
  await patientCacheService.initialize();

  const token = await authService.getStoredToken();
  if (!token) {
    throw new Error('No stored token available for morning sync');
  }

  const assignedResponse = await fetch(
    `${API_BASE_URL}/patients?skip=0&limit=500`,
    { headers: authHeaders(token) }
  );

  if (!assignedResponse.ok) {
    throw new Error(`Morning sync failed: ${assignedResponse.status}`);
  }

  const assignedRaw = await assignedResponse.json();
  const assignedList = Array.isArray(assignedRaw) ? assignedRaw : assignedRaw?.items ?? [];
  const miniProfiles = assignedList
    .map(normalizeMiniProfile)
    .filter((p: PatientMiniProfile) => p.patient_id.length > 0);

  await patientCacheService.cacheMorningProfiles(miniProfiles, today);

  let totalHistory = 0;

  for (const profile of miniProfiles) {
    try {
      const historyResponse = await fetch(
        `${API_BASE_URL}/triage/history?patient_id=${encodeURIComponent(profile.patient_id)}&limit=5`,
        { headers: authHeaders(token) }
      );

      if (!historyResponse.ok) {
        continue;
      }

      const historyRaw = await historyResponse.json();
      const historyList = Array.isArray(historyRaw)
        ? historyRaw
        : historyRaw?.items ?? [];

      const stage1History: PendingScreening[] = historyList.map((item: any) => ({
        id: String(item.id ?? `${profile.patient_id}-${item.created_at ?? Date.now()}`),
        createdAt: String(item.created_at ?? new Date().toISOString()),
        vitals: item.vitals ?? item,
        is_synced: true,
        patient_id: profile.patient_id,
        updatedAt: String(item.updated_at ?? item.created_at ?? new Date().toISOString()),
      }));

      totalHistory += stage1History.length;
      await patientCacheService.cachePatientStage1History(profile.patient_id, stage1History);
    } catch {
      // Continue with remaining patients even if one history call fails.
    }
  }

  return {
    assignedCount: miniProfiles.length,
    historyCount: totalHistory,
    syncedAt: new Date().toISOString(),
  };
};

/**
 * Save offline vitals update with dirty flag (is_synced = false).
 */
export const saveDirtyOfflineVitalsUpdate = async (payload: {
  patient_id: string;
  patient_name: string;
  vitals: Stage1VitalsInput;
  risk_score: number;
  risk_level: 'low' | 'high';
  recommendations: string[];
}): Promise<string> => {
  await patientCacheService.initialize();
  return patientCacheService.addDirtyVitalsUpdate(payload);
};

/**
 * Search local cache only. Used in field/offline mode.
 */
export const searchPatientInLocalCache = async (
  query: string
): Promise<PatientMiniProfile[]> => {
  await patientCacheService.initialize();
  return patientCacheService.searchPatientByName(query);
};

/**
 * Return locally cached stage-1 history for selected patient.
 */
export const getCachedPatientStage1History = async (
  patientId: string
): Promise<PendingScreening[]> => {
  await patientCacheService.initialize();
  return patientCacheService.getPatientHistory(patientId);
};

/**
 * Push dirty local updates back to backend when network is available.
 */
export const syncDirtyVitalsUpdates = async (): Promise<DirtySyncResult> => {
  await patientCacheService.initialize();

  const token = await authService.getStoredToken();
  const dirty = await patientCacheService.getDirtyUpdates(200);

  if (dirty.length === 0) {
    return { pending: 0, synced: 0 };
  }

  if (!token) {
    return { pending: dirty.length, synced: 0 };
  }

  let synced = 0;

  for (const update of dirty) {
    try {
      const triagePayload = {
        patient_id: update.patient_id,
        encounter_id: `mobile-${update.local_id}`,
        gestational_age_weeks: clamp(Number(update.vitals?.gestational_age_weeks ?? 20), 4, 42),
        collected_at: update.created_at,
        age: clamp(Number(update.vitals.age ?? 28), 10, 60),
        blood_pressure: {
          systolic: clamp(Number(update.vitals.systolic ?? 120), 60, 220),
          diastolic: clamp(
            Math.min(Number(update.vitals.diastolic ?? 80), Number(update.vitals.systolic ?? 120) - 1),
            40,
            140
          ),
        },
        bmi: clamp(Number(update.vitals.bmi ?? 24.5), 10, 80),
        heart_rate: clamp(Number(update.vitals.heart_rate ?? 78), 30, 200),
        temperature: clamp(Number(update.vitals.temperature ?? 36.8), 35.0, 42.0),
        blood_sugar: clamp(Number(update.vitals.bs ?? 95), 20, 600),
        hemoglobin: clamp(Number(update.vitals.hemoglobin ?? 12), 2, 25),
        pcos: Boolean(Number(update.vitals.pcos ?? 0)),
        previous_complications: Boolean(Number(update.vitals.previous_complications ?? 0)),
        preexisting_diabetes: Boolean(Number(update.vitals.preexisting_diabetes ?? 0)),
        mental_health: clamp(Number(update.vitals.mental_health ?? 3), 0, 10),
        sleep_pattern: clamp(Number(update.vitals.sleep_pattern ?? 7), 0, 24),
        exercise: clamp(Number(update.vitals.exercise ?? 3), 0, 24),
        education: clamp(Number(update.vitals.education ?? 4), 0, 10),
        edge_risk_classification:
          update.risk_level === 'high' || Number(update.risk_score ?? 0) >= 0.7
            ? 'escalate'
            : 'routine_care',
        edge_risk_score: Math.max(0, Math.min(1, Number(update.risk_score ?? 0.5))),
        device_id: 'mobile-offline',
      };

      const response = await fetch(`${API_BASE_URL}/triage/sync`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ items: [triagePayload] }),
      });

      if (response.ok) {
        await patientCacheService.markDirtyUpdateSynced(update.local_id);
        synced += 1;
      }
    } catch {
      // Leave dirty record as unsynced for next retry.
    }
  }

  const pending = await patientCacheService.getDirtyCount();
  return { pending, synced };
};

export const getDirtyVitalsCount = async (): Promise<number> => {
  await patientCacheService.initialize();
  return patientCacheService.getDirtyCount();
};

export const findPatientByNic = async (
  nic: string,
  online: boolean
): Promise<PatientMiniProfile | null> => {
  const normalizedNic = nic.trim();
  if (!normalizedNic) {
    return null;
  }

  await offlineDatabase.initialize();

  if (online) {
    const token = await authService.getStoredToken();
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/patients?skip=0&limit=500`, {
          headers: authHeaders(token),
        });

        if (response.ok) {
          const rows = await response.json();
          const list = Array.isArray(rows) ? rows : [];
          const match = list.find((item: any) => String(item?.national_id ?? '').trim() === normalizedNic);

          if (match) {
            const mapped = normalizeMiniProfile(match);
            await offlineDatabase.cachePatientProfile({
              ...mapped,
              national_id: match.national_id,
              due_date: match.due_date,
              contact_number: match.contact_number,
              emergency_contact: match.emergency_contact,
              blood_group: match.blood_group,
            });
            return mapped;
          }
        }
      } catch {
        // Fallback to offline cache below.
      }
    }
  }

  const cached = await offlineDatabase.searchPatients(normalizedNic);
  const match = cached.find((item: any) => String(item?.national_id ?? '').trim() === normalizedNic);
  return match ? normalizeMiniProfile(match) : null;
};

export const registerPatientForFrontline = async (
  payload: FrontlinePatientRegistration,
  online: boolean
): Promise<PatientMiniProfile> => {
  await offlineDatabase.initialize();

  const normalizedPayload = {
    ...payload,
    full_name: payload.full_name.trim(),
    national_id: payload.national_id.trim(),
  };

  if (online) {
    const token = await authService.getStoredToken();
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/patient-management/create-patient`, {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify(normalizedPayload),
        });

        if (response.ok) {
          const created = await response.json();
          const mapped = normalizeMiniProfile(created);
          await offlineDatabase.cachePatientProfile({
            ...mapped,
            national_id: created.national_id,
            due_date: created.due_date,
            contact_number: created.contact_number,
            emergency_contact: created.emergency_contact,
            blood_group: created.blood_group,
          });
          return mapped;
        }
      } catch {
        // Fallback to local pending queue below.
      }
    }
  }

  const localId = `local-patient-${Date.now()}`;
  const pendingPayload = {
    ...normalizedPayload,
    local_id: localId,
  };

  await offlineDatabase.addPendingSync('patient_registration', 'create', null, pendingPayload);

  const localProfile: PatientMiniProfile = {
    patient_id: localId,
    national_id: normalizedPayload.national_id,
    patient_name: normalizedPayload.full_name,
    age: normalizedPayload.age,
    risk_level: 'low',
  };

  await offlineDatabase.cachePatientProfile({
    ...localProfile,
    national_id: normalizedPayload.national_id,
    due_date: normalizedPayload.due_date,
    contact_number: normalizedPayload.contact_number,
    emergency_contact: normalizedPayload.emergency_contact,
    blood_group: normalizedPayload.blood_group,
  });

  return localProfile;
};

export const createAppointmentForFrontline = async (
  payload: FrontlineAppointmentDraft,
  online: boolean
): Promise<void> => {
  await offlineDatabase.initialize();

  if (online) {
    const token = await authService.getStoredToken();
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/appointments/`, {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({
            ...payload,
            duration_minutes: payload.duration_minutes ?? 30,
          }),
        });

        if (response.ok) {
          const created = await response.json();
          await offlineDatabase.cacheAppointment({
            appointment_id: String(created.id ?? `appt-${Date.now()}`),
            patient_id: String(created.patient_id ?? payload.patient_id),
            title: created.appointment_type ?? payload.appointment_type ?? 'Appointment',
            description: created.notes ?? payload.notes ?? '',
            scheduled_for: created.appointment_date ?? payload.appointment_date,
            appointment_type: created.appointment_type ?? payload.appointment_type ?? 'PRENATAL_CHECKUP',
            status: created.status ?? 'PENDING',
            created_at: created.created_at ?? new Date().toISOString(),
            updated_at: created.updated_at ?? new Date().toISOString(),
          });
          return;
        }
      } catch {
        // Fallback to local pending queue below.
      }
    }
  }

  await offlineDatabase.addPendingSync('appointment', 'create', payload.patient_id, payload);
  await offlineDatabase.cacheAppointment({
    appointment_id: `local-appt-${Date.now()}`,
    patient_id: payload.patient_id,
    title: payload.appointment_type ?? 'Appointment',
    description: payload.notes ?? '',
    scheduled_for: payload.appointment_date,
    appointment_type: payload.appointment_type ?? 'PRENATAL_CHECKUP',
    status: 'PENDING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
};

export const queueReferralCard = async (payload: {
  patient_id: string;
  national_id: string;
  patient_name: string;
  risk_level: 'low' | 'high';
  risk_score: number;
  created_at: string;
}): Promise<void> => {
  await offlineDatabase.initialize();
  await offlineDatabase.addPendingSync('referral_card', 'create', payload.patient_id, payload);
};

export const syncPendingFrontlineActions = async (): Promise<{ pending: number; synced: number }> => {
  await offlineDatabase.initialize();

  const token = await authService.getStoredToken();
  const pending = await offlineDatabase.getPendingSyncs();

  if (!token || pending.length === 0) {
    return { pending: pending.length, synced: 0 };
  }

  let synced = 0;

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload_json || '{}');

      if (item.entity_type === 'patient_registration' && item.operation === 'create') {
        const response = await fetch(`${API_BASE_URL}/patient-management/create-patient`, {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          continue;
        }
      } else if (item.entity_type === 'appointment' && item.operation === 'create') {
        const response = await fetch(`${API_BASE_URL}/appointments/`, {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          continue;
        }
      } else if (item.entity_type === 'referral_card') {
        // Referral card queue is local-only audit; mark as synced when reconnecting.
      } else {
        continue;
      }

      await offlineDatabase.markSyncSuccess(item.record_id);
      synced += 1;
    } catch {
      // Keep record pending for next retry.
    }
  }

  const stillPending = (await offlineDatabase.getPendingSyncs()).length;
  return { pending: stillPending, synced };
};

export const getPendingFrontlineActionCount = async (): Promise<number> => {
  await offlineDatabase.initialize();
  const pending = await offlineDatabase.getPendingSyncs();
  return pending.length;
};
