import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { v4 as uuidv4 } from 'uuid';
import { text, assistantNarrative } from '../i18n';
import { API_BASE_URL } from '../config/api';
import {
  LanguageCode,
  PatientMiniProfile,
  PendingScreening,
  RiskResponse,
  Stage1VitalsInput,
  User,
} from '../types';
import { calculateMap, DEFAULT_IMPUTE, offlineStage1Risk } from '../services/riskEngine';
import authService from '../services/authService';
import patientCacheService from '../services/patientCacheService';
import {
  createAppointmentForFrontline,
  findPatientByNic,
  getPendingFrontlineActionCount,
  getCachedPatientStage1History,
  getDirtyVitalsCount,
  queueReferralCard,
  registerPatientForFrontline,
  saveDirtyOfflineVitalsUpdate,
  searchPatientInLocalCache,
  submitRiskOnline,
  syncDirtyVitalsUpdates,
  syncPendingFrontlineActions,
} from '../services/syncService';

interface FrontlineStaffScreenProps {
  user: User;
  onLogout: () => void;
  isOnline?: boolean;
}

const initialFields = {
  patientName: '',
  age: '28',
  systolic: '120',
  diastolic: '80',
  bmi: '24.5',
  heartRate: '78',
  bs: '95',
  temperature: '36.8',
  hemoglobin: '12',
  pcos: '0',
  previousComplications: '0',
  preexistingDiabetes: '0',
  mentalHealth: '3',
  sleepPattern: '7',
  exercise: '3',
  education: '4'
};

const initialRegisterForm = {
  full_name: '',
  national_id: '',
  due_date: '',
  age: '',
  contact_number: '',
  emergency_contact: '',
  blood_group: '',
};

const initialAppointmentForm = {
  appointment_date: '',
  appointment_type: 'PRENATAL_CHECKUP',
  notes: '',
};

const BLOOMCARE_PATIENTS_CACHE_KEY = 'bloomcare_patients_cache';
const BLOOMCARE_SYNC_QUEUE_KEY = 'bloomcare_sync_queue';

type OfflineQueueAction = 'CREATE_PATIENT' | 'CREATE_SCREENING' | 'CREATE_APPOINTMENT';

interface BloomcareCachedPatient {
  id: string;
  nic: string;
  patient_name: string;
  age?: number;
}

interface BloomcareSyncQueueItem {
  id: string;
  action: OfflineQueueAction;
  payload: Record<string, unknown>;
  timestamp: string;
  sync_status: 'PENDING';
}

const normalizeNicValue = (value: string): string => value.trim().toUpperCase();

