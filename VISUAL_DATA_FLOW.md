# Visual Data Flow: Register Once, Sync Many

## Timeline Diagram

```
DAY 1: REGISTRATION (At Office with Internet)
═══════════════════════════════════════════

[Midwife]
    │
    ├─ Registers at app
    │  ├─ Email: sister@hemas.lk
    │  ├─ Password: securepass123
    │  ├─ Full Name: Sister Chaminda
    │  ├─ Role: frontline_staff
    │  └─ PIN: 123456
    │
    ├─ Backend validates → Creates user
    │
    ├─ Backend generates → JWT Token (encrypted)
    │
    ├─ App receives user + token
    │
    └─ SecureStore locks it down
       ┌─────────────────────────────┐
       │ 🔐 ENCRYPTED VAULT          │
       ├─────────────────────────────┤
       │ userId: user_xyz123         │
       │ email: sister@hemas.lk      │
       │ fullName: Sister Chaminda   │
       │ role: frontline_staff       │
       │ token: eyJhbGc... (JWT)     │
       │ pinHash: a7e8f2... (SHA256) │
       │ registeredAt: 2026-03-29    │
       └─────────────────────────────┘
              ↑
              │
         [Phone Internal Storage]
         Much more secure than browser localStorage


DAY 2-7: WORKING OFFLINE (Rural Village)
════════════════════════════════════════

[Midwife in Remote Area]
    ├─ Opens app (no internet)
    │
    ├─ App checks: "SecureStore have a session?"
    │  └─ YES! Found one
    │
    ├─ "Enter PIN for access"
    │  └─ Enters: 123456
    │
    ├─ App hashes PIN → Compares with stored hash
    │  └─ ✓ MATCH!
    │
    └─ LOGGED IN OFFLINE
       │
       ├─ Can use Stage 1 screening tools
       │
       ├─ Creates screening for Patient A
       │  ├─ Vitals: BP 120/80, HR 78, Temp 36.8
       │  ├─ Risk: HIGH
       │  └─ backgroundSync.queueScreeningRecord()
       │       │
       │       └─ Stored locally:
       │          ┌──────────────────────────┐
       │          │ AsyncStorage             │
       │          │ PENDING RECORDS: [1]     │
       │          ├──────────────────────────┤
       │          │ Record ID: 1234567_abc   │
       │          │ Patient: Amara Kumari    │
       │          │ Risk Score: 0.85         │
       │          │ Risk Level: HIGH         │
       │          │ Timestamp: 1711771800   │
       │          │ Synced: false            │
       │          └──────────────────────────┘
       │
       ├─ Creates screening for Patient B
       │  └─ Stored in AsyncStorage [2 pending]
       │
       ├─ Creates screening for Patient C
       │  └─ Stored in AsyncStorage [3 pending]
       │
       └─ UI shows: "✓ 3 records saved locally"


DAY 8: BACK AT OFFICE (Hospital with Wi-Fi)
══════════════════════════════════════════

[Midwife Reconnects]
    │
    ├─ Connects to Wi-Fi
    │
    ├─ backgroundSync.startMonitoring() detects it
    │
    └─ AUTO-SYNC BEGINS
       │
       ├─ Get all pending records from AsyncStorage [3]
       │
       ├─ Get stored token from SecureStore
       │  └─ eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       │
       ├─ For RECORD 1 (Amara Kumari):
       │  │
       │  └─ POST /api/v1/screening/save
       │     Headers: {
       │       "Authorization": "Bearer eyJ..."
       │     }
       │     Body: {
       │       "patient_name": "Amara Kumari",
       │       "vitals": {...},
       │       "risk_score": 0.85,
       │       "risk_level": "HIGH",
       │       "recommendations": [...]
       │     }
       │     │
       │     └─ Server validates token ✓
       │        │
       │        └─ Inserts to PostgreSQL
       │           ┌─────────────────────────┐
       │           │ Azure PostgreSQL        │
       │           │ screening_records       │
       │           ├─────────────────────────┤
       │           │ id: 1001                │
       │           │ patient_name: Amara ...│
       │           │ created_at: now()       │
       │           │ risk_score: 0.85        │
       │           │ synced_at: now()        │
       │           └─────────────────────────┘
       │
       ├─ For RECORD 2 (Patient B): [SYNCED ✓]
       │  └─ Same process, inserted to DB
       │
       ├─ For RECORD 3 (Patient C): [SYNCED ✓]
       │  └─ Same process, inserted to DB
       │
       └─ Update AsyncStorage
          ┌──────────────────────────┐
          │ AsyncStorage             │
          │ PENDING RECORDS: [0]     │
          │                          │
          │ (All cleared - synced)   │
          └──────────────────────────┘


RESULT: Database is Updated ✓
═════════════════════════════

Server now has 3 new screening records:
✓ Amara Kumari - HIGH RISK
✓ Patient B - Result
✓ Patient C - Result

All synced using the stored JWT token from Day 1!
```

---

## Component Data Flow Diagram

