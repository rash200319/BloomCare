import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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
import { text, assistantNarrative, formatMsg } from '../i18n';
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
import offlineDatabase from '../services/offlineDatabase';
import patientCacheService from '../services/patientCacheService';
import {
  createAppointmentForFrontline,
  findPatientByNic,
  getPendingFrontlineActionCount,
  getCachedPatientStage1History,
  getDirtyVitalsCount,
  loadAppointmentSpecializations,
  loadAppointmentSpecialists,
  loadSpecialistAvailability,
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
  language: LanguageCode;
  onLanguageChange: (language: LanguageCode) => void;
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

const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const formatDueDateInput = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
};

const BLOOMCARE_PATIENTS_CACHE_KEY = 'bloomcare_patients_cache';

interface BloomcareCachedPatient {
  id: string;
  nic: string;
  patient_name: string;
  age?: number;
}

interface AppointmentSpecialization {
  specialization: string;
  specialist_count: number;
}

interface AppointmentSpecialist {
  id: string;
  full_name: string;
  specialization: string;
  phone_number?: string;
  email?: string;
}

interface AppointmentSlot {
  label: string;
  startDateTime: string;
}

const normalizeNicValue = (value: string): string => value.trim().toUpperCase();

const mapPatientProfile = (patient: any): PatientMiniProfile => ({
  patient_id: String(patient.patient_id ?? patient.id ?? ''),
  national_id: patient.national_id ? String(patient.national_id) : undefined,
  patient_name: String(patient.patient_name ?? patient.full_name ?? 'Unknown Patient'),
  age: typeof patient.age === 'number' ? patient.age : undefined,
  gestation_weeks:
    typeof patient.gestation_weeks === 'number' ? patient.gestation_weeks : undefined,
  risk_level: patient.risk_level === 'high' ? 'high' : 'low',
  last_screening_at: patient.last_screening_at ?? patient.updated_at ?? undefined,
  history_note: patient.history_note ?? undefined,
});

const mergePatientLists = (patients: PatientMiniProfile[]): PatientMiniProfile[] => {
  const byKey = new Map<string, PatientMiniProfile>();

  for (const patient of patients) {
    const key = normalizeNicValue(patient.national_id ?? '') || patient.patient_id;
    const existing = byKey.get(key);
    byKey.set(key, existing ? { ...existing, ...patient } : patient);
  }

  return Array.from(byKey.values()).sort((left, right) =>
    left.patient_name.localeCompare(right.patient_name)
  );
};

const findCachedPatientByNic = async (nic: string): Promise<PatientMiniProfile | null> => {
  const normalizedNic = normalizeNicValue(nic);
  if (!normalizedNic) {
    return null;
  }

  await offlineDatabase.initialize();
  const dbPatients = await offlineDatabase.getAllPatientProfiles();
  const dbMatch = dbPatients.find(
    (item) => normalizeNicValue(String(item.national_id ?? '')) === normalizedNic
  );
  if (dbMatch) {
    return mapPatientProfile(dbMatch);
  }

  const cachedPatients = await readBloomcarePatientsCache();
  const match = cachedPatients.find((item) => normalizeNicValue(item.nic) === normalizedNic);

  if (!match) {
    return null;
  }

  return {
    patient_id: match.id,
    national_id: match.nic,
    patient_name: match.patient_name,
    age: match.age,
    risk_level: 'low',
  };
};

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

