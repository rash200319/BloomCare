# Register Once, Sync Many Architecture
## Mobile App Implementation Guide

### Overview
This implements a hybrid offline-first strategy where:
1. **Registration** requires internet and encrypts a JWT token
2. **Offline access** uses PIN-based login stored in SecureStore
3. **Background sync** automatically uploads pending data when internet returns

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (Expo/React Native)            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌─────────────┐    ┌────────────────┐│
│  │  LoginScreen │      │ Register    │    │ OfflineScreen  ││
│  │              │      │ Screen      │    │                ││
│  │ • Email+Pass │      │             │    │ • PIN Entry    ││
│  │ • Or PIN     │      │ • Email     │    │ • No Internet  ││
│  │   (offline)  │      │ • Password  │    │   Required     ││
│  │              │      │ • PIN (4-6) │    │                ││
│  └──────┬───────┘      └──────┬──────┘    └────────┬────────┘│
│         │                      │                     │        │
│         └──────────────────────┼─────────────────────┘        │
│                                │                              │
│        ┌───────────────────────▼────────────────────┐        │
│        │          AuthService                       │        │
│        │  ┌─────────────────────────────────────┐  │        │
│        │  │ • login(email, password)            │  │        │
│        │  │   → Requires Internet               │  │        │
│        │  │   → Gets JWT token from server      │  │        │
│        │  │                                     │  │        │
│        │  │ • register(email, pass, pin)        │  │        │
│        │  │   → Requires Internet               │  │        │
│        │  │   → Saves token securely            │  │        │
│        │  │                                     │  │        │
│        │  │ • loginWithPin(pin)                 │  │        │
│        │  │   → NO Internet Required ✓          │  │        │
│        │  │   → Checks PIN against SecureStore  │  │        │
│        │  │   → Grants offline access           │  │        │
│        │  │                                     │  │        │
│        │  │ • getStoredToken()                  │  │        │
│        │  │   → For background sync             │  │        │
│        │  └─────────────────────────────────────┘  │        │
│        └─────────────────┬────────────────────────┘        │
│                          │                                  │
│         ┌────────────────┼─────────────────┐               │
│         │                │                 │               │
│    ┌────▼────┐   ┌──────▼──────┐   ┌──────▼──────┐       │
│    │SecureStore      BackgroundSync    PatientData       │
│    │          │     │             │      │         │       │
│    │ Encrypted       │ • Monitor   │      │ • Store │       │
│    │ Storage:        │   Internet  │      │   Records      │
│    │                 │             │      │         │       │
│    │ • User ID       │ • Queue     │      │ • Retrieve    │
│    │ • Email         │   pending   │      │   (offline)   │
│    │ • Full Name     │   records   │      │               │
│    │ • Role          │             │      │ • Sync when   │
│    │ • JWT Token     │ • Auto-sync │      │   online      │
│    │ • PIN Hash      │   at 4G/    │      │               │
│    │                 │   Wi-Fi     │      │               │
│    │ More secure     │             │      │               │
│    │ than AsyncStore │ Uses stored │      │               │
│    │                 │ token for   │      │               │
│    │                 │ auth        │      │               │
│    └────────┘        └─────────────┘      └───────────────┘
│         │                  │                      │         │
└─────────┼──────────────────┼──────────────────────┼─────────┘
          │                  │                      │
┌─────────▼──────────────────▼──────────────────────▼─────────┐
│                 Azure PostgreSQL Backend                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ SQLServer with FastAPI                               │  │
│  │ • User Accounts (Encrypted JWT)                      │  │
│  │ • Screening Records                                  │  │
│  │ • Patient Profiles                                   │  │
│  │ • Sync Logs (timestamp tracking)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Workflow Flows

