# BloomCare Mobile: Offline-First Architecture Guide

## Overview

The BloomCare mobile app is now built with **offline-first architecture**, allowing both patients and frontline staff to work effectively without internet connection after an initial online login.

### Key Principle
- **First Login**: Must be ONLINE (email/password for staff, national_id/password for patients)
- **Offline Access**: PIN-based (4-6 digits) - no internet needed
- **Data Sync**: Automatic background sync when connection returns

---

## User Workflows

### 1. Patient Workflow

#### First-Time Setup (Online Required)
```
1. Open app
2. Select "Patient" role
3. Enter National ID + Password (backend validates)
4. Prompted to create 4-6 digit PIN for offline access
5. PIN confirmed, offline mode activated
6. Patient data synced to local database
```

#### Subsequent Access (Online or Offline)
```
Online:
- App automatically syncs appointments, insights, screening history
- User can record new vitals immediately
- All pending changes uploaded to server

Offline:
- Enter PIN (no internet needed)
- Access cached appointments, insights, history
- Record vitals locally (queued for upload)
- Apps shows "🔴 Offline" badge
```

#### Data Available Offline
- Personal appointments (upcoming & past)
- Health insights and recommendations
- Complete screening history
- Pregnancy information (due date, weeks)

### 2. Frontline Staff Workflow

#### First-Time Setup (Online Required)
```
1. Open app
2. Select "Frontline Staff" role
3. Enter Email + Password (backend validates)
4. Create 4-6 digit PIN for offline access
5. PIN confirmed, morning sync begins
6. Assigned patients list downloaded
7. Each patient's recent screening history (10 records) cached
```

#### Morning Sync (Online Required)
```
- Automatically downloads all assigned patients for the day
- Caches patient mini-profiles (name, age, gestation weeks, risk level)
- Caches 10 recent screenings per patient
- Logs sync completion
- App ready for offline use
```

#### Offline Patient Screening
```
1. Search for patient in offline list
2. View patient details and recent screening history
3. Record new vital signs
4. Stage-1 AI model runs locally (JavaScript)
5. Risk assessment completed
6. Data queued for upload
```

#### Sync Pending Data (When Online Returns)
```
- All queued screenings/vitals automatically uploaded
- Server responses cached locally
- UI confirms successful sync
```

---

## Architecture Components

### 1. Core Services

#### `authService.ts`
- **loginStaff()**: Staff email/password login
- **loginPatient()**: Patient national_id/password login
- **loginWithPin()**: Offline PIN-based login
- **setPinForOfflineAccess()**: Create PIN after first login
- **updatePin()**: Change PIN later

#### `networkStatusService.ts`
- Monitors device connectivity in real-time
- Provides `subscribe()` for UI updates
- `waitForOnline()`: Wait for connection (with timeout)
- `getStatus()`: Check current connection

#### `offlineDatabase.ts` (SQLite)
- **User Profile Cache**: Current user info
- **Patient Profiles**: Staff's assigned patients
- **Appointments**: Patient appointments/visits
- **Insights**: Recommendations and health guidance
- **Screening History**: Complete vitals history
- **Pending Syncs**: Queued operations (create, update, delete)
- **Sync Log**: Historical sync records

#### `dataSyncService.ts`
- `syncPatientAppointments()`: Download patient appointments
- `syncPatientInsights()`: Download personalized insights
- `syncPatientScreeningHistory()`: Download screening records
- `syncAssignedPatients()`: Download staff's patient list
- `uploadPendingVitals()`: Upload queued screenings/vitals
- `backgroundSync()`: Comprehensive sync based on role

#### `backgroundSyncService.ts`
- Initializes on app start
- Monitors network status
- Auto-syncs every 60 seconds when online
- Provides `forceSync()` for manual sync
- Stops cleanly on logout

#### `patientOperationsService.ts`
- `getAppointments()`: Read appointments (sync-aware)
- `getUpcomingAppointments()`: Filter upcoming only
- `getInsights()`: Read insights
- `getScreeningHistory()`: Read screening records
- `getLatestScreening()`: Get most recent screening
- `recordVitals()`: Add new vitals (queues if offline)
- `syncPending()`: Sync all pending operations

#### `frontlineStaffOperationsService.ts`
- `performMorningSync()`: Download assigned patients
- `getAssignedPatients()`: Read all assigned patients
- `searchPatients()`: Search by name/NIC/contact
- `getPatientDetails()`: Read patient profile
- `getPatientScreeningHistory()`: Read patient's screenings
- `submitPatientVitals()`: Record vitals (offline-safe)
- `createPatientScreening()`: Submit screening (offline-safe)
- `syncPendingOperations()`: Upload queued data

