import {
  PatientMiniProfile,
  PendingScreening,
  Stage1VitalsInput,
} from '../types';
import authService from './authService';
import patientCacheService from './patientCacheService';
import offlineDatabase from './offlineDatabase';
import { readPendingQueue, writePendingQueue } from './offlineQueue';
import { API_BASE_URL, STAGE1_SYNC_URL } from '../config/api';

const DEFAULT_TIMEOUT_MS = 8000;
const PATIENT_CREATE_URL = `${API_BASE_URL}/patients/`;
const isLocalPatientId = (value: unknown): boolean =>
  String(value ?? '').startsWith('local-patient-');

const buildFallbackSlots = (date: string): { label: string; startDateTime: string }[] => {
  if (!date) return [];
  const slots: { label: string; startDateTime: string }[] = [];
  for (let hour = 8; hour < 17; hour += 1) {
    for (const minute of [0, 30]) {
      const hourLabel = String(hour).padStart(2, '0');
      const minuteLabel = String(minute).padStart(2, '0');
      const timeLabel = `${hourLabel}:${minuteLabel}`;
      slots.push({
        label: timeLabel,
        startDateTime: `${date}T${timeLabel}:00`,
      });
    }
  }
  return slots;
};

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
  patient_nic?: string;
  patient_full_name?: string;
  specialist_id?: string;
  specialist_name?: string;
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

const NIC_PATTERN = /^(?:\d{9}[VvXx]|\d{12})$/;

const sanitizeRegistrationPayload = (payload: Record<string, any>): Record<string, any> => {
  const { local_id, ...rest } = payload ?? {};
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null || value === '') continue;
    cleaned[key] = value;
  }
  if (typeof cleaned.national_id === 'string') {
    cleaned.national_id = cleaned.national_id.trim().toUpperCase();
  }
  if (typeof cleaned.full_name === 'string') {
    cleaned.full_name = cleaned.full_name.trim();
  }
  return cleaned;
};

const readApiError = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return body.detail;
    if (Array.isArray(body?.detail)) {
      return body.detail
        .map((item: any) => item?.msg || JSON.stringify(item))
        .join('; ');
    }
    return JSON.stringify(body);
  } catch {
    return `HTTP ${response.status}`;
  }
};