const safeParseArray = <T,>(raw: string | null): T[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const readBloomcarePatientsCache = async (): Promise<BloomcareCachedPatient[]> => {
  const raw = await AsyncStorage.getItem(BLOOMCARE_PATIENTS_CACHE_KEY);
  return safeParseArray<BloomcareCachedPatient>(raw);
};

const upsertBloomcarePatient = async (patient: BloomcareCachedPatient): Promise<void> => {
  const cached = await readBloomcarePatientsCache();
  const nic = normalizeNicValue(patient.nic);
  const next = [
    ...cached.filter((item) => normalizeNicValue(item.nic) !== nic),
    { ...patient, nic },
  ];
  await AsyncStorage.setItem(BLOOMCARE_PATIENTS_CACHE_KEY, JSON.stringify(next));
};

const appendToBloomcareSyncQueue = async (items: BloomcareSyncQueueItem[]): Promise<void> => {
  const raw = await AsyncStorage.getItem(BLOOMCARE_SYNC_QUEUE_KEY);
  const queue = safeParseArray<BloomcareSyncQueueItem>(raw);
  await AsyncStorage.setItem(BLOOMCARE_SYNC_QUEUE_KEY, JSON.stringify([...queue, ...items]));
};

const buildPendingQueueItem = (
  action: OfflineQueueAction,
  payload: Record<string, unknown>
): BloomcareSyncQueueItem => ({
  id: uuidv4(),
  action,
  payload,
  timestamp: new Date().toISOString(),
  sync_status: 'PENDING',
});

const num = (raw: string, fallback: number): number => {
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatTriggerValue = (value: number | Record<string, number>): string => {
  if (typeof value === 'number') {
    return String(value);
  }

  return Object.entries(value)
    .map(([key, item]) => `${key}: ${item}`)
    .join(', ');
};

const badgeStyle = (online: boolean): object => ({
  backgroundColor: online ? '#ecfdf3' : '#fef2f2',
  borderColor: online ? '#16a34a' : '#dc2626',
  color: online ? '#166534' : '#991b1b'
});

export default function FrontlineStaffScreen({ user, onLogout }: FrontlineStaffScreenProps) {
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [fields, setFields] = useState(initialFields);
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientMiniProfile[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<PendingScreening[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'triage' | 'registry' | 'history'>('triage');
  const [allPatients, setAllPatients] = useState<PatientMiniProfile[]>([]);
  const [registrySearchQuery, setRegistrySearchQuery] = useState('');
  const [screeningHistory, setScreeningHistory] = useState<PendingScreening[]>([]);
  const [nicInput, setNicInput] = useState('');
  const [verifiedPatient, setVerifiedPatient] = useState<PatientMiniProfile | null>(null);
  const [registerForm, setRegisterForm] = useState(initialRegisterForm);
  const [registering, setRegistering] = useState(false);
  const [appointmentForm, setAppointmentForm] = useState(initialAppointmentForm);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [offlineUnregisteredNic, setOfflineUnregisteredNic] = useState<string | null>(null);

  const t = text[language];

  const map = useMemo(() => {
    const systolic = num(fields.systolic, DEFAULT_IMPUTE.systolic);
    const diastolic = num(fields.diastolic, DEFAULT_IMPUTE.diastolic);
    return calculateMap(systolic, diastolic);
  }, [fields.diastolic, fields.systolic]);

  const refreshQueueCount = async (): Promise<void> => {
    try {
      const [dirtyCount, actionCount] = await Promise.all([
        getDirtyVitalsCount(),
        getPendingFrontlineActionCount(),
      ]);
      setPendingCount(dirtyCount + actionCount);
    } catch (error) {
      console.error('Failed to read dirty update count:', error);
    }
  };

  const loadRegistryAndHistory = async (): Promise<void> => {
    try {
      // Always bootstrap from local cache first.
      const [cachedPatients, cachedHistory] = await Promise.all([
        searchPatientInLocalCache(''),
        getCachedPatientStage1History(''),
      ]);

      setAllPatients(cachedPatients);
      setScreeningHistory(cachedHistory);

      if (!online) {
        return;
      }

      const token = await authService.getStoredToken();
      if (!token) {
        return;
      }

      const [patientsRes, historyRes] = await Promise.all([
        fetch(`${API_BASE_URL}/patients/?limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE_URL}/triage/history?limit=200`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      let mappedPatients: PatientMiniProfile[] = [];
      if (patientsRes.ok) {
        const rows = await patientsRes.json();
        const list = Array.isArray(rows) ? rows : [];
        mappedPatients = list.map((item: any): PatientMiniProfile => ({
          patient_id: String(item.id ?? item.patient_id ?? ''),
          national_id: item.national_id ? String(item.national_id) : undefined,
          patient_name: String(item.full_name ?? item.patient_name ?? 'Unknown Patient'),
          age: typeof item.age === 'number' ? item.age : undefined,
          risk_level: item.risk_level === 'high' ? 'high' : 'low',
          last_screening_at: item.updated_at ?? undefined,
        })).filter((p: PatientMiniProfile) => p.patient_id.length > 0);

      } else {
        console.warn('Registry fetch failed:', patientsRes.status);
      }

      if (historyRes.ok) {
        const rows = await historyRes.json();
        const list = Array.isArray(rows) ? rows : [];
        const mappedHistory: PendingScreening[] = list.map((item: any) => ({
          id: String(item.screening_id ?? item.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
          createdAt: String(item.collected_at ?? new Date().toISOString()),
          vitals: {
            patient_name: String(item.patient_name ?? 'Unknown Patient'),
            age: Number(item.age ?? 0),
            systolic: Number(item.systolic ?? 120),
            diastolic: Number(item.diastolic ?? 80),
            bmi: Number(item.bmi ?? 24.5),
            heart_rate: Number(item.heart_rate ?? 78),
            bs: Number(item.blood_sugar ?? 95),
            temperature: Number(item.temperature ?? 36.8),
            hemoglobin: Number(item.hemoglobin ?? 12),
            pcos: Number(item.pcos ?? 0),
            previous_complications: Number(item.previous_complications ?? 0),
            preexisting_diabetes: Number(item.preexisting_diabetes ?? 0),
            mental_health: Number(item.mental_health ?? 3),
            sleep_pattern: Number(item.sleep_pattern ?? 7),
            exercise: Number(item.exercise ?? 3),
            education: Number(item.education ?? 4),
            map: Number(item.map ?? 80),
          },
          riskLevel: item.risk_label === 'high' ? 'high' : 'low',
          riskScore: typeof item.edge_risk_score === 'number' ? item.edge_risk_score : undefined,
          patient_id: String(item.patient_id ?? ''),
          is_synced: true,
          updatedAt: String(item.collected_at ?? new Date().toISOString()),
        }));

        setScreeningHistory(mappedHistory);

        if (mappedPatients.length === 0 && mappedHistory.length > 0) {
          const latestByPatient: Record<string, PendingScreening> = {};
          mappedHistory.forEach((entry) => {
            const patientId = entry.patient_id ?? '';
            if (!patientId) return;
            const existing = latestByPatient[patientId];
            if (!existing || new Date(entry.createdAt).getTime() >= new Date(existing.createdAt).getTime()) {
              latestByPatient[patientId] = entry;
            }
          });

          mappedPatients = Object.values(latestByPatient).map((entry) => ({
            patient_id: entry.patient_id ?? '',
            patient_name: String(entry.vitals.patient_name ?? 'Unknown Patient'),
            age: Number.isFinite(entry.vitals.age) ? entry.vitals.age : undefined,
            risk_level: entry.riskLevel,
            last_screening_at: entry.createdAt,
          })).filter((p: PatientMiniProfile) => p.patient_id.length > 0);
        }

        const byPatient: Record<string, PendingScreening[]> = {};
        mappedHistory.forEach((entry) => {
          const pid = entry.patient_id ?? '';
          if (!pid) return;
          if (!byPatient[pid]) {
            byPatient[pid] = [];
          }
          byPatient[pid].push(entry);
        });

        await patientCacheService.initialize();
        for (const [patientId, entries] of Object.entries(byPatient)) {
          await patientCacheService.cachePatientStage1History(patientId, entries);
        }
      } else {
        console.warn('History fetch failed:', historyRes.status);
      }

      if (mappedPatients.length > 0) {
        setAllPatients(mappedPatients);
        await patientCacheService.initialize();
        await patientCacheService.cacheMorningProfiles(
          mappedPatients,
          new Date().toISOString().slice(0, 10),
        );

        for (const patient of mappedPatients) {
          if (!patient.national_id) continue;
          await upsertBloomcarePatient({
            id: patient.patient_id,
            nic: patient.national_id,
            patient_name: patient.patient_name,
            age: patient.age,
          });
        }
      }
    } catch (error) {
      console.error('Failed to load registry/history from backend:', error);
    }
  };

  useEffect(() => {
    refreshQueueCount();

    loadRegistryAndHistory();

    Promise.all([syncDirtyVitalsUpdates(), syncPendingFrontlineActions()])
      .then(() => Promise.all([refreshQueueCount(), loadRegistryAndHistory()]))
      .catch(() => {
        // Keep local queue if immediate sync fails.
      });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(nowOnline);

      if (nowOnline) {
        Promise.all([syncDirtyVitalsUpdates(), syncPendingFrontlineActions()])
          .then(() => Promise.all([refreshQueueCount(), loadRegistryAndHistory()]))
          .catch(() => {
            // Ignore transient sync failures; records remain flagged dirty.
          });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!online) return;
    loadRegistryAndHistory();
  }, [online]);

  const buildVitalsInput = (): Stage1VitalsInput => {
    const systolic = num(fields.systolic, DEFAULT_IMPUTE.systolic);
    const diastolic = num(fields.diastolic, DEFAULT_IMPUTE.diastolic);

    return {
      patient_name: fields.patientName.trim() || 'Unknown Patient',
      age: num(fields.age, DEFAULT_IMPUTE.age),
      systolic,
      diastolic,
      bmi: num(fields.bmi, DEFAULT_IMPUTE.bmi),
      heart_rate: num(fields.heartRate, DEFAULT_IMPUTE.heart_rate),
      bs: num(fields.bs, DEFAULT_IMPUTE.bs),
      temperature: num(fields.temperature, DEFAULT_IMPUTE.temperature),
      hemoglobin: num(fields.hemoglobin, DEFAULT_IMPUTE.hemoglobin),
      pcos: num(fields.pcos, 0),
      previous_complications: num(fields.previousComplications, 0),
      preexisting_diabetes: num(fields.preexistingDiabetes, 0),
      mental_health: num(fields.mentalHealth, DEFAULT_IMPUTE.mental_health),
      sleep_pattern: num(fields.sleepPattern, DEFAULT_IMPUTE.sleep_pattern),
      exercise: num(fields.exercise, DEFAULT_IMPUTE.exercise),
      education: num(fields.education, DEFAULT_IMPUTE.education),
      map
    };
  };

  const handleCalculateRisk = async (): Promise<void> => {
    if (!nicInput.trim()) {
      Alert.alert('NIC Required', 'Enter patient NIC before assessment.');
      return;
    }

    if (!verifiedPatient) {
      Alert.alert('Patient Not Verified', 'Verify NIC first to confirm the patient is registered.');
      return;
    }

    if (!fields.patientName.trim()) {
      Alert.alert('Error', 'Please enter patient name');
      return;
    }

    setLoading(true);
    try {
      const vitals = buildVitalsInput();

      if (online) {
        try {
          const response = await submitRiskOnline(vitals);
          if (!response.ok) {
            throw new Error(`Prediction endpoint returned ${response.status}`);
          }

          const payload = await response.json();
          const generalRisk = payload?.general_risk;
          if (!generalRisk) {
            throw new Error('Prediction response missing general_risk');
          }

          const triggerList = Array.isArray(generalRisk.triggers) ? generalRisk.triggers : [];
          const mappedRisk: RiskResponse = {
            risk_level: String(generalRisk.risk).toLowerCase() === 'high' ? 'high' : 'low',
            risk_score: typeof generalRisk.probability === 'number' ? generalRisk.probability : 0,
            recommendations:
              triggerList.length > 0
                ? ['Clinical triggers detected. Escalate to Stage 2 specialist review.']
                : ['No major trigger detected. Continue routine monitoring.'],
            bp_status:
              vitals.systolic >= 140 || vitals.diastolic >= 90
                ? 'Elevated'
                : vitals.systolic < 90 || vitals.diastolic < 60
                  ? 'Low'
                  : 'Normal',
            observation:
              String(generalRisk.risk).toLowerCase() === 'high'
                ? 'Model and clinical checks indicate elevated maternal risk.'
                : 'Current screening suggests routine care with regular follow-up.',
            triggers: triggerList,
            model_probability:
              typeof generalRisk.probability === 'number' ? generalRisk.probability : undefined,
          };

          setRisk(mappedRisk);
          return;
        } catch {
          // If online prediction fails, keep workflow functional using offline model fallback.
        }
      }

      const riskResult = offlineStage1Risk(vitals);
      setRisk(riskResult);
    } catch (error) {
      Alert.alert('Error', 'Failed to calculate risk');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndEnqueue = async (): Promise<void> => {
    if (!risk) {
      Alert.alert('Error', 'Please calculate risk first');
      return;
    }

    try {
      const vitals = buildVitalsInput();

      if (!online) {
        const appointmentPayload = {
          appointment_date: appointmentForm.appointment_date.trim() || new Date().toISOString(),
          appointment_type: appointmentForm.appointment_type.trim() || 'PRENATAL_CHECKUP',
          notes: appointmentForm.notes.trim() || undefined,
          status: 'PENDING_SYNC',
        };

        if (verifiedPatient) {
          const screeningId = uuidv4();
          await appendToBloomcareSyncQueue([
            buildPendingQueueItem('CREATE_SCREENING', {
              patient_id: verifiedPatient.patient_id,
              screening_id: screeningId,
              ...vitals,
            }),
            buildPendingQueueItem('CREATE_APPOINTMENT', {
              patient_id: verifiedPatient.patient_id,
              ...appointmentPayload,
            }),
          ]);

          await saveDirtyOfflineVitalsUpdate({
            patient_id: verifiedPatient.patient_id,
            patient_name: fields.patientName.trim() || verifiedPatient.patient_name || 'Unknown Patient',
            vitals,
            risk_score: risk.risk_score,
            risk_level: risk.risk_level,
            recommendations: risk.recommendations,
          });

          Alert.alert('Saved Offline', 'Queued screening and appointment for sync.');
          setFields(initialFields);
          setRisk(null);
          setShowAppointmentForm(false);
          setAppointmentForm(initialAppointmentForm);
          await refreshQueueCount();
          return;
        }

        const fallbackNic = normalizeNicValue(offlineUnregisteredNic ?? nicInput);
        if (!fallbackNic) {
          Alert.alert('NIC Required', 'Verify NIC first before offline save.');
          return;
        }

        if (!registerForm.full_name.trim()) {
          Alert.alert('Registration Required', 'Enter full name to proceed with temporary offline registration.');
          return;
        }

        const newPatientUuid = uuidv4();
        const screeningId = uuidv4();

        await appendToBloomcareSyncQueue([
          buildPendingQueueItem('CREATE_PATIENT', {
            id: newPatientUuid,
            nic: fallbackNic,
            full_name: registerForm.full_name.trim(),
            due_date: registerForm.due_date.trim() || undefined,
            age: registerForm.age ? Number(registerForm.age) : undefined,
            contact_number: registerForm.contact_number.trim() || undefined,
            emergency_contact: registerForm.emergency_contact.trim() || undefined,
            blood_group: registerForm.blood_group.trim() || undefined,
          }),
          buildPendingQueueItem('CREATE_SCREENING', {
            patient_id: newPatientUuid,
            screening_id: screeningId,
            ...vitals,
          }),
          buildPendingQueueItem('CREATE_APPOINTMENT', {
            patient_id: newPatientUuid,
            ...appointmentPayload,
          }),
        ]);

        await upsertBloomcarePatient({
          id: newPatientUuid,
          nic: fallbackNic,
          patient_name: registerForm.full_name.trim(),
          age: registerForm.age ? Number(registerForm.age) : undefined,
        });

        await saveDirtyOfflineVitalsUpdate({
          patient_id: newPatientUuid,
          patient_name: registerForm.full_name.trim(),
          vitals,
          risk_score: risk.risk_score,
          risk_level: risk.risk_level,
          recommendations: risk.recommendations,
        });

        setVerifiedPatient({
          patient_id: newPatientUuid,
          national_id: fallbackNic,
          patient_name: registerForm.full_name.trim(),
          age: registerForm.age ? Number(registerForm.age) : undefined,
          risk_level: 'low',
        });
        setRegisterForm(initialRegisterForm);
        setOfflineUnregisteredNic(null);
        Alert.alert('Saved Offline', 'Temporary patient, screening, and appointment queued for sync.');
        setFields(initialFields);
        setRisk(null);
        setShowAppointmentForm(false);
        setAppointmentForm(initialAppointmentForm);
        await refreshQueueCount();
        return;
      }

      await saveDirtyOfflineVitalsUpdate({
        patient_id: verifiedPatient?.patient_id || user.id,
        patient_name: fields.patientName.trim() || 'Unknown Patient',
        vitals,
        risk_score: risk.risk_score,
        risk_level: risk.risk_level,
        recommendations: risk.recommendations,
      });

      if (online) {
        await Promise.all([
          syncDirtyVitalsUpdates(),
          syncPendingFrontlineActions(),
        ]);
      }

      await loadRegistryAndHistory();

      Alert.alert('Saved', 'Record marked for sync (is_synced: false). It will upload when online.');
      setFields(initialFields);
      setVerifiedPatient(null);
      setNicInput('');
      setRisk(null);
      await refreshQueueCount();
    } catch (error) {
      Alert.alert('Error', 'Failed to save record');
      console.error(error);
    }
  };

  const handleClearForm = (): void => {
    setFields(initialFields);
    setVerifiedPatient(null);
    setNicInput('');
    setShowAppointmentForm(false);
    setAppointmentForm(initialAppointmentForm);
    setRisk(null);
  };

  const handleVerifyNic = async (): Promise<void> => {
    const nic = nicInput.trim();
    if (!nic) {
      Alert.alert('NIC Required', 'Please enter NIC.');
      return;
    }

    setLoading(true);
    try {
      if (!online) {
        const normalizedNic = normalizeNicValue(nic);
        const cachedPatients = await readBloomcarePatientsCache();
        const cachedMatch = cachedPatients.find(
          (item) => normalizeNicValue(item.nic) === normalizedNic
        );

        if (!cachedMatch) {
          setVerifiedPatient(null);
          setOfflineUnregisteredNic(normalizedNic);
          setRegisterForm((prev) => ({
            ...prev,
            national_id: normalizedNic,
          }));
          Alert.alert(
            'Offline Mode',
            'Offline Mode: Patient not found locally. Proceeding with temporary offline registration.'
          );
          return;
        }

        const cachedProfile: PatientMiniProfile = {
          patient_id: cachedMatch.id,
          national_id: cachedMatch.nic,
          patient_name: cachedMatch.patient_name,
          age: cachedMatch.age,
          risk_level: 'low',
        };

        setVerifiedPatient(cachedProfile);
        setOfflineUnregisteredNic(null);
        setFields((prev) => ({
          ...prev,
          patientName: cachedProfile.patient_name,
          age: typeof cachedProfile.age === 'number' ? String(cachedProfile.age) : prev.age,
        }));
        Alert.alert('Verified', 'Patient found in local cache. Proceed to Stage 1 screening.');
        return;
      }

      const match = await findPatientByNic(nic, online);
      if (!match) {
        setVerifiedPatient(null);
        Alert.alert('Not Registered', 'No registered patient found for this NIC. Please register first.');
        return;
      }

      setVerifiedPatient(match);
      setOfflineUnregisteredNic(null);
      if (match.national_id) {
        await upsertBloomcarePatient({
          id: match.patient_id,
          nic: match.national_id,
          patient_name: match.patient_name,
          age: match.age,
        });
      }
      setFields((prev) => ({
        ...prev,
        patientName: match.patient_name,
        age: typeof match.age === 'number' ? String(match.age) : prev.age,
      }));
      Alert.alert('Verified', 'Patient registration confirmed. You can assess now.');
    } catch (error) {
      Alert.alert('Error', 'Failed to verify NIC.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPatient = async (): Promise<void> => {
    if (!registerForm.full_name.trim() || !registerForm.national_id.trim()) {
      Alert.alert('Missing Data', 'Full name and NIC are required.');
      return;
    }

    setRegistering(true);
    try {
      const patient = await registerPatientForFrontline(
        {
          full_name: registerForm.full_name.trim(),
          national_id: registerForm.national_id.trim(),
          due_date: registerForm.due_date.trim() || undefined,
          age: registerForm.age ? Number(registerForm.age) : undefined,
          contact_number: registerForm.contact_number.trim() || undefined,
          emergency_contact: registerForm.emergency_contact.trim() || undefined,
          blood_group: registerForm.blood_group.trim() || undefined,
        },
        online
      );

      setVerifiedPatient(patient);
      setNicInput(registerForm.national_id.trim());
      setFields((prev) => ({
        ...prev,
        patientName: patient.patient_name,
        age: typeof patient.age === 'number' ? String(patient.age) : prev.age,
      }));
      setRegisterForm(initialRegisterForm);
      Alert.alert('Saved', online ? 'Patient registered successfully.' : 'Saved offline. Will sync automatically when online.');
    } catch (error) {
      Alert.alert('Error', 'Could not register patient right now.');
    } finally {
      setRegistering(false);
    }
  };

  const handleQueueReferralCard = async (): Promise<void> => {
    if (!risk || !verifiedPatient) {
      Alert.alert('Unavailable', 'Complete patient verification and assessment first.');
      return;
    }

    try {
      await queueReferralCard({
        patient_id: verifiedPatient.patient_id,
        national_id: nicInput.trim(),
        patient_name: verifiedPatient.patient_name,
        risk_level: risk.risk_level,
        risk_score: risk.risk_score,
        created_at: new Date().toISOString(),
      });

      Alert.alert(
        'Referral Card',
        `Patient: ${verifiedPatient.patient_name}\nNIC: ${nicInput}\nRisk: ${risk.risk_level.toUpperCase()} (${Math.round(risk.risk_score * 100)}%)\n\n${online ? 'Saved and ready for print flow.' : 'Saved offline and queued.'}`
      );
    } catch {
      Alert.alert('Error', 'Unable to prepare referral card.');
    }
  };

  const handleCreateAppointment = async (): Promise<void> => {
    if (!verifiedPatient) {
      Alert.alert('Patient Required', 'Verify NIC before creating appointment.');
      return;
    }

    if (!appointmentForm.appointment_date.trim()) {
      Alert.alert('Missing Date', 'Enter appointment date/time in ISO format (YYYY-MM-DDTHH:mm).');
      return;
    }

    try {
      await createAppointmentForFrontline(
        {
          patient_id: verifiedPatient.patient_id,
          appointment_date: appointmentForm.appointment_date.trim(),
          appointment_type: appointmentForm.appointment_type.trim() || 'PRENATAL_CHECKUP',
          notes: appointmentForm.notes.trim() || undefined,
          duration_minutes: 30,
        },
        online
      );
      setAppointmentForm(initialAppointmentForm);
      setShowAppointmentForm(false);
      Alert.alert('Appointment', online ? 'Appointment created.' : 'Appointment saved offline and queued for sync.');
    } catch {
      Alert.alert('Error', 'Unable to create appointment.');
    }
  };

  const handleSearchLocalPatient = async (): Promise<void> => {
    try {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setSelectedHistory([]);
        return;
      }
      const rows = await searchPatientInLocalCache(searchQuery.trim());
      setSearchResults(rows);
    } catch (error) {
      Alert.alert('Error', 'Failed to search local cache');
    }
  };

  const handlePickPatient = async (patient: PatientMiniProfile): Promise<void> => {
    try {
      setFields((prev) => ({
        ...prev,
        patientName: patient.patient_name,
        age: patient.age ? String(patient.age) : prev.age,
      }));
      const history = await getCachedPatientStage1History(patient.patient_id);
      setSelectedHistory(history);
    } catch {
      setSelectedHistory([]);
    }
  };

  const handleManualSync = async (): Promise<void> => {
    if (syncing) return;

    if (!online) {
      Alert.alert('Offline', 'Connect to the internet to sync pending records.');
      return;
    }

    setSyncing(true);
    try {
      const [dirtyResult, actionResult] = await Promise.all([
        syncDirtyVitalsUpdates(),
        syncPendingFrontlineActions(),
      ]);
      await refreshQueueCount();

      const totalSynced = dirtyResult.synced + actionResult.synced;
      const totalPending = dirtyResult.pending + actionResult.pending;

      if (totalSynced === 0 && totalPending === 0) {
        Alert.alert('Sync Complete', 'No pending records to sync.');
        return;
      }

      Alert.alert(
        'Sync Complete',
        `Synced: ${totalSynced}\nPending: ${totalPending}`
      );
    } catch (error) {
      Alert.alert('Sync Failed', 'Could not sync records right now. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t.appTitle}</Text>
          <Text style={styles.headerSubtitle}>Welcome, {user.full_name}</Text>
        </View>
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutButtonText}>{t.logout}</Text>
        </Pressable>
      </View>

      {/* Status Info */}
      <View style={styles.statusBar}>
        <View style={[styles.badge, badgeStyle(online) as any]}>
          <Text style={styles.badgeText}>{online ? t.online : t.offline}</Text>
        </View>
        {pendingCount > 0 && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>{t.pendingSync}: {pendingCount}</Text>
          </View>
        )}
      </View>

      {/* Language Selector */}
      <View style={styles.languageSelector}>
        {(['en', 'si', 'ta'] as LanguageCode[]).map((lang) => (
          <Pressable
            key={lang}
            style={[
              styles.langButton,
              language === lang && styles.langButtonActive
            ]}
            onPress={() => setLanguage(lang)}
          >
            <Text style={[
              styles.langButtonText,
              language === lang && styles.langButtonTextActive
            ]}>
              {lang.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        <Pressable
          style={[styles.tab, activeTab === 'triage' && styles.tabActive]}
          onPress={() => setActiveTab('triage')}
        >
          <Text style={[styles.tabText, activeTab === 'triage' && styles.tabTextActive]}>Assessment</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'registry' && styles.tabActive]}
          onPress={() => setActiveTab('registry')}
        >
          <Text style={[styles.tabText, activeTab === 'registry' && styles.tabTextActive]}>Registry</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>History</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'triage' && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Register Patient</Text>
            <TextInput
              style={styles.input}
              placeholder="Full name"
              placeholderTextColor="#999"
              value={registerForm.full_name}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, full_name: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="NIC"
              placeholderTextColor="#999"
              value={registerForm.national_id}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, national_id: value }))}
            />
            <View style={styles.twoColumnRow}>
              <TextInput
                style={[styles.input, styles.halfWidth]}
                placeholder="Age"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                value={registerForm.age}
                onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, age: value }))}
              />
              <TextInput
                style={[styles.input, styles.halfWidth]}
                placeholder="Due Date (YYYY-MM-DD)"
                placeholderTextColor="#999"
                value={registerForm.due_date}
                onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, due_date: value }))}
              />
            </View>
            <TextInput
              style={styles.input}
              placeholder="Contact number"
              placeholderTextColor="#999"
              value={registerForm.contact_number}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, contact_number: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Emergency contact"
              placeholderTextColor="#999"
              value={registerForm.emergency_contact}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, emergency_contact: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder="Blood group"
              placeholderTextColor="#999"
              value={registerForm.blood_group}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, blood_group: value }))}
            />
            <Pressable
              style={[styles.button, styles.primaryButton, registering && styles.buttonDisabled]}
              onPress={handleRegisterPatient}
              disabled={registering}
            >
              {registering ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register Patient</Text>}
            </Pressable>

            <Text style={[styles.sectionTitle, styles.marginTop]}>Verify NIC Before Assessment</Text>
            <View style={styles.twoColumnRow}>
              <TextInput
                style={[styles.input, styles.halfWidth]}
                placeholder="Enter NIC"
                placeholderTextColor="#999"
                value={nicInput}
                onChangeText={setNicInput}
              />
              <Pressable
                style={[styles.button, styles.secondaryButton, styles.halfWidth]}
                onPress={handleVerifyNic}
              >
                <Text style={styles.secondaryButtonText}>Verify NIC</Text>
              </Pressable>
            </View>

            {verifiedPatient && (
              <View style={styles.verifiedBox}>
                <Text style={styles.verifiedText}>Verified: {verifiedPatient.patient_name}</Text>
                <Text style={styles.verifiedMeta}>NIC: {nicInput}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Local Patient Cache (Sync & Go)</Text>
            <TextInput
              style={styles.input}
              placeholder="Search patient name (offline cache)"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchLocalPatient}
            />
            <Pressable
              style={[styles.button, styles.secondaryButton, { marginTop: 8 }]}
              onPress={handleSearchLocalPatient}
            >
              <Text style={styles.secondaryButtonText}>Search Local Cache</Text>
            </Pressable>

            {searchResults.length > 0 && (
              <View style={{ marginTop: 10, gap: 8 }}>
                {searchResults.map((patient) => (
                  <Pressable
                    key={patient.patient_id}
                    style={styles.searchResultItem}
                    onPress={() => handlePickPatient(patient)}
                  >
                    <Text style={styles.searchResultName}>{patient.patient_name}</Text>
                    <Text style={styles.searchResultMeta}>
                      Last Risk: {patient.risk_level ?? 'n/a'} | Weeks: {patient.gestation_weeks ?? 'n/a'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {selectedHistory.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.historyTitle}>Cached Stage 1 History</Text>
                {selectedHistory.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.historyItemInline}>
                    <Text style={styles.historyText}>Date: {item.createdAt.slice(0, 10)}</Text>
                    <Text style={styles.historyText}>
                      BP: {item.vitals.systolic}/{item.vitals.diastolic} | Risk: {item.riskLevel ?? 'n/a'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {activeTab === 'triage' && (
          !risk ? (
            <View>
              <Text style={styles.sectionTitle}>Patient Assessment</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t.patientName}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t.patientName}
                  placeholderTextColor="#999"
                  value={fields.patientName}
                  onChangeText={(value) => setFields({ ...fields, patientName: value })}
                />
              </View>

              <View style={styles.twoColumnRow}>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.age}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t.age}
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    value={fields.age}
                    onChangeText={(value) => setFields({ ...fields, age: value })}
                  />
                </View>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.bmi}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t.bmi}
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    value={fields.bmi}
                    onChangeText={(value) => setFields({ ...fields, bmi: value })}
                  />
                </View>
              </View>

              <Text style={[styles.sectionTitle, styles.marginTop]}>Blood Pressure</Text>
              <View style={styles.twoColumnRow}>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.systolic}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="mmHg"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    value={fields.systolic}
                    onChangeText={(value) => setFields({ ...fields, systolic: value })}
                  />
                </View>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.diastolic}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="mmHg"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    value={fields.diastolic}
                    onChangeText={(value) => setFields({ ...fields, diastolic: value })}
                  />
                </View>
              </View>

              <View style={styles.twoColumnRow}>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.bloodSugar}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="mg/dL"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    value={fields.bs}
                    onChangeText={(value) => setFields({ ...fields, bs: value })}
                  />
                </View>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.hemoglobin}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="g/dL"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    value={fields.hemoglobin}
                    onChangeText={(value) => setFields({ ...fields, hemoglobin: value })}
                  />
                </View>
              </View>

              <View style={styles.twoColumnRow}>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.heartRate}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="bpm"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    value={fields.heartRate}
                    onChangeText={(value) => setFields({ ...fields, heartRate: value })}
                  />
                </View>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.temperature}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="°C"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    value={fields.temperature}
                    onChangeText={(value) => setFields({ ...fields, temperature: value })}
                  />
                </View>
              </View>

              <Text style={[styles.sectionTitle, styles.marginTop]}>Risk Factors</Text>
              <View style={styles.twoColumnRow}>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.pcos}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0 or 1"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={1}
                    value={fields.pcos}
                    onChangeText={(value) => setFields({ ...fields, pcos: value })}
                  />
                </View>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.preexistingDiabetes}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0 or 1"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={1}
                    value={fields.preexistingDiabetes}
                    onChangeText={(value) => setFields({ ...fields, preexistingDiabetes: value })}
                  />
                </View>
              </View>

              <View style={styles.twoColumnRow}>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.prevComplications}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0 or 1"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={1}
                    value={fields.previousComplications}
                    onChangeText={(value) => setFields({ ...fields, previousComplications: value })}
                  />
                </View>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.mentalHealth}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1-10"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    value={fields.mentalHealth}
                    onChangeText={(value) => setFields({ ...fields, mentalHealth: value })}
                  />
                </View>
              </View>

              <View style={styles.twoColumnRow}>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.sleepPattern}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="hours"
                    placeholderTextColor="#999"
                    keyboardType="decimal-pad"
                    value={fields.sleepPattern}
                    onChangeText={(value) => setFields({ ...fields, sleepPattern: value })}
                  />
                </View>
                <View style={[styles.formGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t.exercise}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0-5"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    value={fields.exercise}
                    onChangeText={(value) => setFields({ ...fields, exercise: value })}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t.education}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0-5"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  value={fields.education}
                  onChangeText={(value) => setFields({ ...fields, education: value })}
                />
              </View>

              <View style={styles.buttonGroup}>
                <Pressable
                  style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleCalculateRisk}
                  disabled={loading}
                >
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t.assessRisk}</Text>}
                </Pressable>
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleClearForm}
                  disabled={loading}
                >
                  <Text style={styles.secondaryButtonText}>{t.clearForm}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.sectionTitle}>{t.result}</Text>
              <View style={[
                styles.riskCard,
                risk.risk_level === 'high' ? styles.riskCardHigh : styles.riskCardLow
              ]}>
                <Text style={styles.riskLevel}>{risk.risk_level === 'high' ? 'HIGH RISK' : 'LOW RISK'}</Text>
                <Text style={styles.riskScore}>{Math.round(risk.risk_score * 100)}%</Text>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>Blood Pressure Status</Text>
                <Text style={styles.infoValue}>{risk.bp_status}</Text>
              </View>

              <View style={styles.observationCard}>
                <Text style={styles.observationLabel}>{t.assistant}</Text>
                <Text style={styles.observationText}>{risk.observation}</Text>
                <View style={styles.narrativeBox}>
                  <Text style={styles.narrativeText}>{assistantNarrative(language, risk)}</Text>
                </View>
              </View>

              {risk.recommendations.length > 0 && (
                <View style={styles.recommendationsCard}>
                  <Text style={styles.recommendationsTitle}>{t.recommendations}</Text>
                  {risk.recommendations.map((rec, idx) => (
                    <View key={idx} style={styles.recommendationItem}>
                      <Text style={styles.recommendationBullet}>•</Text>
                      <Text style={styles.recommendationText}>{rec}</Text>
                    </View>
                  ))}
                </View>
              )}

              {Array.isArray(risk.triggers) && risk.triggers.length > 0 && (
                <View style={styles.triggerCardSection}>
                  <Text style={styles.recommendationsTitle}>Clinical Trigger Report</Text>
                  {risk.triggers.map((trigger, idx) => (
                    <View key={`${trigger.feature}-${idx}`} style={styles.triggerItem}>
                      <Text style={styles.triggerTitle}>{trigger.feature} Alert</Text>
                      <Text style={styles.triggerText}>
                        {trigger.clinical_reason}: {formatTriggerValue(trigger.value)}
                      </Text>
                      <Text style={styles.triggerMeta}>Threshold: {trigger.threshold}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.buttonGroup}>
                <Pressable
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleSaveAndEnqueue}
                >
                  <Text style={styles.buttonText}>Save & Queue for Sync</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleQueueReferralCard}
                >
                  <Text style={styles.secondaryButtonText}>Print Referral Card</Text>
                </Pressable>
              </View>

              <View style={styles.buttonGroup}>
                <Pressable
                  style={[styles.button, styles.primaryButton]}
                  onPress={() => setShowAppointmentForm((prev) => !prev)}
                >
                  <Text style={styles.buttonText}>Make New Appointment</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleClearForm}
                >
                  <Text style={styles.secondaryButtonText}>New Assessment</Text>
                </Pressable>
              </View>

              {showAppointmentForm && (
                <View style={styles.cardSection}>
                  <Text style={styles.sectionTitle}>New Appointment</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Date-Time (YYYY-MM-DDTHH:mm)"
                    placeholderTextColor="#999"
                    value={appointmentForm.appointment_date}
                    onChangeText={(value) => setAppointmentForm((prev) => ({ ...prev, appointment_date: value }))}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Appointment type (e.g. PRENATAL_CHECKUP)"
                    placeholderTextColor="#999"
                    value={appointmentForm.appointment_type}
                    onChangeText={(value) => setAppointmentForm((prev) => ({ ...prev, appointment_type: value }))}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Notes"
                    placeholderTextColor="#999"
                    value={appointmentForm.notes}
                    onChangeText={(value) => setAppointmentForm((prev) => ({ ...prev, notes: value }))}
                  />
                  <Pressable style={[styles.button, styles.primaryButton]} onPress={handleCreateAppointment}>
                    <Text style={styles.buttonText}>Save Appointment</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )
        )}

        {activeTab === 'registry' && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Patient Registry</Text>
            <TextInput
              style={styles.input}
              placeholder="Search patient name or ID"
              value={registrySearchQuery}
              onChangeText={setRegistrySearchQuery}
              placeholderTextColor="#999"
            />
            {allPatients
              .filter((p) => p.patient_name.toLowerCase().includes(registrySearchQuery.toLowerCase()))
              .map((patient, idx) => (
                <View key={idx} style={styles.registryCard}>
                  <Text style={styles.registryName}>{patient.patient_name}</Text>
                  <Text style={styles.registryDetail}>ID: {patient.patient_id}</Text>
                  <View style={styles.registryRow}>
                    <Text style={styles.registryLabel}>Age:</Text>
                    <Text style={styles.registryValue}>{patient.age || 'N/A'}</Text>
                  </View>
                  <View style={styles.registryRow}>
                    <Text style={styles.registryLabel}>Gestation:</Text>
                    <Text style={styles.registryValue}>{patient.gestation_weeks || 'N/A'} weeks</Text>
                  </View>
                  <View style={styles.registryRow}>
                    <Text style={styles.registryLabel}>Risk Level:</Text>
                    <Text style={[
                      styles.registryValue,
                      patient.risk_level === 'high' ? styles.riskHigh : styles.riskLow
                    ]}>
                      {patient.risk_level || 'Not assessed'}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        )}

        {activeTab === 'history' && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>Screening History</Text>
            {screeningHistory.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No screening history available</Text>
              </View>
            ) : (
              screeningHistory.slice(0, 10).map((item, idx) => (
                <View key={idx} style={styles.historyCard}>
                  <View style={styles.historyCardHeader}>
                    <Text style={styles.historyCardDate}>{item.createdAt?.slice(0, 10)}</Text>
                    <Text style={[
                      styles.historyCardRisk,
                      item.riskLevel === 'high' ? styles.riskHigh : styles.riskLow
                    ]}>
                      {(item.riskLevel || 'pending').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.historyCardPatient}>{item.vitals.patient_name}</Text>
                  <View style={styles.historyCardRow}>
                    <Text style={styles.historyCardLabel}>BP:</Text>
                    <Text style={styles.historyCardValue}>
                      {item.vitals.systolic}/{item.vitals.diastolic} mmHg
                    </Text>
                  </View>
                  <View style={styles.historyCardRow}>
                    <Text style={styles.historyCardLabel}>Risk Score:</Text>
                    <Text style={styles.historyCardValue}>
                      {item.riskScore ? `${Math.round(item.riskScore * 100)}%` : 'N/A'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#e11d48',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#e11d48',
  },
  registryCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderColor: '#e5e7eb',
    borderWidth: 1,
  },
  registryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  registryDetail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  registryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  registryLabel: {
    fontSize: 12,
    color: '#666',
  },
  registryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  riskHigh: {
    color: '#dc2626',
    fontWeight: 'bold',
  },
  riskLow: {
    color: '#16a34a',
    fontWeight: 'bold',
  },
  emptyCard: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderColor: '#e5e7eb',
    borderWidth: 1,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyCardDate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  historyCardRisk: {
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#ecfdf5',
    color: '#16a34a',
  },
  historyCardPatient: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  historyCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  historyCardLabel: {
    fontSize: 11,
    color: '#666',
  },
  historyCardValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1f2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#e11d48',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 4,
  },
  logoutButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991b1b',
  },
  statusBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400e',
  },
  syncNowButton: {
    backgroundColor: '#2563eb',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncNowButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  syncNowButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomColor: '#e5e7eb',
    borderBottomWidth: 1,
  },
  langButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  langButtonActive: {
    backgroundColor: '#e11d48',
  },
  langButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  langButtonTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardSection: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  marginTop: {
    marginTop: 16,
  },
  formGroup: {
    marginBottom: 12,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#f9fafb',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#e11d48',
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  riskCard: {
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  riskCardHigh: {
    backgroundColor: '#fee2e2',
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  riskCardLow: {
    backgroundColor: '#ecfdf3',
    borderWidth: 2,
    borderColor: '#16a34a',
  },
  riskLevel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
  },
  riskScore: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  infoCard: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 6,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  observationCard: {
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#0284c7',
    marginBottom: 16,
  },
  observationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0c4a6e',
    marginBottom: 8,
  },
  observationText: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 8,
  },
  narrativeBox: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#e11d48',
  },
  narrativeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#be123c',
    lineHeight: 18,
  },
  recommendationsCard: {
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    marginBottom: 16,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  recommendationBullet: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 18,
  },
  triggerCardSection: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
  },
  triggerItem: {
    backgroundColor: '#ffe4e6',
    borderWidth: 1,
    borderColor: '#fda4af',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  triggerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#be123c',
    marginBottom: 4,
  },
  triggerText: {
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 16,
  },
  triggerMeta: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  searchResultItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    backgroundColor: '#fff',
    padding: 10,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  searchResultMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#6b7280',
  },
  verifiedBox: {
    backgroundColor: '#ecfdf3',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    padding: 10,
    marginTop: 10,
    marginBottom: 8,
  },
  verifiedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  verifiedMeta: {
    marginTop: 2,
    fontSize: 12,
    color: '#15803d',
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  historyItemInline: {
    borderLeftWidth: 3,
    borderLeftColor: '#e11d48',
    paddingLeft: 8,
    marginBottom: 6,
  },
  historyText: {
    fontSize: 12,
    color: '#374151',
  },
});
