import { PendingScreening, Stage1VitalsInput } from '../types';
import { readPendingQueue, writePendingQueue } from './offlineQueue';

const API_URL = 'http://<use_your_lan_ip>:8000/predict-risk';
const DEFAULT_TIMEOUT_MS = 8000;

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
    return await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
      body: JSON.stringify(vitals),
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

export const getApiUrl = (): string => API_URL;