const fetchPatientByNationalId = async (
  nationalId: string,
  token: string
): Promise<any | null> => {
  const normalized = nationalId.trim().toUpperCase();
  if (!normalized) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/patients?skip=0&limit=500`, {
      headers: authHeaders(token),
    });
    if (!response.ok) return null;
    const rows = await response.json();
    const list = Array.isArray(rows) ? rows : [];
    const match = list.find((item: any) =>
      String(item?.national_id ?? '').trim().toUpperCase() === normalized
    );
    return match ?? null;
  } catch {
    return null;
  }
};

const postPatientRegistration = async (
  token: string,
  payload: Record<string, any>
): Promise<{ ok: true; patient: any } | { ok: false; error: string }> => {
  const attempt = async (body: Record<string, any>) => {
    const response = await fetch(PATIENT_CREATE_URL, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    if (response.ok) {
      return { ok: true as const, patient: await response.json() };
    }
    return { ok: false as const, status: response.status, error: await readApiError(response) };
  };

  let result = await attempt(payload);
  if (result.ok) return result;

  // Drop optional phone fields that often fail Sri Lankan format validation,
  // then retry so the patient record itself still reaches Postgres.
  if (result.status === 422 && (payload.contact_number || payload.emergency_contact)) {
    const { contact_number, emergency_contact, ...withoutPhones } = payload;
    result = await attempt(withoutPhones);
    if (result.ok) return result;
  }

  const existing = await fetchPatientByNationalId(String(payload.national_id ?? ''), token);
  if (existing) {
    return { ok: true, patient: existing };
  }

  return { ok: false, error: result.error };
};

export const buildPendingRecord = (vitals: Stage1VitalsInput): PendingScreening => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  createdAt: new Date().toISOString(),
  vitals
});

export const submitRiskOnline = async (
  _vitals: Stage1VitalsInput,
  _timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> => {
  // Stage 1 scoring is on-device only (stage1_offline_ai.js). Upload results via /triage/sync.
  throw new Error('STAGE1_ON_DEVICE_ONLY');
};

export const syncPendingRecords = async (): Promise<{ pending: number; synced: number }> => {
  const queue = await readPendingQueue();
  // Legacy predict-and-clear path removed; pending vitals stay queued until triage sync runs.
  return { pending: queue.length, synced: 0 };
};

export const getApiUrl = (): string => STAGE1_SYNC_URL;

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

  const assignedDate = new Date().toISOString().slice(0, 10);
  await patientCacheService.cacheMorningProfiles(miniProfiles, assignedDate);

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
 * Search local cache only by NIC. Used in field/offline mode.
 */
export const searchPatientInLocalCache = async (
  query: string
): Promise<PatientMiniProfile[]> => {
  const normalizedNic = query.trim().toUpperCase();
  if (!normalizedNic) {
    return [];
  }

  await offlineDatabase.initialize();
  const patients = await offlineDatabase.getAllPatientProfiles();

  return patients
    .filter((patient: any) => String(patient.national_id ?? '').trim().toUpperCase() === normalizedNic)
    .map((patient: any) => normalizeMiniProfile(patient));
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
    if (isLocalPatientId(update.patient_id)) {
      // Registration must sync + remap before these can upload.
      console.warn('Skipping dirty vitals for unsynced local patient:', update.patient_id);
      continue;
    }
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
    national_id: payload.national_id.trim().toUpperCase(),
  };

  if (!NIC_PATTERN.test(normalizedPayload.national_id)) {
    throw new Error(
      'NIC must be Sri Lankan format: 9 digits + V/X (e.g. 900000007V) or 12 digits.'
    );
  }

  if (online) {
    const token = await authService.getStoredToken();
    if (token) {
      try {
        const response = await fetch(PATIENT_CREATE_URL, {
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
        const existing = await fetchPatientByNationalId(normalizedPayload.national_id, token);
        if (existing) {
          const mapped = normalizeMiniProfile(existing);
          await offlineDatabase.cachePatientProfile({
            ...mapped,
            national_id: existing.national_id,
            due_date: existing.due_date,
            contact_number: existing.contact_number,
            emergency_contact: existing.emergency_contact,
            blood_group: existing.blood_group,
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

export const loadAppointmentSpecializations = async (
  online: boolean
): Promise<{ specialization: string; specialist_count: number }[]> => {
  await offlineDatabase.initialize();
  if (!online) {
    return await offlineDatabase.getAppointmentSpecializations();
  }

  const token = await authService.getStoredToken();
  if (!token) {
    return await offlineDatabase.getAppointmentSpecializations();
  }

  try {
    const response = await fetch(`${API_BASE_URL}/appointments/specializations`, {
      headers: authHeaders(token),
    });
    if (!response.ok) {
      return await offlineDatabase.getAppointmentSpecializations();
    }
    const data = await response.json();
    const list = Array.isArray(data) ? data : [];
    const obstetrics = Array.from(
      list.reduce((acc: Map<string, { specialization: string; specialist_count: number }>, item: any) => {
        const specialization = String(item?.specialization || '').trim();
        if (!specialization || !/obstetr/i.test(specialization) || acc.has(specialization)) {
          return acc;
        }
        acc.set(specialization, {
          specialization,
          specialist_count: Number(item?.specialist_count || 0),
        });
        return acc;
      }, new Map()).values()
    );
    await offlineDatabase.cacheAppointmentSpecializations(obstetrics);
    return obstetrics;
  } catch {
    return await offlineDatabase.getAppointmentSpecializations();
  }
};

export const loadAppointmentSpecialists = async (
  specialization: string,
  online: boolean
): Promise<{ id: string; full_name: string; specialization: string; phone_number?: string; email?: string }[]> => {
  await offlineDatabase.initialize();
  if (!specialization) return [];

  if (!online) {
    return await offlineDatabase.getAppointmentSpecialistsBySpecialization(specialization);
  }

  const token = await authService.getStoredToken();
  if (!token) {
    return await offlineDatabase.getAppointmentSpecialistsBySpecialization(specialization);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/appointments/specialists/${encodeURIComponent(specialization)}`, {
      headers: authHeaders(token),
    });
    if (!response.ok) {
      return await offlineDatabase.getAppointmentSpecialistsBySpecialization(specialization);
    }
    const data = await response.json();
    const list = Array.isArray(data) ? data : [];
    const mapped = list
      .map((item: any) => ({
        id: String(item?.id ?? item?.user_id ?? ''),
        full_name: String(item?.full_name ?? ''),
        specialization: String(item?.specialization ?? specialization),
        phone_number: item?.phone_number ? String(item.phone_number) : undefined,
        email: item?.email ? String(item.email) : undefined,
      }))
      .filter((item) => item.id && item.full_name);
    await offlineDatabase.cacheAppointmentSpecialists(mapped);
    return mapped;
  } catch {
    return await offlineDatabase.getAppointmentSpecialistsBySpecialization(specialization);
  }
};