export default function FrontlineStaffScreen({
  user,
  onLogout,
  isOnline,
  language,
  onLanguageChange,
}: FrontlineStaffScreenProps) {
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
  const [showBloodTypeDropdown, setShowBloodTypeDropdown] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentSpecializations, setAppointmentSpecializations] = useState<AppointmentSpecialization[]>([]);
  const [appointmentSpecialists, setAppointmentSpecialists] = useState<AppointmentSpecialist[]>([]);
  const [appointmentSlots, setAppointmentSlots] = useState<AppointmentSlot[]>([]);
  const [selectedSpecialization, setSelectedSpecialization] = useState<string | null>(null);
  const [selectedSpecialist, setSelectedSpecialist] = useState<AppointmentSpecialist | null>(null);
  const [selectedAppointmentDate, setSelectedAppointmentDate] = useState('');
  const [selectedAppointmentSlot, setSelectedAppointmentSlot] = useState<AppointmentSlot | null>(null);
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const [appointmentError, setAppointmentError] = useState<string | null>(null);
  const [appointmentSearch, setAppointmentSearch] = useState('');
  const [offlineUnregisteredNic, setOfflineUnregisteredNic] = useState<string | null>(null);
  const previousOnlineState = useRef<boolean | undefined>(undefined);

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
        offlineDatabase.getAllPatientProfiles(),
        getCachedPatientStage1History(''),
      ]);

      const localPatients = cachedPatients
        .map(mapPatientProfile)
        .filter((patient) => patient.patient_id.length > 0);

      setAllPatients(localPatients);
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

        setAllPatients(mergePatientLists([...localPatients, ...mappedPatients]));
      }
    } catch (error) {
      console.error('Failed to load registry/history from backend:', error);
    }
  };

  useEffect(() => {
    refreshQueueCount();

    loadRegistryAndHistory();

    syncPendingFrontlineActions()
      .then(() => syncDirtyVitalsUpdates())
      .then(() => Promise.all([refreshQueueCount(), loadRegistryAndHistory()]))
      .catch(() => {
        // Keep local queue if immediate sync fails.
      });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(nowOnline);

      if (nowOnline) {
        syncPendingFrontlineActions()
          .then(() => syncDirtyVitalsUpdates())
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
    if (typeof isOnline !== 'boolean') {
      return;
    }

    setOnline(isOnline);

    const cameOnline = previousOnlineState.current === false && isOnline === true;
    previousOnlineState.current = isOnline;

    if (!cameOnline) {
      return;
    }

    syncPendingFrontlineActions()
      .then(() => syncDirtyVitalsUpdates())
      .then(() => Promise.all([refreshQueueCount(), loadRegistryAndHistory()]))
      .catch((error) => {
        console.error('Reconnect sync failed:', error);
      });
  }, [isOnline]);

  useEffect(() => {
    if (!online) return;
    loadRegistryAndHistory();
  }, [online]);

  useEffect(() => {
    if (!showAppointmentForm) return;
    setAppointmentError(null);
    setAppointmentLoading(true);
    loadAppointmentSpecializations(online)
      .then((list) => {
        setAppointmentSpecializations(list);
      })
      .catch(() => {
        setAppointmentError(t.alertLoadSpecializationsFailed);
      })
      .finally(() => {
        setAppointmentLoading(false);
      });
  }, [showAppointmentForm, online]);

  useEffect(() => {
    if (!selectedSpecialization) {
      setAppointmentSpecialists([]);
      return;
    }
    setAppointmentLoading(true);
    loadAppointmentSpecialists(selectedSpecialization, online)
      .then((list) => {
        setAppointmentSpecialists(list);
      })
      .catch(() => {
        setAppointmentError(t.alertLoadSpecialistsFailed);
      })
      .finally(() => {
        setAppointmentLoading(false);
      });
  }, [selectedSpecialization, online]);

  useEffect(() => {
    if (!selectedSpecialist || !selectedAppointmentDate) {
      setAppointmentSlots([]);
      return;
    }
    setAppointmentLoading(true);
    loadSpecialistAvailability(selectedSpecialist.full_name, selectedAppointmentDate, online)
      .then((slots) => {
        setAppointmentSlots(slots);
      })
      .catch(() => {
        setAppointmentSlots([]);
      })
      .finally(() => {
        setAppointmentLoading(false);
      });
  }, [selectedSpecialist, selectedAppointmentDate, online]);

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

  const filteredAppointmentSpecialists = useMemo(() => {
    const query = appointmentSearch.trim().toLowerCase();
    if (!query) return appointmentSpecialists;
    return appointmentSpecialists.filter((spec) =>
      spec.full_name.toLowerCase().includes(query)
    );
  }, [appointmentSpecialists, appointmentSearch]);

  const handleCalculateRisk = async (): Promise<void> => {
    if (!nicInput.trim()) {
      Alert.alert(t.alertNicRequired, t.alertEnterNicAssessment);
      return;
    }

    if (!verifiedPatient) {
      Alert.alert(t.alertPatientNotVerified, t.alertVerifyNicFirst);
      return;
    }

    if (!fields.patientName.trim()) {
      Alert.alert(t.error, t.alertEnterPatientName);
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
      Alert.alert(t.error, t.alertRiskFailed);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndEnqueue = async (): Promise<void> => {
    if (!risk) {
      Alert.alert(t.error, t.alertCalculateRiskFirst);
      return;
    }

    try {
      const vitals = buildVitalsInput();

      if (!online) {
        if (verifiedPatient) {
          await saveDirtyOfflineVitalsUpdate({
            patient_id: verifiedPatient.patient_id,
            patient_name: fields.patientName.trim() || verifiedPatient.patient_name || 'Unknown Patient',
            vitals,
            risk_score: risk.risk_score,
            risk_level: risk.risk_level,
            recommendations: risk.recommendations,
          });

          Alert.alert(t.alertSavedOffline, t.alertQueuedScreening);
          setFields(initialFields);
          setRisk(null);
          setShowAppointmentForm(false);
          await refreshQueueCount();
          return;
        }

        const fallbackNic = normalizeNicValue(offlineUnregisteredNic ?? nicInput);
        if (!fallbackNic) {
          Alert.alert(t.alertNicRequired, t.alertVerifyNicOffline);
          return;
        }

        if (!registerForm.full_name.trim()) {
          Alert.alert(t.alertRegistrationRequired, t.alertEnterFullNameOffline);
          return;
        }

        const patient = await registerPatientForFrontline(
          {
            full_name: registerForm.full_name.trim(),
            national_id: fallbackNic,
            due_date: registerForm.due_date.trim() || undefined,
            age: registerForm.age ? Number(registerForm.age) : undefined,
            contact_number: registerForm.contact_number.trim() || undefined,
            emergency_contact: registerForm.emergency_contact.trim() || undefined,
            blood_group: registerForm.blood_group.trim() || undefined,
          },
          false
        );

        await saveDirtyOfflineVitalsUpdate({
          patient_id: patient.patient_id,
          patient_name: patient.patient_name,
          vitals,
          risk_score: risk.risk_score,
          risk_level: risk.risk_level,
          recommendations: risk.recommendations,
        });

        if (patient.national_id) {
          await upsertBloomcarePatient({
            id: patient.patient_id,
            nic: patient.national_id,
            patient_name: patient.patient_name,
            age: patient.age,
          });
        }

        setVerifiedPatient(patient);
        setRegisterForm(initialRegisterForm);
        setOfflineUnregisteredNic(null);
        Alert.alert(t.alertSavedOffline, t.alertOfflinePatientQueued);
        setFields(initialFields);
        setRisk(null);
        setShowAppointmentForm(false);
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
        await syncPendingFrontlineActions();
        await syncDirtyVitalsUpdates();
      }

      await loadRegistryAndHistory();

      Alert.alert(t.alertSaved, t.alertSavedWillSync);
      setFields(initialFields);
      setVerifiedPatient(null);
      setNicInput('');
      setRisk(null);
      await refreshQueueCount();
    } catch (error) {
      Alert.alert(t.error, t.alertSaveFailed);
      console.error(error);
    }
  };

  const handleClearForm = (): void => {
    setFields(initialFields);
    setVerifiedPatient(null);
    setNicInput('');
    setShowAppointmentForm(false);
    setSelectedSpecialization(null);
    setSelectedSpecialist(null);
    setSelectedAppointmentDate('');
    setSelectedAppointmentSlot(null);
    setAppointmentNotes('');
    setRisk(null);
  };

  const resetAppointmentFlow = (): void => {
    setSelectedSpecialization(null);
    setSelectedSpecialist(null);
    setSelectedAppointmentDate('');
    setSelectedAppointmentSlot(null);
    setAppointmentNotes('');
    setAppointmentSearch('');
    setAppointmentError(null);
  };

  const handleOpenAppointmentFlow = (): void => {
    if (!verifiedPatient) {
      Alert.alert(t.alertPatientRequired, t.alertVerifyNicAppointment);
      return;
    }
    resetAppointmentFlow();
    setShowAppointmentForm(true);
  };

  const handleVerifyNic = async (): Promise<void> => {
    const nic = nicInput.trim();
    if (!nic) {
      Alert.alert(t.alertNicRequired, t.enterNicPlaceholder);
      return;
    }

    setLoading(true);
    try {
      if (!online) {
        const cachedProfile = await findCachedPatientByNic(nic);

        if (!cachedProfile) {
          setVerifiedPatient(null);
          setOfflineUnregisteredNic(null);
          setRegisterForm((prev) => ({
            ...prev,
            national_id: normalizeNicValue(nic),
          }));
          Alert.alert(t.alertPatientNotInCache, t.alertRegisterFirstCache);
          return;
        }

        setVerifiedPatient(cachedProfile);
        setOfflineUnregisteredNic(null);
        setFields((prev) => ({
          ...prev,
          patientName: cachedProfile.patient_name,
          age: typeof cachedProfile.age === 'number' ? String(cachedProfile.age) : prev.age,
        }));
        setActiveTab('triage');
        Alert.alert(t.alertVerified, t.alertVerifiedCache);
        return;
      }

      const match = await findPatientByNic(nic, online);
      if (!match) {
        setVerifiedPatient(null);
        Alert.alert(t.alertNotRegistered, t.alertNotRegisteredMsg);
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
      setActiveTab('triage');
      Alert.alert(t.alertVerified, t.alertVerifiedCache);
    } catch (error) {
      Alert.alert(t.error, t.alertVerifyNicFailed);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPatient = async (): Promise<void> => {
    if (!registerForm.full_name.trim() || !registerForm.national_id.trim()) {
      Alert.alert(t.alertMissingData, t.alertFullNameNicRequired);
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
      if (patient.national_id) {
        await upsertBloomcarePatient({
          id: patient.patient_id,
          nic: patient.national_id,
          patient_name: patient.patient_name,
          age: patient.age,
        });
      }
      setFields((prev) => ({
        ...prev,
        patientName: patient.patient_name,
        age: typeof patient.age === 'number' ? String(patient.age) : prev.age,
      }));
      setActiveTab('triage');
      setShowBloodTypeDropdown(false);
      setRegisterForm(initialRegisterForm);
      if (online) {
        await syncPendingFrontlineActions();
      }
      await loadRegistryAndHistory();
      Alert.alert(t.alertSaved, online ? t.alertPatientRegistered : t.alertPatientSavedOffline);
    } catch (error) {
      Alert.alert(
        t.error,
        error instanceof Error ? error.message : t.alertRegisterFailed
      );
    } finally {
      setRegistering(false);
    }
  };

  const handleQueueReferralCard = async (): Promise<void> => {
    if (!risk || !verifiedPatient) {
      Alert.alert(t.alertUnavailable, t.alertCompleteAssessmentFirst);
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
        t.alertReferralCard,
        `${t.patientName}: ${verifiedPatient.patient_name}\n${t.nic}: ${nicInput}\n${t.riskLevel}: ${risk.risk_level.toUpperCase()} (${Math.round(risk.risk_score * 100)}%)\n\n${online ? t.alertReferralSavedOnline : t.alertReferralSavedOffline}`
      );
    } catch {
      Alert.alert(t.error, t.alertReferralFailed);
    }
  };

  const handleCreateAppointment = async (): Promise<void> => {
    if (!verifiedPatient) {
      Alert.alert(t.alertPatientRequired, t.alertVerifyNicAppointment);
      return;
    }

    if (!selectedSpecialist || !selectedAppointmentSlot) {
      Alert.alert(t.alertMissingDetails, t.alertSelectSpecialistSlot);
      return;
    }

    try {
      await createAppointmentForFrontline(
        {
          patient_id: verifiedPatient.patient_id,
          patient_nic: verifiedPatient.national_id ?? nicInput.trim(),
          patient_full_name: verifiedPatient.patient_name,
          specialist_id: selectedSpecialist.id,
          specialist_name: selectedSpecialist.full_name,
          appointment_date: selectedAppointmentSlot.startDateTime,
          appointment_type: 'PRENATAL_CHECKUP',
          notes: appointmentNotes.trim() || undefined,
          duration_minutes: 30,
        },
        online
      );
      resetAppointmentFlow();
      setShowAppointmentForm(false);
      Alert.alert(t.newAppointment, online ? t.alertAppointmentCreated : t.alertAppointmentOffline);
    } catch {
      Alert.alert(t.error, t.alertAppointmentFailed);
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
      const cachedProfile = rows[0] ?? null;

      if (!cachedProfile) {
        setSearchResults([]);
        setSelectedHistory([]);
        setVerifiedPatient(null);
        setOfflineUnregisteredNic(null);
        Alert.alert(t.alertPatientNotInCache, t.alertRegisterFirstCache);
        return;
      }

      setSearchResults([cachedProfile]);
      setVerifiedPatient(cachedProfile);
      setOfflineUnregisteredNic(null);
      setNicInput(cachedProfile.national_id ?? searchQuery.trim());
      setFields((prev) => ({
        ...prev,
        patientName: cachedProfile.patient_name,
        age: typeof cachedProfile.age === 'number' ? String(cachedProfile.age) : prev.age,
      }));
      setActiveTab('triage');
    } catch (error) {
      Alert.alert(t.error, t.alertSearchCacheFailed);
    }
  };

  const handlePickPatient = async (patient: PatientMiniProfile): Promise<void> => {
    try {
      setVerifiedPatient(patient);
      setOfflineUnregisteredNic(null);
      setFields((prev) => ({
        ...prev,
        patientName: patient.patient_name,
        age: patient.age ? String(patient.age) : prev.age,
      }));
      if (patient.national_id) {
        setNicInput(patient.national_id);
      }
      const history = await getCachedPatientStage1History(patient.patient_id);
      setSelectedHistory(history);
      setActiveTab('triage');
    } catch {
      setSelectedHistory([]);
    }
  };

  const handleManualSync = async (): Promise<void> => {
    if (syncing) return;

    if (!online) {
      Alert.alert(t.offline, t.alertOfflineSync);
      return;
    }

    setSyncing(true);
    try {
      const actionResult = await syncPendingFrontlineActions();
      const dirtyResult = await syncDirtyVitalsUpdates();
      await refreshQueueCount();
      await loadRegistryAndHistory();

      const totalSynced = dirtyResult.synced + actionResult.synced;
      const totalPending = dirtyResult.pending + actionResult.pending;
      const errorText = actionResult.errors.slice(0, 3).join('\n');

      if (actionResult.errors.length > 0) {
        Alert.alert(
          t.alertSyncFailed,
          `${formatMsg(t.alertSyncResult, { synced: totalSynced, pending: totalPending })}\n\n${errorText}`
        );
        return;
      }

      if (totalSynced === 0 && totalPending === 0) {
        Alert.alert(t.alertSyncComplete, t.alertNoPending);
        return;
      }

      if (totalPending > 0) {
        Alert.alert(
          t.alertSyncFailed,
          formatMsg(t.alertSyncResult, { synced: totalSynced, pending: totalPending })
        );
        return;
      }

      Alert.alert(
        t.alertSyncComplete,
        formatMsg(t.alertSyncResult, { synced: totalSynced, pending: totalPending })
      );
    } catch (error) {
      Alert.alert(t.alertSyncFailed, t.alertSyncFailedMsg);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncRegisteredPatients = async (): Promise<void> => {
    if (syncing) return;

    if (!online) {
      Alert.alert(t.offline, t.alertOfflineRegistrationSync);
      return;
    }

    setSyncing(true);
    try {
      const result = await syncPendingFrontlineActions();
      await syncDirtyVitalsUpdates();
      await refreshQueueCount();
      await loadRegistryAndHistory();

      if (result.errors.length > 0) {
        Alert.alert(
          t.alertSyncFailed,
          `${result.errors.slice(0, 3).join('\n')}\n\n${formatMsg(t.alertRegistrationNone, { pending: result.pending })}`
        );
        return;
      }

      Alert.alert(
        t.alertRegistrationSync,
        result.synced > 0
          ? formatMsg(t.alertRegistrationSynced, { synced: result.synced, pending: result.pending })
          : formatMsg(t.alertRegistrationNone, { pending: result.pending })
      );
    } catch (error) {
      Alert.alert(t.alertSyncFailed, t.alertSyncFailedMsg);
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
          <Text style={styles.headerSubtitle}>{formatMsg(t.welcomeUser, { name: user.full_name })}</Text>
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
        <View style={styles.syncStatusWrap}>
          <Text style={styles.syncStatusText}>
            {pendingCount > 0
              ? formatMsg(t.syncPendingHint, { count: pendingCount })
              : t.syncReady}
          </Text>
          {!online && pendingCount > 0 && (
            <Text style={styles.syncHintText}>{t.offlineModeNote}</Text>
          )}
        </View>
        <Pressable
          style={[
            styles.syncNowButton,
            (syncing || !online) && styles.syncNowButtonDisabled,
          ]}
          onPress={handleManualSync}
          disabled={syncing || !online}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.syncNowButtonText}>{t.syncNow}</Text>
          )}
        </Pressable>
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
            onPress={() => onLanguageChange(lang)}
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
          <Text style={[styles.tabText, activeTab === 'triage' && styles.tabTextActive]}>{t.tabAssessment}</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'registry' && styles.tabActive]}
          onPress={() => setActiveTab('registry')}
        >
          <Text style={[styles.tabText, activeTab === 'registry' && styles.tabTextActive]}>{t.tabRegistry}</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>{t.tabHistory}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'triage' && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>{t.registerPatient}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.fullName}
              placeholderTextColor="#999"
              value={registerForm.full_name}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, full_name: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder={t.nic}
              placeholderTextColor="#999"
              value={registerForm.national_id}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, national_id: value }))}
            />
            <View style={styles.twoColumnRow}>
              <TextInput
                style={[styles.input, styles.halfWidth]}
                placeholder={t.age}
                placeholderTextColor="#999"
                keyboardType="number-pad"
                value={registerForm.age}
                onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, age: value }))}
              />
              <TextInput
                style={[styles.input, styles.halfWidth]}
                placeholder={t.dueDate}
                placeholderTextColor="#999"
                keyboardType="number-pad"
                maxLength={10}
                value={registerForm.due_date}
                onChangeText={(value) =>
                  setRegisterForm((prev) => ({
                    ...prev,
                    due_date: formatDueDateInput(value),
                  }))
                }
              />
            </View>
            <Text style={styles.inputHint}>{t.dueDateHint}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.contactNumber}
              placeholderTextColor="#999"
              value={registerForm.contact_number}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, contact_number: value }))}
            />
            <TextInput
              style={styles.input}
              placeholder={t.emergencyContact}
              placeholderTextColor="#999"
              value={registerForm.emergency_contact}
              onChangeText={(value) => setRegisterForm((prev) => ({ ...prev, emergency_contact: value }))}
            />
            <View style={styles.dropdownContainer}>
              <Text style={styles.label}>{t.bloodType}</Text>
              <Pressable
                style={styles.dropdownTrigger}
                onPress={() => setShowBloodTypeDropdown((prev) => !prev)}
              >
                <View style={styles.dropdownTriggerRow}>
                  <Text
                    style={
                      registerForm.blood_group
                        ? styles.dropdownSelectedText
                        : styles.dropdownPlaceholderText
                    }
                  >
                    {registerForm.blood_group || t.selectBloodType}
                  </Text>
                  <Text style={styles.dropdownChevron}>▼</Text>
                </View>
              </Pressable>
            </View>
            <Modal
              visible={showBloodTypeDropdown}
              transparent
              animationType="fade"
              onRequestClose={() => setShowBloodTypeDropdown(false)}
            >
              <Pressable
                style={styles.dropdownModalBackdrop}
                onPress={() => setShowBloodTypeDropdown(false)}
              >
                <View style={styles.dropdownModalCard}>
                  <Text style={styles.dropdownModalTitle}>{t.selectBloodType}</Text>
                  {BLOOD_TYPE_OPTIONS.map((bloodType) => (
                    <Pressable
                      key={bloodType}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setRegisterForm((prev) => ({ ...prev, blood_group: bloodType }));
                        setShowBloodTypeDropdown(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{bloodType}</Text>
                    </Pressable>
                  ))}
                </View>
              </Pressable>
            </Modal>
            <Pressable
              style={[styles.button, styles.primaryButton, registering && styles.buttonDisabled]}
              onPress={handleRegisterPatient}
              disabled={registering}
            >
              {registering ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t.registerPatient}</Text>}
            </Pressable>

            <Text style={[styles.sectionTitle, styles.marginTop]}>{t.verifyNicTitle}</Text>
            <View style={styles.twoColumnRow}>
              <TextInput
                style={[styles.input, styles.halfWidth]}
                placeholder={t.enterNicPlaceholder}
                placeholderTextColor="#999"
                value={nicInput}
                onChangeText={setNicInput}
              />
              <Pressable
                style={[styles.button, styles.secondaryButton, styles.halfWidth]}
                onPress={handleVerifyNic}
              >
                <Text style={styles.secondaryButtonText}>{t.verifyNic}</Text>
              </Pressable>
            </View>

            {verifiedPatient && (
              <View style={styles.verifiedBox}>
                <Text style={styles.verifiedText}>{formatMsg(t.verifiedPatient, { name: verifiedPatient.patient_name })}</Text>
                <Text style={styles.verifiedMeta}>{t.nic}: {nicInput}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>{t.localCacheTitle}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.searchLocalCache}
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchLocalPatient}
            />
            <Pressable
              style={[styles.button, styles.secondaryButton, { marginTop: 8 }]}
              onPress={handleSearchLocalPatient}
            >
              <Text style={styles.secondaryButtonText}>{t.searchLocalCacheBtn}</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.primaryButton, { marginTop: 8 }, syncing && styles.buttonDisabled]}
              onPress={handleSyncRegisteredPatients}
              disabled={syncing}
            >
              {syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t.syncRegisteredPatients}</Text>}
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
                      NIC: {patient.national_id ?? 'n/a'}
                    </Text>
                    <Text style={styles.searchResultMeta}>
                      Last Risk: {patient.risk_level ?? 'n/a'} | Weeks: {patient.gestation_weeks ?? 'n/a'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {selectedHistory.length > 0 && (
              <View style={{ marginTop: 10 }}>
                <Text style={styles.historyTitle}>{t.cachedHistory}</Text>
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
              <Text style={styles.sectionTitle}>{t.patientAssessment}</Text>

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
                <Text style={styles.riskLevel}>{risk.risk_level === 'high' ? t.highRisk : t.lowRisk}</Text>
                <Text style={styles.riskScore}>{Math.round(risk.risk_score * 100)}%</Text>
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>{t.bpStatus}</Text>
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
                  <Text style={styles.recommendationsTitle}>{t.clinicalTriggers}</Text>
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
                  <Text style={styles.buttonText}>{t.saveQueueSync}</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleQueueReferralCard}
                >
                  <Text style={styles.secondaryButtonText}>{t.printReferral}</Text>
                </Pressable>
              </View>

              <View style={styles.buttonGroup}>
                <Pressable
                  style={[styles.button, styles.primaryButton]}
                  onPress={handleOpenAppointmentFlow}
                >
                  <Text style={styles.buttonText}>{t.makeAppointment}</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.secondaryButton]}
                  onPress={handleClearForm}
                >
                  <Text style={styles.secondaryButtonText}>{t.newAssessment}</Text>
                </Pressable>
              </View>

              {showAppointmentForm && (
                <View style={styles.cardSection}>
                  <Text style={styles.sectionTitle}>New Appointment</Text>
                  <Pressable
                    style={[styles.button, styles.secondaryButton, { marginBottom: 12 }]}
                    onPress={() => {
                      setShowAppointmentForm(false);
                      resetAppointmentFlow();
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Close</Text>
                  </Pressable>
                  {appointmentError && (
                    <Text style={styles.inputHint}>{appointmentError}</Text>
                  )}
                  {appointmentLoading && (
                    <ActivityIndicator color="#e11d48" style={{ marginBottom: 8 }} />
                  )}

                  <Text style={styles.label}>1. Select Specialization</Text>
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    {appointmentSpecializations.length === 0 ? (
                      <Text style={styles.inputHint}>No specializations available offline.</Text>
                    ) : (
                      appointmentSpecializations.map((spec) => (
                        <Pressable
                          key={spec.specialization}
                          style={[
                            styles.slotButton,
                            selectedSpecialization === spec.specialization && styles.slotButtonActive,
                          ]}
                          onPress={() => {
                            setSelectedSpecialization(spec.specialization);
                            setSelectedSpecialist(null);
                            setSelectedAppointmentDate('');
                            setSelectedAppointmentSlot(null);
                          }}
                        >
                          <Text style={styles.slotButtonText}>
                            {spec.specialization} ({spec.specialist_count})
                          </Text>
                        </Pressable>
                      ))
                    )}
                  </View>

                  {selectedSpecialization && (
                    <>
                      <Text style={styles.label}>2. Select Specialist</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Search specialists"
                        placeholderTextColor="#999"
                        value={appointmentSearch}
                        onChangeText={setAppointmentSearch}
                      />
                      <View style={{ gap: 8, marginBottom: 12 }}>
                        {filteredAppointmentSpecialists.length === 0 ? (
                          <Text style={styles.inputHint}>No specialists cached for this specialization.</Text>
                        ) : (
                          filteredAppointmentSpecialists.map((spec) => (
                            <Pressable
                              key={spec.id}
                              style={[
                                styles.slotButton,
                                selectedSpecialist?.id === spec.id && styles.slotButtonActive,
                              ]}
                              onPress={() => {
                                setSelectedSpecialist(spec);
                                setSelectedAppointmentDate('');
                                setSelectedAppointmentSlot(null);
                              }}
                            >
                              <Text style={styles.slotButtonText}>{spec.full_name}</Text>
                              <Text style={styles.inputHint}>{spec.specialization}</Text>
                            </Pressable>
                          ))
                        )}
                      </View>
                    </>
                  )}

                  {selectedSpecialist && (
                    <>
                      <Text style={styles.label}>3. Select Date</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        placeholderTextColor="#999"
                        value={selectedAppointmentDate}
                        onChangeText={(value) => {
                          setSelectedAppointmentDate(value);
                          setSelectedAppointmentSlot(null);
                        }}
                      />
                      <Text style={styles.label}>Time Slot</Text>
                      <View style={styles.slotGrid}>
                        {appointmentSlots.length === 0 ? (
                          <Text style={styles.inputHint}>Select a date to load slots.</Text>
                        ) : (
                          appointmentSlots.map((slot) => (
                            <Pressable
                              key={slot.startDateTime}
                              style={[
                                styles.slotButton,
                                selectedAppointmentSlot?.startDateTime === slot.startDateTime && styles.slotButtonActive,
                              ]}
                              onPress={() => {
                                setSelectedAppointmentSlot(slot);
                              }}
                            >
                              <Text style={styles.slotButtonText}>{slot.label}</Text>
                            </Pressable>
                          ))
                        )}
                      </View>
                      <Text style={styles.label}>Notes (Optional)</Text>
                      <TextInput
                        style={[styles.input, { height: 80 }]}
                        placeholder="Add notes"
                        placeholderTextColor="#999"
                        value={appointmentNotes}
                        onChangeText={setAppointmentNotes}
                        multiline
                      />
                    </>
                  )}

                  {selectedSpecialist && selectedAppointmentSlot && (
                    <View style={{ marginTop: 12 }}>
                      <View style={styles.infoCard}>
                        <Text style={styles.infoLabel}>Specialist</Text>
                        <Text style={styles.infoValue}>{selectedSpecialist.full_name}</Text>
                        <Text style={styles.infoLabel}>Date & Time</Text>
                        <Text style={styles.infoValue}>{selectedAppointmentSlot.startDateTime}</Text>
                      </View>
                      <View style={styles.buttonGroup}>
                        <Pressable
                          style={[styles.button, styles.primaryButton]}
                          onPress={handleCreateAppointment}
                        >
                          <Text style={styles.buttonText}>Confirm Appointment</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.button, styles.secondaryButton]}
                          onPress={() => {
                            setShowAppointmentForm(false);
                            resetAppointmentFlow();
                          }}
                        >
                          <Text style={styles.secondaryButtonText}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          )
        )}

        {activeTab === 'registry' && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>{t.patientRegistry}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.searchNicOrName}
              value={registrySearchQuery}
              onChangeText={setRegistrySearchQuery}
              placeholderTextColor="#999"
            />
            {allPatients
              .filter((p) => {
                const query = registrySearchQuery.trim().toLowerCase();
                if (!query) return true;
                return (
                  p.patient_name.toLowerCase().includes(query) ||
                  (p.national_id ?? '').toLowerCase().includes(query) ||
                  p.patient_id.toLowerCase().includes(query)
                );
              })
              .map((patient, idx) => (
                <View key={idx} style={styles.registryCard}>
                  <Text style={styles.registryName}>{patient.patient_name}</Text>
                  <Text style={styles.registryDetail}>NIC: {patient.national_id ?? 'N/A'}</Text>
                  <Text style={styles.registryDetail}>ID: {patient.patient_id}</Text>
                  <View style={styles.registryRow}>
                    <Text style={styles.registryLabel}>{t.age}:</Text>
                    <Text style={styles.registryValue}>{patient.age || 'N/A'}</Text>
                  </View>
                  <View style={styles.registryRow}>
                    <Text style={styles.registryLabel}>{t.gestation}:</Text>
                    <Text style={styles.registryValue}>{patient.gestation_weeks || t.notAvailable} {t.weeks}</Text>
                  </View>
                  <View style={styles.registryRow}>
                    <Text style={styles.registryLabel}>{t.riskLevel}:</Text>
                    <Text style={[
                      styles.registryValue,
                      patient.risk_level === 'high' ? styles.riskHigh : styles.riskLow
                    ]}>
                      {patient.risk_level || t.notAssessed}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        )}

        {activeTab === 'history' && (
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>{t.screeningHistory}</Text>
            {screeningHistory.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>{t.noHistory}</Text>
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
  syncStatusWrap: {
    flex: 1,
    minWidth: 120,
  },
  syncStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  syncHintText: {
    fontSize: 11,
    color: '#92400e',
    marginTop: 2,
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
  slotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  slotButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  slotButtonActive: {
    borderColor: '#e11d48',
    backgroundColor: '#ffe4e6',
  },
  slotButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  inputHint: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: -2,
    marginBottom: 8,
  },
  dropdownContainer: {
    marginBottom: 8,
    position: 'relative',
    zIndex: 10,
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
  },
  dropdownTriggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownPlaceholderText: {
    fontSize: 14,
    color: '#999',
  },
  dropdownSelectedText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  dropdownModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dropdownModalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  dropdownModalTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  dropdownMenu: {
    marginTop: 4,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#1f2937',
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