```
┌─────────────────────┐
│   LoginScreen       │
└─────────────────────┘
    │              │
    │ Mode: Email  │ Mode: PIN
    │              │
    ▼              ▼
authService.  authService.
login()       loginWithPin()
(needs        (offline OK)
internet)     
    │              │
    │ ✓            │ ✓
    └──────┬───────┘
           │
           ▼
    ┌─────────────────┐
    │  authService    │
    │  (maintained    │
    │   in memory)    │
    └────────┬────────┘
             │
             ├─ token (active)
             └─ user (active)
             
             │
             ├─────┬────────┬──────────┐
             │     │        │          │
             ▼     ▼        ▼          ▼
          [Dash] [Staff]  [Patient]  [Admin]
           board  Screen   Portal     Panel
           
             │
             ├──── All screens can:
             │     1. Access user data (memory)
             │     2. Queue records (backgroundSync)
             │     3. Check offline status
             │
             └─────────────┬─────────────┘
                           │
                           ▼
            ┌──────────────────────────┐
            │  backgroundSync Service  │
            │                          │
            │ • Queue screening record │
            │ • Monitor internet       │
            │ • Auto-sync when online  │
            │ • Use stored token       │
            └────────────┬─────────────┘
                         │
                         ├─────────────────┐
                         │                 │
                         ▼                 ▼
                    AsyncStorage      SecureStore
                    (pending data)    (JWT token)
                         │                 │
                         │                 │
                    [Readable by     [Encrypted
                     anyone on       by OS]
                     device]
                    
                         │                 │
                         └─────────┬───────┘
                                   │
                    ┌──────────────┴──────────┐
                    │ When Internet Detected  │
                    └──────────────┬──────────┘
                                   │
                      ┌────────────▼──────────────┐
                      │  Get pending records      │
                      │  from AsyncStorage        │
                      └────────────┬──────────────┘
                                   │
                      ┌────────────▼──────────────┐
                      │  Get token from           │
                      │  SecureStore              │
                      └────────────┬──────────────┘
                                   │
                      ┌────────────▼──────────────┐
                      │ POST records with         │
                      │ Authorization: Bearer...  │
                      └────────────┬──────────────┘
                                   │
                      ┌────────────▼──────────────┐
                      │ Server validates token    │
                      │ + inserts to PostgreSQL   │
                      └────────────┬──────────────┘
                                   │
                      ┌────────────▼──────────────┐
                      │ Clear AsyncStorage pending│
                      │ Mark as synced           │
                      └──────────────────────────┘
```

---

## State Machine: Auth States

```
┌──────────────────────┐
│   App Initialized    │
│   No Session Found   │
└──────────────┬───────┘
               │
        ┌─────▼─────┐
        │ UNAUTHENTI│
        │ CATED     │
        └─────┬─────┘
              │
    ┌─────────┴──────────┐
    │                    │
    ▼ (Email/Pass)       ▼ (PIN - offline)
 ┌──────────┐        ┌─────────────┐
 │ Fetch    │        │ Check Secure│
 │ Server   │        │ Store has   │
 │ Needs    │        │ session?    │
 │Internet! │        │ (local OK) │
 └────┬─────┘        └──────┬──────┘
      │                     │
      │ ✓                   ▼ ✓
      │              ┌──────────────┐
      │              │ Hash PIN &   │
      │              │ compare      │
      │              └──────┬───────┘
      │                     │
      └──────────┬──────────┘
                 │
                 ▼
         ┌─────────────────┐
         │ AUTHENTICATED   │
         │ Token in Memory │
         │ User in Memory  │
         └────────┬────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
   (Online Mode)        (Offline Mode)
        │                    │
        ▼                    ▼
   ✓ API calls         ✗ No API calls
   ✓ Sync immediately  ✓ Queue records
   ✓ Real-time data    ✓ Local access
                       ✓ Auto-sync when online
                  │
                  ▼
         ┌─────────────────┐
         │ LOGOUT          │
         │ Clear SecureStore
         │ Clear token    
         │ Clear user
         └────────┬────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ UNAUTHENTICATED │
         └─────────────────┘
```

---

## Security Layer Comparison

```
BEFORE (AsyncStorage Only)
═════════════════════════
┌─────────────────────────┐
│ AsyncStorage            │
│ ┌──────────────────────┐│
│ │ Token: eyJhbGc...    ││ ← Visible in plaintext!
│ │ User: {id: 123...}   ││    Anyone with file access
│ │ PIN: 123456          ││    can read these
│ └──────────────────────┘│
└─────────────────────────┘
   ▲
   │ Vulnerable to:
   ├─ USB file access
   ├─ Jailbroken phone inspection
   ├─ Forensic recovery
   └─ Backup exposure


AFTER (SecureStore + AsyncStorage Hybrid)
══════════════════════════════════════════

🔐 SecureStore (ENCRYPTED)
══════════════════════════
┌─────────────────────────┐
│ 🔒 ENCRYPTED VAULT      │
│ ┌──────────────────────┐│
│ │ Token: [ENCRYPTED]   ││ ← Protected by OS encryption
│ │ User: [ENCRYPTED]    ││    iOS: Keychain
│ │ PIN Hash: [HASHED]   ││    Android: KeyStore
│ │ Can't be read!       ││
│ └──────────────────────┘│
└─────────────────────────┘


📝 AsyncStorage (UNENCRYPTED - but safe)
═════════════════════════════════════════
┌──────────────────────────┐
│ Pending Records (NOT sensitive)
│ ┌───────────────────────┐│
│ │ Record: {             ││ ← Contains:
│ │   patientName: "X...", ││    Only patient data
│ │   vitals: {...},      ││    (no secrets here)
│ │   riskScore: 0.85,    ││    Less sensitive
│ │   synced: false       ││
│ │ }                     ││
│ └───────────────────────┘│
└──────────────────────────┘

Why this is OK:
- Pending records don't contain the token
- Pending records contain patient data which
  wouldn't be on phone anyway in production
- Token (the actual secret) is encrypted
```

