const DEFAULT_API_BASE_URL = 'http://192.168.8.146:8005/api/v1';

// Expo injects EXPO_PUBLIC_* variables at build time.
const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export const API_BASE_URL = (envApiBaseUrl && envApiBaseUrl.trim().length > 0)
  ? envApiBaseUrl.trim().replace(/\/+$/, '')
  : DEFAULT_API_BASE_URL;

export const STAGE1_PREDICT_URL = `${API_BASE_URL}/triage/predict/stage1`;
