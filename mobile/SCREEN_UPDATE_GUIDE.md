# Screen Update Guide: Integrating Offline Functionality

## Overview
This document provides step-by-step instructions for updating the remaining screens to integrate offline support.

---

## 1. PatientPortalScreen.tsx Updates

### Current State
- Shows hardcoded mock data for appointments, health checks, insights

### Required Changes

#### 1.1 Add Offline Status Header
```tsx
interface PatientPortalScreenProps {
  user: User;
  onLogout: () => void;
  isOnline: boolean;  // NEW: passed from App.tsx
}

// Add at the top of render:
<View style={styles.statusBar}>
  <Text style={[styles.statusText, { color: isOnline ? '#16a34a' : '#ea580c' }]}>
    {isOnline ? '🟢 Online' : '🔴 Offline'}
  </Text>
  {isOnline && lastSyncTime && (
    <Text style={styles.syncTimeText}>
      Last synced: {formatTime(lastSyncTime)}
    </Text>
  )}
  {isOnline && (
    <Pressable onPress={handleSyncNow} style={styles.syncButton}>
      <Text style={styles.syncButtonText}>↻ Sync</Text>
    </Pressable>
  )}
</View>
```

#### 1.2 Replace Mock Appointments with Offline-Safe Fetching
```tsx
import patientOperationsService from '../services/patientOperationsService';

const [appointments, setAppointments] = useState<CachedAppointment[]>([]);
const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

useEffect(() => {
  const loadAppointments = async () => {
    setIsLoadingAppointments(true);
    try {
      const data = await patientOperationsService.getUpcomingAppointments(user.id);
      setAppointments(data);
    } catch (error) {
      console.error('Failed to load appointments:', error);
    } finally {
      setIsLoadingAppointments(false);
    }
  };

  loadAppointments();
}, [user.id, selectedTab]);
```

#### 1.3 Replace Mock Insights with Offline-Safe Fetching
```tsx
import patientOperationsService from '../services/patientOperationsService';

const [insights, setInsights] = useState<CachedInsight[]>([]);
const [isLoadingInsights, setIsLoadingInsights] = useState(false);

useEffect(() => {
  const loadInsights = async () => {
    setIsLoadingInsights(true);
    try {
      const data = await patientOperationsService.getInsights(user.id);
      setInsights(data);
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  loadInsights();
}, [user.id, selectedTab]);
```

#### 1.4 Add Screening History Tab
```tsx
// Add to tab navigation
const [selectedTab, setSelectedTab] = useState<'home' | 'history' | 'resources' | 'screenings'>('home');

const [screeningHistory, setScreeningHistory] = useState<CachedScreening[]>([]);
const [isLoadingScreenings, setIsLoadingScreenings] = useState(false);

useEffect(() => {
  if (selectedTab === 'screenings') {
    const loadScreenings = async () => {
      setIsLoadingScreenings(true);
      try {
        const data = await patientOperationsService.getScreeningHistory(user.id);
        setScreeningHistory(data);
      } catch (error) {
        console.error('Failed to load screenings:', error);
      } finally {
        setIsLoadingScreenings(false);
      }
    };

    loadScreenings();
  }
}, [user.id, selectedTab]);
```

#### 1.5 Handle Offline Case in Add Vitals
```tsx
const handleRecordVitals = async (vitals: any) => {
  try {
    const { recordId, synced } = await patientOperationsService.recordVitals(user.id, vitals);
    
    if (synced) {
      Alert.alert('Success', 'Vitals recorded and uploaded');
    } else {
      Alert.alert('Saved Offline', 'Vitals will be uploaded when online');
    }
  } catch (error) {
    Alert.alert('Error', 'Failed to record vitals');
  }
};
```

