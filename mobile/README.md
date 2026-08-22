# BloomCare Mobile

Expo / React Native app for **offline-first Stage 1** maternal triage, with PIN unlock, SQLite caching, and sync to the FastAPI backend when connectivity returns.

Canonical setup: **[root README](../README.md)**. API port defaults to **8001**.

> Demo only — not for production or real patient data.

---

## Features

- On-device Stage 1 risk via `src/services/stage1_offline_ai.js`
- Expo SQLite offline DB (profiles, appointments, insights, pending sync queue)
- SecureStore for hashed PIN + JWT (PIN unlock preserves JWT for reconnect sync)
- Morning sync of assigned patients for disconnected clinics
- English / Sinhala / Tamil UI strings

---

## Tech

| Piece | Tech |
|-------|------|
| Runtime | Expo ~53, React Native 0.79, TypeScript |
| Offline | Expo SQLite, AsyncStorage queue |
| Auth | Expo SecureStore, NetInfo |
| API | `EXPO_PUBLIC_API_BASE_URL` → `/api/v1` |

---

## Prerequisites

- Node.js 18+
- Backend running (`uvicorn` on port **8001** from repo root — see root README)
- Expo Go (device) or Android emulator

---

## Configure API URL

```bash
# PowerShell example — use your LAN IP for a physical device
$env:EXPO_PUBLIC_API_BASE_URL="http://192.168.1.50:8001/api/v1"
```

Or copy `mobile/.env.example` → `mobile/.env`.

| Target | Suggested base |
|--------|----------------|
| Android emulator | `http://10.0.2.2:8001/api/v1` |
| iOS simulator | `http://127.0.0.1:8001/api/v1` |
| Physical device | `http://<YOUR_LAN_IP>:8001/api/v1` |

Phone and laptop must share Wi‑Fi. Avoid VPN during local testing.

Defaults are defined in `src/config/api.ts`. Stage 1 scoring is **on-device**; results upload through `/triage/sync` (not a separate predict route).

---

## Run

```bash
cd mobile
npm install
npm run start
```

Scan the Expo QR code, or use `npm run android` / `npm run ios`.

Typecheck:

```bash
npm run typecheck
```

---

## Demo flow

1. Online staff login → optional PIN setup  
2. Morning sync (download assigned patients)  
3. Go offline → PIN unlock → Stage 1 screenings  
4. Reconnect → flush pending sync queue  

Demo credentials match the root README (password `rash2003`).

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| Cannot reach API | `EXPO_PUBLIC_API_BASE_URL` host/port must match uvicorn (**8001**) |
| Emulator localhost fails | Use `10.0.2.2` on Android, not `127.0.0.1` |
| Stale auth after seed email rename | Clear app storage / re-login with `obstetrician@bloomcare.health` |
