# Implementation Checklist: Register Once, Sync Many

## Current Status

### Completed
- [x] Secure local storage with `expo-secure-store`.
- [x] Registration flow stores email, role, token, and PIN hash locally.
- [x] Offline PIN login mode implemented in login UI.
- [x] Auth API integration aligned to `/api/v1/auth/*`.
- [x] Mobile API base URL centralized in `src/config/api.ts`.
- [x] Stage-1 prediction endpoint integration from mobile to backend.
- [x] Role normalization between backend enums and mobile roles.
- [x] Logout behavior updated to preserve PIN-based offline access.

### Verified Behavior
- [x] User can register while online.
- [x] Session and PIN hash are saved locally after registration.
- [x] User can switch to PIN mode and log in offline.
- [x] Backend reachable from physical device using LAN IP.

## Implementation Details

### Mobile Auth Storage
- Local secure storage file: `mobile/src/services/secureStore.ts`
- Persisted session fields:
  - `userId`
  - `email`
  - `fullName`
  - `role`
  - `token`
  - `pinHash`
  - `registeredAt`
- PIN is stored as SHA-256 hash, never plaintext.

### Auth Service
- Service file: `mobile/src/services/authService.ts`
- Online auth endpoints:
  - `POST /auth/register`
  - `POST /auth/login`
  - `GET /auth/me`
- Offline auth path:
  - `loginWithPin({ pin })` validates against local `pinHash`.

### API Configuration
- Config file: `mobile/src/config/api.ts`
- Default base URL is LAN-based and can be overridden with:
  - `EXPO_PUBLIC_API_BASE_URL`

### Sync/Prediction Integration
- Stage-1 prediction call is centralized in:
  - `mobile/src/services/syncService.ts`
- Endpoint used:
  - `/api/v1/triage/predict/stage1`

## Remaining Work

### Recommended Next
- [ ] Add configurable local session TTL (for example 30 days).
- [ ] Add explicit "Forget device" action to clear stored session and PIN.
- [ ] Add unit tests for `secureStore` and `authService` offline login behavior.
- [ ] Add e2e test case: register online -> logout -> login offline by PIN.
- [ ] Add optional biometric unlock fallback to PIN.

## Operational Notes
- For physical-device testing, backend must run on `0.0.0.0` and be reachable via LAN IP.
- Offline PIN login depends on an already saved local session from a successful online register/login.
- Local session remains until explicitly cleared, app data reset, or app uninstall.
