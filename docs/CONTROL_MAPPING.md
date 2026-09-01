# BloomCare Control Mapping

> **Demo maturity map — not a compliance certification.**  
> This document maps common healthcare-security *control themes* to what BloomCare implements today.  
> It does **not** claim HIPAA, HITRUST, SOC 2, or any formal attestation. Real PHI requires a program, BAAs, and operational controls beyond this repo.

## Themes

| Theme | Intent |
|-------|--------|
| **Access** | Who can authenticate and which patient records they may see |
| **Audit** | Who accessed which patient data, when |
| **Integrity** | Detect tampering of offline / in-transit clinical payloads |
| **Transmission** | Protect data on the wire between clients and API |

---

## Access

| Control | BloomCare status | Where |
|---------|------------------|--------|
| Authenticated API | JWT Bearer on protected routes | `backend/core/deps.py`, `backend/api/v1/*` |
| Short-lived sessions | Access token default 8h; `token_version` revoke | `backend/core/config.py`, `backend/core/security.py` |
| Least-privilege patient reads | `can_access_patient` / `ensure_patient_access` | `backend/core/deps.py`, reports/insights/triage |
| Login abuse resistance | In-memory throttle + soft lockout | `backend/services/login_throttle.py` |
| First-login binding | Temporary password required | `backend/schemas/auth.py`, auth services |
| Demo credential gate | `NEXT_PUBLIC_ENABLE_DEMO_LOGIN` | `frontend/lib/api.ts` |
| Mobile offline unlock | Salted PIN hash in SecureStore | `mobile/src/services/secureStore.ts` |
| MFA for clinicians | **Not implemented** (deferred) | — |

**Gaps:** browser tokens still in `localStorage` (XSS risk); no httpOnly cookie/BFF; MFA absent.

---

## Audit

| Control | BloomCare status | Where |
|---------|------------------|--------|
| PHI access events | Opt-in `audit_events` table | `BLOOMCARE_AUDIT_LOG_ENABLED`, `backend/services/audit_service.py` |
| Appointment status trail | Completed/cancelled by columns | appointments schema |
| Security logging hygiene | Avoid logging patient IDs / PINs | `ml_services.py`, mobile SecureStore |

**Gaps:** audit off by default for demos; no centralized SIEM export; not a full accounting of every PHI field read.

---

## Integrity

| Control | BloomCare status | Where |
|---------|------------------|--------|
| Password / OTP hashing | PBKDF2 passwords; HMAC OTPs | `backend/core/security.py`, `otp_service.py` |
| Triage dedupe hash | Content hash on sync (dedupe, not auth) | `backend/api/v1/triage.py` |
| Offline sync signing | Device-bound signed envelopes | `mobile/src/services/syncEnvelope.ts` |
| Offline queue at-rest | Encrypted AsyncStorage blobs + MAC | `mobile/src/services/queueCrypto.ts` |
| SQLite PHI cache | **Unencrypted** (documented) | Expo SQLite |

**Gaps:** server does not verify mobile MAC (intentional for demo client compatibility); SQLite not SQLCipher.

---

## Transmission

| Control | BloomCare status | Where |
|---------|------------------|--------|
| HTTPS expectation | Required on shared deploys (Vercel / Railway TLS) | Ops |
| CORS allow-list | Configurable `ALLOWED_ORIGINS` | `backend/main.py`, `backend/core/config.py` |
| CSP + browser headers | Next.js security headers | `frontend/next.config.mjs` |
| AI explain route | Requires Bearer; verifies via `/auth/profile` | `frontend/app/api/patient-explain/route.ts` |

**Gaps:** no mTLS; CSP remains demo-permissive (`unsafe-inline` / `unsafe-eval`).

---

## How to talk about this (interview)

> BloomCare maps access, audit, integrity, and transmission controls to concrete code paths. Security is treated as a staged program (P0 auth boundary → P1 clinical readiness → P2 maturity scanners/CSP/offline integrity), not a middleware checkbox. We do not claim HIPAA readiness without BAAs, ops, and formal assessment.

## Related

- [`SECURITY.md`](../SECURITY.md) — reporting + pen-test readiness checklist  
- Root [`README.md`](../README.md) — Security & Compliance Notes  
