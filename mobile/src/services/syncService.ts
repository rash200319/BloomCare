import {
  PatientMiniProfile,
  PendingScreening,
  Stage1VitalsInput,
} from '../types';
import authService from './authService';
import patientCacheService from './patientCacheService';
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

const authHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const normalizeMiniProfile = (raw: any): PatientMiniProfile => ({
  patient_id: String(raw.patient_id ?? raw.id ?? ''),
  patient_name: String(raw.patient_name ?? raw.full_name ?? 'Unknown Patient'),
  age: typeof raw.age === 'number' ? raw.age : undefined,
  gestation_weeks:
    typeof raw.gestation_weeks === 'number' ? raw.gestation_weeks : undefined,
  risk_level: raw.risk_level === 'high' ? 'high' : 'low',
  last_screening_at: raw.last_screening_at ?? raw.updated_at ?? undefined,
  history_note: raw.history_note ?? undefined,
});

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

  const today = new Date().toISOString().slice(0, 10);
  const assignedResponse = await fetch(
    `${API_BASE_URL}/patients/assigned?midwife_id=${encodeURIComponent(midwifeUserId)}&date=${today}`,
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
        `${API_BASE_URL}/screening/history?patient_id=${encodeURIComponent(profile.patient_id)}&limit=5`,
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
      const response = await fetch(`${API_BASE_URL}/screening/save`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          patient_id: update.patient_id,
          patient_name: update.patient_name,
          vitals: update.vitals,
          risk_score: update.risk_score,
          risk_level: update.risk_level,
          recommendations: update.recommendations,
          local_id: update.local_id,
          updated_at: update.updated_at,
        }),
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