### 2. Updated Screens

#### `LoginScreen.tsx` - NEW MULTI-STEP FLOW
```
Role Selection
  → Patient Path: National ID + Password
  → Frontline Staff Path: Email + Password
  ↓
PIN Setup: Create 4-6 digit PIN
  ↓
Success: Logged in, background sync starts

Offline Path (if already registered):
  → PIN-only login
  → No internet needed
```

#### `PatientPortalScreen.tsx` - UPDATES NEEDED
- Display online/offline status badge
- Add "Sync Now" button (if online)
- "Last Synced" timestamp
- Record vitals button (works offline)
- Appointments: Sync before showing, fallback to cache
- Insights: Sync before showing, fallback to cache
- Screening history: Load from cache, show pending upload count

#### `FrontlineStaffScreen.tsx` - UPDATES NEEDED
- Display "Morning Sync Status"
- Show pending operations count
- "Search Patients" (searches offline cache)
- "Sync Now" button (uploads pending, resyncs patients)
- Patient list shows cached data
- Screening UI shows pending upload status

---

## Database Schema (SQLite)

### Tables Created

```sql
user_profile
  - user_id (PK)
  - email
  - full_name
  - role (patient | frontline_staff)
  - is_active
  - cached_at

patient_profiles
  - patient_id (PK)
  - national_id (UNIQUE)
  - full_name
  - age
  - due_date
  - contact_number
  - emergency_contact
  - blood_group
  - assigned_worker_id
  - risk_level
  - last_screening_at
  - created_at, updated_at

appointments
  - appointment_id (PK)
  - patient_id (FK)
  - title
  - description
  - scheduled_for
  - appointment_type
  - status
  - created_at, updated_at

insights
  - insight_id (PK)
  - patient_id (FK)
  - title
  - content
  - insight_type
  - created_at, updated_at

screening_history
  - screening_id (PK)
  - patient_id (FK)
  - vitals_json (JSON blob)
  - risk_level
  - risk_score
  - recommendations (JSON)
  - created_at, updated_at

pending_syncs
  - record_id (PK)
  - entity_type (screening | vitals | appointment | etc)
  - operation (create | update | delete)
  - patient_id (FK)
  - payload_json (JSON)
  - created_at
  - synced_at
  - sync_status (pending | synced | failed)

sync_log
  - sync_id (PK)
  - user_id (FK)
  - sync_type (patient_full_sync | staff_morning_sync | etc)
  - synced_records (count)
  - synced_at
  - duration_ms
  - error_message (nullable)
```

---

## API Integration (No Backend Changes)

All existing backend APIs remain unchanged. Mobile app:
1. Calls existing APIs when online
2. Caches responses in SQLite
3. Queues operations (pending_syncs table)
4. Uploads queues on next online window

### Endpoints Used (Unchanged)
- `POST /auth/login/patient`
- `POST /auth/login/staff`
- `GET /patients?patient_id=X` or `GET /patients/assigned`
- `GET /appointments?patient_id=X`
- `GET /insights?patient_id=X`
- `GET /screening/history?patient_id=X`
- `POST /screening` (vitals submission)
- `POST /patients/{id}/vitals` (alternative vitals endpoint)

---

## Implementation Checklist

### Phase 1: Core Infrastructure ✅ DONE
- [x] `offlineDatabase.ts` - SQLite schema & CRUD
- [x] `networkStatusService.ts` - Network monitoring
- [x] `authService.ts` - Online & offline login
- [x] `dataSyncService.ts` - Data sync endpoints
- [x] `backgroundSyncService.ts` - Auto-sync on network change
- [x] `patientOperationsService.ts` - Patient data access
- [x] `frontlineStaffOperationsService.ts` - Staff operations
- [x] `App.tsx` - Initialize services on startup
- [x] `LoginScreen.tsx` - New multi-step login flow

### Phase 2: UI Updates (IN PROGRESS)
- [ ] Update `PatientPortalScreen.tsx`:
  - [ ] Add offline/online status indicator
  - [ ] Add "Last Synced" timestamp
  - [ ] Add manual sync button
  - [ ] Update appointment fetching to use `patientOperationsService`
  - [ ] Update insights fetching to use `patientOperationsService`
  - [ ] Add pending operations counter
  - [ ] Disable online-only features when offline