### 1. INITIAL REGISTRATION (First Time)
```
Midwife at Office with Wi-Fi
         │
         ▼
    Opens App
         │
         ▼
    Clicks "Register"
         │
         ├─ Enters: email, password, PIN (4-6 digits)
         │
         ▼
    App Sends to Backend:
    POST /api/v1/register
    {
      "email": "sister@hemas.lk",
      "password": "securepass123",
      "full_name": "Sister Chaminda",
      "role": "frontline_staff"
    }
         │
         ▼
    Backend Creates User + Returns:
    {
      "id": "user_xyz123",
      "email": "sister@hemas.lk",
      "full_name": "Sister Chaminda",
      "role": "frontline_staff"
    }
         │
         ▼
    App Auto-Logs In:
    POST /api/v1/login → Gets JWT Token
         │
         ▼
    SecureStore.saveSession(
      userId, email, fullName, role,
      encryptedJWT,
      pinHash  ← SHA-256 of "123456"
    )
         │
         ▼
    ✅ REGISTRATION COMPLETE
    Session stored in phone's encrypted vault
```

### 2. OFFLINE LOGIN (Rural Area, No Signal)
```
Midwife in Remote Village
No Internet ❌
         │
         ▼
    Opens App
         │
         ▼
    App checks: "Is there a saved session?"
    → YES, found in SecureStore
         │
         ▼
    App shows: "Enter PIN to access"
         │
         ▼
    Midwife enters: "123456"
         │
         ▼
    authService.loginWithPin(pin):
    1. Hash the entered PIN
    2. Compare to stored hash
    3. If match: ✅ GRANT ACCESS
       If no match: ❌ Invalid PIN
         │
         ▼
    ✅ LOGGED IN OFFLINE
    Can access Stage 1 screening tools
    Can record patient data locally
```

### 3. BACKGROUND SYNC (Back at Office/Wi-Fi)
```
Midwife Returns to Office
4G/Wi-Fi Connected ✓
         │
         ▼
    App Starts:
    backgroundSync.startMonitoring()
         │
         ▼
    (Every 30 seconds)
    Check: "Any pending records?"
         │
         ├─ YES: 5 screening records saved locally
         │
         ▼
    Get Stored Token from SecureStore:
    const token = await authService.getStoredToken()
         │
         ▼
    For each pending record:
    POST /api/v1/screening/save
    Headers: {
      "Authorization": "Bearer eyJhbGc..."
    }
    Body: { vitals, risk_score, recommendations }
         │
         ▼
    Server Validates Token → Updates Database
         │
         ▼
    ✅ RECORD SYNCED
    Mark as synced in local storage
         │
         ▼
    All 5 records uploaded ✓
    Data now in Azure PostgreSQL
```

---

## File Structure

```
mobile/src/services/
├── secureStore.ts          (NEW) Encrypted token storage
│   ├── saveSession()
│   ├── getSession()
│   ├── verifyPin()
│   ├── updateToken()
│   ├── clearSession()
│   └── getStoredToken()
│
├── authService.ts          (UPDATED) Register Once, Sync Many
│   ├── initializeAuth()      → Loads from SecureStore
│   ├── login()               → Email/pass, saves token
│   ├── register()            → Creates account + PIN
│   ├── loginWithPin()        → PIN-only offline login
│   ├── logout()              → Clears SecureStore
│   ├── getStoredToken()      → For background sync
│   ├── refreshToken()        → Server token refresh
│   └── isInOfflineMode()
│
├── backgroundSync.ts       (NEW) Auto-sync when online
│   ├── startMonitoring()     → Start 30-sec interval
│   ├── stopMonitoring()      → Stop checking
│   ├── queueScreeningRecord() → Add to pending
│   ├── getPendingCount()     → How many waiting?
│   ├── forceSync()           → User-triggered sync
│   └── clearPending()        → Clear queue
│
└── (other existing services...)
```

---

## Key Services

### 🔐 SecureStore Service
**Purpose**: Encrypted storage for JWT tokens and PIN hashes

**What it stores**:
```typescript
{
  userId: "user_xyz123",
  email: "sister@hemas.lk",
  fullName: "Sister Chaminda",
  role: "frontline_staff",
  token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",  // Encrypted in device vault
  pinHash: "a7e8f2c9b4d1e6f3...",                      // SHA-256(PIN)
  registeredAt: "2026-03-29T10:30:00Z"
}
```