---

## Sync Queue Status Display (UX Example)

```
HOME SCREEN - STATUS BAR
════════════════════════

┌──────────────────────────────────┐
│ 📡 Offline Mode                  │  ← When no internet
├──────────────────────────────────┤
│ ⟳ Syncing: 3 records            │  ← During background sync
├──────────────────────────────────┤
│ ✓ In Sync                        │  ← All records synced
├──────────────────────────────────┤
│ ⚠ Can't Sync: 2 failed           │  ← Some failed
│ (tap to retry)                   │
└──────────────────────────────────┘


PENDING RECORDS VIEW
════════════════════

Screening Records (Offline)
──────────────────────────

Saved Locally - Will Sync:
├─ 📋 Amara Kumari - Mar 29
│  └─ HIGH RISK (0.85)
│
├─ 📋 Zahira Mohamed - Mar 29
│  └─ LOW RISK (0.42)
│
└─ 📋 Nirmala Perera - Mar 29
   └─ HIGH RISK (0.78) - ⚠ Refer to Hospital


Synced to Server:
├─ ✓ Maya Sharma - Mar 28
├─ ✓ Lakshmi Reddy - Mar 28
└─ ✓ Priya Verma - Mar 27


[Retry Sync]  [Clear Local Data]
```

---

## Backend Integration Requirements

```
YOUR BACKEND (Azure + PostgreSQL)
════════════════════════════════

REQUIRED ENDPOINTS:

1. POST /api/v1/register
   Input: {email, password, full_name, role}
   Output: {id, email, full_name, role, is_active}
   Status: 200 OK

2. POST /api/v1/login
   Input: {username, password} (form-urlencoded)
   Output: {access_token, token_type}
   Status: 200 OK

3. POST /api/v1/screening/save
   Headers: Authorization: Bearer <token>
   Input: {patient_name, vitals, risk_score, risk_level, recommendations}
   Output: {id, created_at, synced_at}
   Status: 200 OK

4. GET /api/v1/users/me
   Headers: Authorization: Bearer <token>
   Output: {id, email, full_name, role, is_active}
   Status: 200 OK


IMPLEMENTATION NOTES:

- Token should be JWT format
- Token should expire (recommend 30-90 days)
- Support token refresh endpoint
- Log all sync attempts in database
- Track sync_at timestamps for reconciliation
- Handle duplicate records (same timestamp + patient)


DATABASE SCHEMA ADDITIONS:

CREATE TABLE sync_logs (
  id INT PRIMARY KEY,
  user_id VARCHAR(255),
  record_count INT,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20),  -- 'success' or 'failed'
  error_message TEXT
);
```

---

## Testing Checklist

```
OFFLINE LOGIN TEST
══════════════════
☐ Register user with email/pass/pin (with internet)
☐ Confirm "Account created" message
☐ Disable internet
☐ Reopen app
☐ App shows "PIN Login" option
☐ Enter correct PIN → Login succeeds
☐ Logout and try wrong PIN → Login fails
☐ Verify user can access all screens offline


OFFLINE SCREENING TEST
══════════════════════
☐ Login with PIN (offline)
☐ Create screening record for Patient A
☐ Confirm "Saved locally" message
☐ Create screening record for Patient B
☐ Verify pending count shows "2 records"
☐ Disable camera/network
☐ Can still create more records


BACKGROUND SYNC TEST
════════════════════
☐ Have 3 pending records created offline
☐ Enable internet
☐ APP AUTOMATICALLY detects internet
☐ See "⟳ Syncing..." indicator
☐ After 30 seconds max, see "✓ 3 synced"
☐ Check PostgreSQL: Records in database
☐ Verify timestamps match creation time


END-TO-END TEST
═══════════════
☐ Day 1: Register at office (internet on)
  - Email: test@example.com
  - Password: Test123!
  - PIN: 1234
  
☐ Day 2: Work offline (internet off)
  - Create 5 screening records
  - See pending count = 5
  
☐ Day 3: Sync at office (internet on)
  - All 5 records auto-sync
  - See "✓ 5 synced"
  - Check DB: All 5 records present
  
  ✓ SUCCESS! Offline-first workflow complete!
```
