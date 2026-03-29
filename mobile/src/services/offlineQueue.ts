import AsyncStorage from '@react-native-async-storage/async-storage';
import { PendingScreening } from '../types';

const PENDING_QUEUE_KEY = 'bloomcare_pending_stage1_queue';

export const readPendingQueue = async (): Promise<PendingScreening[]> => {
  const raw = await AsyncStorage.getItem(PENDING_QUEUE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const writePendingQueue = async (queue: PendingScreening[]): Promise<void> => {
  await AsyncStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(queue));
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