**Why SecureStore over AsyncStorage?**
- AsyncStorage = Easy to hack, readable plaintext
- SecureStore = Uses device's native encryption (like iCloud Keychain on iOS)
- More secure for sensitive data like JWT tokens and PIN hashes

### 🔄 Background Sync Service
**Purpose**: Auto-upload pending records when internet is available

**How it works**:
1. Monitors connectivity every 30 seconds
2. When online detected:
   - Retrieves stored token from SecureStore
   - Fetches all pending records from AsyncStorage
   - POSTs each record to backend with token auth
   - Updates local storage to mark as synced
3. If sync fails, keeps record in queue for next attempt

**Usage in screens**:
```typescript
// When saving a screening in offline mode
await backgroundSync.queueScreeningRecord(
  patientName,
  vitals,
  riskScore,
  riskLevel,
  recommendations
);
// → Automatically syncs when online!
```

### 🔑 Auth Service Updates
**Three Login Methods**:

1. **Full Login** (requires internet)
   ```typescript
   const { user, token } = await authService.login({
     email: "sister@hemas.lk",
     password: "securepass123"
   });
   ```

2. **Registration** (requires internet, saves PIN)
   ```typescript
   const { user, token } = await authService.register({
     email: "sister@hemas.lk",
     password: "securepass123",
     full_name: "Sister Chaminda",
     role: "frontline_staff",
     pin: "123456"  // ← NEW
   });
   ```

3. **PIN Login** (offline only, NO internet needed)
   ```typescript
   const { user, token } = await authService.loginWithPin({
     pin: "123456"
   });
   ```

---

## Data Flow: Offline → Online Sync

```
Stage 1: User Offline
─────────────────────
Patient Assessment Form
         │
         ▼
Risk Calculated: HIGH
         │
         ▼
User clicks "SAVE RECORD"
         │
         ▼
backgroundSync.queueScreeningRecord(...)
         │
         ▼
Record saved to AsyncStorage:
{
  id: "1234567890_abc123",
  patientName: "Amara Kumari",
  vitals: {...},
  riskScore: 0.85,
  riskLevel: "HIGH",
  recommendations: [
    "Refer to hospital",
    "Monitor BP daily"
  ],
  timestamp: 1711771800000
}
         │
         ▼
UI shows: "✓ Record saved locally"
Local pending count: 1


Stage 2: Midwife at Wi-Fi
─────────────────────────
Connects to Hospital Wi-Fi
         │
         ▼
backgroundSync detects connection
         │
         ▼
Retrieves stored JWT token from SecureStore
         │
         ▼
For each pending record, sends:
POST /api/v1/screening/save
Authorization: Bearer <jwt_token>
Body: { vitals, risk_score... }
         │
         ▼
Server (FastAPI):
1. Validates JWT token signature
2. Extracts user ID from token
3. Creates screening record in PostgreSQL
4. Logs sync timestamp
5. Returns 200 OK
         │
         ▼
Record marked as synced in local storage
Pending count: 0
         │
         ▼
✅ DATABASE UPDATED
All data now in Azure PostgreSQL
```

---

## Installation Requirements

```bash
# Install SecureStore library
npx expo install expo-secure-store

# Required in app.json (already there):
{
  "plugins": ["expo-secure-store"]
}
```

---

## Usage Example: Complete Flow