#### 1.6 Add Sync Now Handler
```tsx
import backgroundSyncService from '../services/backgroundSyncService';

const [isSyncing, setIsSyncing] = useState(false);
const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

const handleSyncNow = async () => {
  if (!isOnline) {
    Alert.alert('Offline', 'Please check your connection');
    return;
  }

  setIsSyncing(true);
  try {
    const result = await backgroundSyncService.forceSync();
    if (result.success) {
      setLastSyncTime(new Date().toISOString());
      Alert.alert('Sync Complete', result.message);
    } else {
      Alert.alert('Sync Failed', result.message);
    }
  } finally {
    setIsSyncing(false);
  }
};
```

---

## 2. FrontlineStaffScreen.tsx Updates

### Current State
- Shows hardcoded patient list
- No vitals submission interface

### Required Changes

#### 2.1 Add Morning Sync Status
```tsx
interface FrontlineStaffScreenProps {
  user: User;
  onLogout: () => void;
  isOnline: boolean;  // NEW: passed from App.tsx
}

const [morningsyncStatus, setMorningsyncStatus] = useState<'idle' | 'syncing' | 'complete' | 'failed'>('idle');
const [patientCount, setPatientCount] = useState(0);

useEffect(() => {
  const performMorningSync = async () => {
    if (!isOnline) return;

    setMorningyncStatus('syncing');
    try {
      const result = await frontlineStaffOperationsService.performMorningSync(user.id);
      if (result.success) {
        setPatientCount(result.patientCount);
        setMorningyncStatus('complete');
      } else {
        setMorningyncStatus('failed');
      }
    } catch (error) {
      console.error('Morning sync failed:', error);
      setMorningyncStatus('failed');
    }
  };

  performMorningSync();
}, [user.id, isOnline]);

// Display status
<View style={styles.syncStatusBar}>
  <Text style={styles.statusText}>
    {morningyncStatus === 'syncing' && '⏳ Syncing patients...'}
    {morningyncStatus === 'complete' && `✅ ${patientCount} patients ready`}
    {morningyncStatus === 'failed' && '❌ Sync failed, using cached data'}
    {morningyncStatus === 'idle' && '⚙️ Initializing...'}
  </Text>
</View>
```

#### 2.2 Replace Mock Patient List with Offline-Safe Fetching
```tsx
import frontlineStaffOperationsService from '../services/frontlineStaffOperationsService';

const [patients, setPatients] = useState<any[]>([]);
const [filteredPatients, setFilteredPatients] = useState<any[]>([]);
const [searchQuery, setSearchQuery] = useState('');
const [isLoadingPatients, setIsLoadingPatients] = useState(false);

useEffect(() => {
  const loadPatients = async () => {
    setIsLoadingPatients(true);
    try {
      const data = await frontlineStaffOperationsService.getAssignedPatients();
      setPatients(data);
      setFilteredPatients(data);
    } catch (error) {
      console.error('Failed to load patients:', error);
    } finally {
      setIsLoadingPatients(false);
    }
  };

  loadPatients();
}, [selectedTab]);

const handleSearchPatients = async (query: string) => {
  setSearchQuery(query);
  if (!query.trim()) {
    setFilteredPatients(patients);
    return;
  }

  try {
    const results = await frontlineStaffOperationsService.searchPatients(query);
    setFilteredPatients(results);
  } catch (error) {
    console.error('Search failed:', error);
  }
};
```

#### 2.3 Add Patient Screening Interface
```tsx
const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
const [screeningData, setScreeningData] = useState<any>(null);
const [patientScreeningHistory, setPatientScreeningHistory] = useState<any[]>([]);
const [riskAssessment, setRiskAssessment] = useState<any | null>(null);
const [isSubmittingScreening, setIsSubmittingScreening] = useState(false);

const handlePatientSelect = async (patient: any) => {
  setSelectedPatient(patient);
  
  try {
    const history = await frontlineStaffOperationsService.getPatientScreeningHistory(patient.patient_id);
    setPatientScreeningHistory(history);
  } catch (error) {
    console.error('Failed to load screening history:', error);
  }
};

const handleSubmitScreening = async () => {
  if (!selectedPatient || !screeningData || !riskAssessment) {
    Alert.alert('Error', 'Please complete screening assessment');
    return;
  }

  setIsSubmittingScreening(true);
  try {
    const { recordId, queued } = await frontlineStaffOperationsService.createPatientScreening(
      selectedPatient.patient_id,
      screeningData.vitals,
      riskAssessment.risk_level,
      riskAssessment.risk_score,
      riskAssessment.recommendations
    );

    if (queued) {
      Alert.alert('Saved', 'Screening saved. Will upload when online.');
    } else {
      Alert.alert('Success', 'Screening uploaded successfully!');
      setScreeningData(null);
      setRiskAssessment(null);
    }
  } catch (error) {
    Alert.alert('Error', error instanceof Error ? error.message : 'Failed to submit screening');
  } finally {
    setIsSubmittingScreening(false);
  }
};
```

