# BloomCare Mobile (Offline Stage 1)

Standalone React Native mobile app for BloomCare Stage 1 triage, with online sync support to FastAPI.

## Features

- Offline-first Stage 1 maternal triage on device
- Stage 1 model-based risk via `stage1_offline_ai.js`
- Queue and sync when internet is available
- English, Sinhala, Tamil UI
- Explainable recommendation summary for frontline users

## Tech Stack

- Expo + React Native + TypeScript
- AsyncStorage for offline queue
- NetInfo for connectivity state

## Prerequisites

- Node.js 18+
- npm
- Python 3.10+
- Expo Go app on mobile device (or Android emulator)

## 1) Start Backend API

From project root:

```bash
cd ..
pip install -r api_requirements.txt
python api.py
```

Verify backend is running:

- Open `http://localhost:8005/health`
- Expected: JSON response with status

## 2) Configure Mobile API URL

Edit `mobile/src/services/syncService.ts` and set `API_URL`.

- Android emulator: `http://10.0.2.2:8005/predict-risk`
- Physical Android/iOS phone: `http://<YOUR_LAPTOP_LAN_IP>:8005/predict-risk`

Example:

```ts
const API_URL = 'http://192.168.1.50:8005/predict-risk';
```

Notes:

- Phone and laptop must be on the same Wi-Fi.
- Do not use VPN while testing local LAN connectivity.

## 3) Start Mobile App

From `mobile` folder:

```bash
npm install
npm run start
```

Then:

- Open Expo Go on phone
- Scan QR code from terminal

## 4) Quick Verification

- Enter vitals and tap **Assess Risk**
- Online mode: should return risk and recommendations
- Offline mode: disable internet on phone, tap assess, risk should still appear via local Stage 1 model
- Re-enable internet and tap **Sync Now** to flush queued records

## Troubleshooting

### Assess button keeps loading

- Check `API_URL` is valid in `mobile/src/services/syncService.ts`
- Confirm backend is reachable from phone browser using `http://<LAN_IP>:8005/health`
- Confirm phone and laptop are on same network

### `python api.py` exits immediately

- Ensure dependencies are installed: `pip install -r api_requirements.txt`
- Check model file name expected by `api.py`
- If API logs show model load error, update model path in `api.py` to match the actual file in project root

### No online sync but offline works

- Online request timeouts are expected when backend is unreachable; app will fall back to offline risk
- Fix network/API URL and use **Sync Now**

## Useful Commands

From `mobile`:

```bash
npm run typecheck
npm run start
npm run android
```

## Current Scope

- Stage 1 risk on device
- Stage 2 via backend endpoint integration
- Offline queueing and retry sync