```typescript
// App.tsx or main screen
import authService from './services/authService';
import backgroundSync from './services/backgroundSync';
import { useEffect, useState } from 'react';

export default function App() {
  const [user, setUser] = useState(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // 1. Initialize auth (loads stored session if exists)
    authService.initializeAuth().then(({ user, token, isOffline }) => {
      if (user) {
        setUser(user);
        setIsOffline(isOffline);
      }
    });

    // 2. Start background sync monitoring
    backgroundSync.startMonitoring();

    return () => {
      backgroundSync.stopMonitoring();
    };
  }, []);

  // LOGIN
  const handleLogin = async (email, password) => {
    try {
      const { user, token } = await authService.login({ email, password });
      setUser(user);
    } catch (error) {
      Alert.alert('Login failed', error.message);
    }
  };

  // REGISTER (with PIN for offline access)
  const handleRegister = async (email, password, fullName, role, pin) => {
    try {
      const { user, token } = await authService.register({
        email, password, full_name: fullName, role, pin
      });
      setUser(user);
    } catch (error) {
      Alert.alert('Registration failed', error.message);
    }
  };

  // OFFLINE LOGIN (PIN only)
  const handleOfflineLogin = async (pin) => {
    try {
      const { user, token } = await authService.loginWithPin({ pin });
      setUser(user);
      setIsOffline(true);
    } catch (error) {
      Alert.alert('Invalid PIN', error.message);
    }
  };

  // When saving a screening record
  const handleSaveScreening = async (vitals, riskScore, recommendations) => {
    // Queues for sync if offline, syncs immediately if online
    await backgroundSync.queueScreeningRecord(
      'Patient Name',
      vitals,
      riskScore,
      'HIGH',
      recommendations
    );
  };

  return (
    // Your app UI
    <>{/* App content */}</>
  );
}
```

---

## Security Considerations

1. **SecureStore**: Uses platform's native encryption
   - iOS: Keychain
   - Android: Android Keystore

2. **PIN Hashing**: SHA-256 in-memory only
   - PIN never stored plaintext
   - Hash compared, not the PIN itself

3. **Token Management**:
   - Stored encrypted in SecureStore
   - Used only for authenticated requests
   - Can be refreshed from server when online

4. **Data at Rest**: AsyncStorage for pending records
   - Less sensitive than tokens
   - Could encrypt with device password if needed

---

## Future Enhancements

1. **Token Refresh**: Implement server-side token refresh endpoint
2. **Selective Sync**: Let users choose which records to sync
3. **Conflict Resolution**: Handle duplicate records if synced twice
4. **P2P Sync**: Share data between midwives via Bluetooth
5. **Encryption**: Add AES encryption to pending records
6. **Audit Log**: Track all sync events for compliance

---

## Testing

```typescript
// Test offline login
describe('Offline Login', () => {
  it('should login with PIN when offline', async () => {
    // Register first
    await authService.register({
      email: 'test@example.com',
      password: 'pass123',
      full_name: 'Test User',
      role: 'frontline_staff',
      pin: '1234'
    });

    // Clear token to simulate offline
    authService.logout();

    // Login with PIN
    const { user } = await authService.loginWithPin({ pin: '1234' });
    expect(user).toBeDefined();
  });

  it('should reject invalid PIN', async () => {
    try {
      await authService.loginWithPin({ pin: '0000' });
      fail('Should have thrown');
    } catch (error) {
      expect(error.message).toBe('Invalid PIN');
    }
  });
});

// Test background sync
describe('Background Sync', () => {
  it('should queue records when offline', async () => {
    await backgroundSync.queueScreeningRecord(
      'Patient Name', {}, 0.8, 'HIGH', []
    );
    const count = await backgroundSync.getPendingCount();
    expect(count).toBe(1);
  });

  it('should sync records when online', async () => {
    const { synced } = await backgroundSync.forceSync();
    expect(synced).toBeGreaterThan(0);
  });
});
```

---

## Summary

✅ **Register Once**: User registers once with internet, gets encrypted JWT token
✅ **PIN Offline Access**: User can login offline with 4-6 digit PIN  
✅ **Secure Storage**: Token stored in device's encrypted vault (SecureStore)
✅ **Sync Many**: When internet returns, all pending records auto-upload using stored token
✅ **No API Calls Offline**: Complete offline functionality for screening assessments
✅ **Automatic**: Sync happens in background, no user interaction needed

This architecture provides healthcare workers in remote areas with:
- ✓ Works without internet
- ✓ Simple PIN login
- ✓ No password re-entry needed
- ✓ Automatic data sync when connected
- ✓ Secure token storage