#### 2.4 Add Pending Operations Counter
```tsx
const [pendingOperations, setPendingOperations] = useState(0);

useEffect(() => {
  const checkPending = async () => {
    try {
      const count = await frontlineStaffOperationsService.getPendingOperationCount();
      setPendingOperations(count);
    } catch (error) {
      console.error('Failed to get pending count:', error);
    }
  };

  checkPending();
  
  // Check every 30 seconds
  const interval = setInterval(checkPending, 30000);
  return () => clearInterval(interval);
}, []);

// Display in header
{pendingOperations > 0 && (
  <View style={styles.pendingBadge}>
    <Text style={styles.pendingText}>{pendingOperations} pending</Text>
  </View>
)}
```

#### 2.5 Add Manual Sync Button
```tsx
const [isSyncing, setIsSyncing] = useState(false);

const handleSyncNow = async () => {
  if (!isOnline) {
    Alert.alert('Offline', 'Please check your connection');
    return;
  }

  setIsSyncing(true);
  try {
    const result = await frontlineStaffOperationsService.syncPendingOperations();
    setIsSyncing(false);
    setPendingOperations(0);
    Alert.alert('Sync Complete', `${result.synced} items uploaded`);
  } catch (error) {
    setIsSyncing(false);
    Alert.alert('Sync Failed', error instanceof Error ? error.message : 'Unknown error');
  }
};

// Button in header
<Pressable
  onPress={handleSyncNow}
  disabled={isSyncing || !isOnline}
  style={styles.syncButton}
>
  <Text style={styles.syncButtonText}>
    {isSyncing ? '⏳' : '↻'} Sync
  </Text>
</Pressable>
```

---

## 3. Styling Additions

Add these common styles to both screens:

```tsx
const styles = StyleSheet.create({
  statusBar: {
    backgroundColor: '#f0f9ff',
    borderBottomWidth: 1,
    borderBottomColor: '#bfdbfe',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  syncTimeText: {
    fontSize: 11,
    color: '#6b7280',
    marginLeft: 8,
  },
  syncButton: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: '#fcd34d',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#78350f',
  },
});
```

---

## 4. Implementation Order

1. **First**: Add imports and types (PatientOperationsService, etc.)
2. **Second**: Add state variables for offline-safe data
3. **Third**: Add useEffect hooks to fetch data
4. **Fourth**: Replace hardcoded data with state data
5. **Fifth**: Add offline status indicators
6. **Sixth**: Add sync buttons and handlers
7. **Finally**: Test with offline/online scenarios

---

## 5. Testing Checklist

### Patient Screen
- [ ] Loads appointments from offline database
- [ ] Shows cached insights
- [ ] Can record vitals offline
- [ ] Shows "🔴 Offline" when no connection
- [ ] Manual sync button syncs data when online
- [ ] Shows last sync time

### Staff Screen
- [ ] Morning sync downloads patients
- [ ] Shows patient count from cache
- [ ] Search filters offline patient list
- [ ] Can submit screening offline
- [ ] Shows pending operations count
- [ ] Manual sync uploads pending

### General
- [ ] Status badges update correctly
- [ ] Offline features don't crash
- [ ] Online features work normally
- [ ] Background sync runs every 60 seconds
- [ ] PIN login works offline
- [ ] No network calls when offline

---

**Status**: Template Ready for Implementation  
**Complexity**: Moderate (3-4 hours per screen)