export const loadSpecialistAvailability = async (
  specialistName: string,
  selectedDate: string,
  online: boolean
): Promise<{ label: string; startDateTime: string }[]> => {
  if (!specialistName || !selectedDate) return [];
  if (!online) {
    return buildFallbackSlots(selectedDate);
  }

  const token = await authService.getStoredToken();
  if (!token) {
    return buildFallbackSlots(selectedDate);
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/appointments/availability/${encodeURIComponent(specialistName)}?days_ahead=14`,
      { headers: authHeaders(token) }
    );
    if (!response.ok) {
      return buildFallbackSlots(selectedDate);
    }
    const data = await response.json();
    const slots = Array.isArray(data)
      ? data.flatMap((daySlot: any) =>
          (daySlot.available_slots || []).map((slot: any) => {
            const slotDate = String(daySlot?.date || '').trim();
            const rawStart = typeof slot === 'string' ? slot : slot.start_time || slot.time || '';
            let timeStr = String(rawStart || '').trim();
            if (timeStr.includes('T')) {
              const parts = timeStr.split('T');
              const timePortion = parts[1] || '';
              timeStr = timePortion.split('.')[0].replace('Z', '').trim();
            }
            const normalizedStart = String(rawStart || '').includes('T')
              ? String(rawStart)
              : `${slotDate}T${timeStr}`;
            return {
              label: timeStr,
              startDateTime: normalizedStart,
            };
          })
        )
      : [];
    const filtered = slots.filter((slot: any) => String(slot.startDateTime).startsWith(`${selectedDate}T`));
    return filtered.length > 0 ? filtered : buildFallbackSlots(selectedDate);
  } catch {
    return buildFallbackSlots(selectedDate);
  }
};

export const createAppointmentForFrontline = async (
  payload: FrontlineAppointmentDraft,
  online: boolean
): Promise<void> => {
  await offlineDatabase.initialize();

  const isLocal = isLocalPatientId(payload.patient_id);

  if (online && !isLocal) {
    const token = await authService.getStoredToken();
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/appointments/`, {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({
            patient_id: payload.patient_id,
            specialist_id: payload.specialist_id,
            specialist_name: payload.specialist_name,
            appointment_date: payload.appointment_date,
            appointment_type: payload.appointment_type,
            notes: payload.notes ?? null,
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

  if (online && isLocal && payload.patient_nic && payload.patient_full_name) {
    const token = await authService.getStoredToken();
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/appointments/by-nic`, {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({
            patient_nic: payload.patient_nic,
            patient_full_name: payload.patient_full_name,
            specialist_name: payload.specialist_name,
            appointment_date: payload.appointment_date,
            appointment_type: payload.appointment_type ?? 'PRENATAL_CHECKUP',
            duration_minutes: payload.duration_minutes ?? 30,
            notes: payload.notes ?? null,
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

export const syncPendingFrontlineActions = async (): Promise<{
  pending: number;
  synced: number;
  errors: string[];
}> => {
  await offlineDatabase.initialize();

  const token = await authService.getStoredToken();
  const pending = await offlineDatabase.getFrontlineActionSyncs();

  if (!token) {
    return {
      pending: pending.length,
      synced: 0,
      errors: pending.length > 0 ? ['Not authenticated — log in again to sync.'] : [],
    };
  }

  if (pending.length === 0) {
    return { pending: 0, synced: 0, errors: [] };
  }

  let synced = 0;
  const errors: string[] = [];

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload_json || '{}');

      if (item.entity_type === 'patient_registration' && item.operation === 'create') {
        const localId = payload?.local_id ? String(payload.local_id) : '';
        const cleanedPayload = sanitizeRegistrationPayload(payload);

        if (!cleanedPayload.full_name || !cleanedPayload.national_id) {
          errors.push('Patient registration missing full name or NIC.');
          continue;
        }

        const createdResult = await postPatientRegistration(token, cleanedPayload);
        if (!createdResult.ok) {
          console.error('Patient registration sync failed:', createdResult.error);
          errors.push(
            `Patient ${cleanedPayload.national_id}: ${createdResult.error}`
          );
          continue;
        }

        const created = createdResult.patient;
        const mapped = normalizeMiniProfile(created);
        await offlineDatabase.cachePatientProfile({
          ...mapped,
          national_id: created.national_id,
          due_date: created.due_date,
          contact_number: created.contact_number,
          emergency_contact: created.emergency_contact,
          blood_group: created.blood_group,
        });
        if (localId && mapped.patient_id && localId !== mapped.patient_id) {
          await offlineDatabase.remapPatientId(localId, mapped.patient_id, {
            patient_name: mapped.patient_name,
            national_id: created.national_id,
            age: mapped.age,
            due_date: created.due_date,
            contact_number: created.contact_number,
            emergency_contact: created.emergency_contact,
            blood_group: created.blood_group,
          });
          await patientCacheService.remapPatientId(localId, mapped.patient_id);
        }
      } else if (item.entity_type === 'appointment' && item.operation === 'create') {
        const patientId = String(payload?.patient_id ?? '');
        const byNic = patientId.startsWith('local-patient-') && payload?.patient_nic && payload?.patient_full_name;
        const endpoint = byNic ? `${API_BASE_URL}/appointments/by-nic` : `${API_BASE_URL}/appointments/`;
        const body = byNic
          ? {
              patient_nic: payload.patient_nic,
              patient_full_name: payload.patient_full_name,
              specialist_name: payload.specialist_name,
              appointment_date: payload.appointment_date,
              appointment_type: payload.appointment_type ?? 'PRENATAL_CHECKUP',
              duration_minutes: payload.duration_minutes ?? 30,
              notes: payload.notes ?? null,
            }
          : {
              patient_id: payload.patient_id,
              specialist_id: payload.specialist_id,
              specialist_name: payload.specialist_name,
              appointment_date: payload.appointment_date,
              appointment_type: payload.appointment_type,
              duration_minutes: payload.duration_minutes ?? 30,
              notes: payload.notes ?? null,
            };
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const detail = await readApiError(response);
          console.error('Appointment sync failed:', detail);
          errors.push(`Appointment: ${detail}`);
          continue;
        }
      } else if (item.entity_type === 'referral_card') {
        // Referral card queue is local-only audit; mark as synced when reconnecting.
      } else {
        continue;
      }

      await offlineDatabase.markSyncSuccess(item.record_id);
      synced += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      console.error('Frontline action sync error:', error);
      errors.push(message);
    }
  }

  const stillPending = (await offlineDatabase.getFrontlineActionSyncs()).length;
  return { pending: stillPending, synced, errors };
};

export const getPendingFrontlineActionCount = async (): Promise<number> => {
  await offlineDatabase.initialize();
  const pending = await offlineDatabase.getFrontlineActionSyncs();
  return pending.length;
};