- [ ] Update `FrontlineStaffScreen.tsx`:
  - [ ] Add morning sync status
  - [ ] Add pending operations counter
  - [ ] Update patient list search to use offline cache
  - [ ] Update screening submission to use `frontlineStaffOperationsService`
  - [ ] Add manual sync button
  - [ ] Show pending upload count

### Phase 3: Testing
- [ ] Test patient login → PIN setup flow
- [ ] Test staff login → morning sync → offline screening
- [ ] Test background sync on network reconnect
- [ ] Test pending upload sync
- [ ] Test offline PIN login
- [ ] Test data persistence across app restart
- [ ] Test network interruption handling

### Phase 4: Optimization
- [ ] Add data retention policies (keep last 30 days?)
- [ ] Add compression for large sync payloads
- [ ] Add bandwidth-aware sync strategies
- [ ] Add user-facing sync progress indicators
- [ ] Monitor and optimize database queries

---

## Code Usage Examples

### Patient Recording Vitals (Works Offline)
```javascript
import patientOperationsService from './services/patientOperationsService';

const vitals = {
  systolic: 120,
  diastolic: 80,
  heart_rate: 72,
  // ... other vitals
};

const { recordId, synced } = await patientOperationsService.recordVitals(
  patientId,
  vitals
);

if (synced) {
  showMessage('Vitals uploaded successfully');
} else {
  showMessage('Vitals saved. Will upload when online.');
}
```

### Staff Submitting Screening (Works Offline)
```javascript
import frontlineStaffOperationsService from './services/frontlineStaffOperationsService';

const { recordId, queued } = await frontlineStaffOperationsService.createPatientScreening(
  patientId,
  vitals,
  'low',     // risk_level
  0.25,      // risk_score
  ['Recommendation 1', 'Recommendation 2']
);

if (!queued) {
  showMessage('Screening uploaded!');
} else {
  showMessage('Screening saved for upload');
}
```

### Forced Sync Button
```javascript
import backgroundSyncService from './services/backgroundSyncService';

const handleSyncNow = async () => {
  const result = await backgroundSyncService.forceSync();
  if (result.success) {
    showMessage(result.message);
  } else {
    showAlert('Sync failed: ' + result.message);
  }
};
```

---

## Offline Data Limitations

### Patient Can Access Offline
- ✅ Appointments (downloaded at login)
- ✅ Insights (downloaded at login)
- ✅ Screening history
- ✅ Record new vitals
- ✅ View pregnancy info

### Staff Can Access Offline
- ✅ Assigned patient list (from morning sync)
- ✅ Patient screening history
- ✅ Record new screenings
- ✅ Search patients by name/NIC
- ✅ Run Stage-1 AI locally (already on device)

### NOT Available Offline
- ❌ Create new patient (needs server-side validation)
- ❌ Patient list search beyond morning-synced patients
- ❌ Real-time twin-to-server data
- ❌ Admin/clinical specialist features
- ❌ Message/chat features

---

## Security Notes

- **PIN Storage**: Hashed in SecureStore, never plain text
- **Token Storage**: JWT token in SecureStore (encrypted at rest)
- **SQLite Database**: Unencrypted on-device (typical for mobile)
  - Mitigation: Use encrypted SQLite package for sensitive deployments
- **Network**: SSL/TLS for all server communications (unchanged)

---

## Next Steps

1. **UI Implementation**: Update patient & staff screens with offline indicators
2. **Testing**: Run offline scenarios, network reconnection, sync verification
3. **Optimization**: Monitor sync performance, database size, battery usage
4. **Deployment**: Beta test with real field staff, gather feedback
5. **Monitoring**: Set up analytics for sync success/failure rates

---

## Support & Troubleshooting

### User Can't Login Online
- Check internet connection (network status shown on login screen)
- Verify backend is running
- Check credentials match backend (email/national_id)

### User Can't Login Offline
- No previous online login (PIN not created)
- Wrong PIN entered (try again)
- Stale app data (clear app, re-login online)

### Sync Not Working
- Check network connection
- Ensure token is still valid
- Check backend endpoints are accessible
- Look for error message in background sync logs

### Mobile Database Full
- Clear old screening data (> 30 days)
- Clear unsynced pending operations
- Force rebuild of cache on next online session

---

**Version**: 1.0  
**Last Updated**: 2026-04-02  
**Status**: Implementation in Progress
