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

export const enqueuePending = async (record: PendingScreening): Promise<void> => {
  const queue = await readPendingQueue();
  queue.push(record);
  await writePendingQueue(queue);
};
