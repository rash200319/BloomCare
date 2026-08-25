// Default matches web FE + uvicorn Quick Start (port 8001).
// Override per device with EXPO_PUBLIC_API_BASE_URL, e.g.:
//   Android emulator: http://10.0.2.2:8001/api/v1
//   Physical device:  http://<YOUR_LAN_IP>:8001/api/v1
const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8001/api/v1';

// Expo injects EXPO_PUBLIC_* variables at build time.
const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export const API_BASE_URL = (envApiBaseUrl && envApiBaseUrl.trim().length > 0)
  ? envApiBaseUrl.trim().replace(/\/+$/, '')
  : DEFAULT_API_BASE_URL;

// Stage 1 inference runs on-device via stage1_offline_ai.js.
// There is no server /triage/predict/stage1 route — use /triage/sync to upload results.
export const STAGE1_SYNC_URL = `${API_BASE_URL}/triage/sync`;
