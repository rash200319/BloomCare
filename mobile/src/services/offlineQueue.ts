import AsyncStorage from '@react-native-async-storage/async-storage';
import { PendingScreening } from '../types';
import { readSecureJsonArray, writeSecureJsonArray } from './queueCrypto';

const PENDING_QUEUE_KEY = 'bloomcare_pending_stage1_queue';

export const readPendingQueue = async (): Promise<PendingScreening[]> => {
  return readSecureJsonArray<PendingScreening>(
    PENDING_QUEUE_KEY,
    (key) => AsyncStorage.getItem(key),
    (key, value) => AsyncStorage.setItem(key, value)
  );
};

export const writePendingQueue = async (queue: PendingScreening[]): Promise<void> => {
  await writeSecureJsonArray(
    PENDING_QUEUE_KEY,
    queue,
    (key, value) => AsyncStorage.setItem(key, value)
  );
};

export const enqueuePending = async (
  record: Omit<PendingScreening, 'id' | 'createdAt' | 'is_synced' | 'updatedAt'>,
  userId?: string
): Promise<void> => {
  const queue = await readPendingQueue();
  queue.push({
    ...record,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    is_synced: false,
    userId,
    patient_id: record.patient_id ?? undefined,
  });
  await writePendingQueue(queue);
};
