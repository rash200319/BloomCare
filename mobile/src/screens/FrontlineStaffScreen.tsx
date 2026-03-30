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
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { text, assistantNarrative } from '../i18n';
import {
  LanguageCode,
  PatientMiniProfile,
  PendingScreening,
  RiskResponse,
  Stage1VitalsInput,
  User,
} from '../types';
import { calculateMap, DEFAULT_IMPUTE, offlineStage1Risk } from '../services/riskEngine';
import {
  getCachedPatientStage1History,
  getDirtyVitalsCount,
  saveDirtyOfflineVitalsUpdate,
  searchPatientInLocalCache,
  submitRiskOnline,
  syncDirtyVitalsUpdates,
} from '../services/syncService';

interface FrontlineStaffScreenProps {
  user: User;
  onLogout: () => void;
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

  const t = text[language];

  const map = useMemo(() => {
    const systolic = num(fields.systolic, DEFAULT_IMPUTE.systolic);
    const diastolic = num(fields.diastolic, DEFAULT_IMPUTE.diastolic);
    return calculateMap(systolic, diastolic);
  }, [fields.diastolic, fields.systolic]);

  const refreshQueueCount = async (): Promise<void> => {
    try {
      const count = await getDirtyVitalsCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Failed to read dirty update count:', error);
    }
  };

  useEffect(() => {
    refreshQueueCount();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(nowOnline);

      if (nowOnline) {
        syncDirtyVitalsUpdates()
          .then(() => refreshQueueCount())
          .catch(() => {
            // Ignore transient sync failures; records remain flagged dirty.
          });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

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
      await saveDirtyOfflineVitalsUpdate({
        patient_id: user.id,
        patient_name: fields.patientName.trim() || 'Unknown Patient',
        vitals,
        risk_score: risk.risk_score,
        risk_level: risk.risk_level,
        recommendations: risk.recommendations,
      });

      Alert.alert('Saved', 'Record marked for sync (is_synced: false). It will upload when online.');
      setFields(initialFields);
      setRisk(null);
      await refreshQueueCount();
    } catch (error) {
      Alert.alert('Error', 'Failed to save record');
      console.error(error);
    }
  };

  const handleClearForm = (): void => {
    setFields(initialFields);
    setRisk(null);
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
      const result = await syncDirtyVitalsUpdates();
      await refreshQueueCount();

      if (result.synced === 0 && result.pending === 0) {
        Alert.alert('Sync Complete', 'No pending records to sync.');
        return;
      }

      Alert.alert(
        'Sync Complete',
        `Synced: ${result.synced}\nPending: ${result.pending}`
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
        <Pressable
          style={[
            styles.syncNowButton,
            (!online || syncing || pendingCount === 0) && styles.syncNowButtonDisabled,
          ]}
          onPress={handleManualSync}
          disabled={!online || syncing || pendingCount === 0}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.syncNowButtonText}>Sync Now</Text>
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.cardSection}>
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

        {/* Form Section */}
        {!risk ? (
          <View>
            <Text style={styles.sectionTitle}>Patient Assessment</Text>

            {/* Patient Name */}
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

            {/* Two Column Inputs */}
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

            {/* Blood Pressure */}
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

            {/* Blood Sugar & Hemoglobin */}
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

            {/* Other Vitals */}
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

            {/* Risk Factors */}
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

            {/* Lifestyle Factors */}
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

            {/* Action Buttons */}
            <View style={styles.buttonGroup}>
              <Pressable
                style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleCalculateRisk}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{t.assessRisk}</Text>
                )}
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
          /* Risk Result Display */
          <View>
            <Text style={styles.sectionTitle}>{t.result}</Text>

            {/* Risk Score Card */}
            <View style={[
              styles.riskCard,
              risk.risk_level === 'high' ? styles.riskCardHigh : styles.riskCardLow
            ]}>
              <Text style={styles.riskLevel}>
                {risk.risk_level === 'high' ? 'HIGH RISK' : 'LOW RISK'}
              </Text>
              <Text style={styles.riskScore}>
                {Math.round(risk.risk_score * 100)}%
              </Text>
            </View>

            {/* BP Status */}
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Blood Pressure Status</Text>
              <Text style={styles.infoValue}>{risk.bp_status}</Text>
            </View>

            {/* Observation */}
            <View style={styles.observationCard}>
              <Text style={styles.observationLabel}>{t.assistant}</Text>
              <Text style={styles.observationText}>{risk.observation}</Text>
              {/* Narrative */}
              <View style={styles.narrativeBox}>
                <Text style={styles.narrativeText}>
                  {assistantNarrative(language, risk)}
                </Text>
              </View>
            </View>

            {/* Recommendations */}
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

            {/* Action Buttons */}
            <View style={styles.buttonGroup}>
              <Pressable
                style={[styles.button, styles.primaryButton]}
                onPress={handleSaveAndEnqueue}
              >
                <Text style={styles.buttonText}>Save & Queue for Sync</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.secondaryButton]}
                onPress={handleClearForm}
              >
                <Text style={styles.secondaryButtonText}>New Assessment</Text>
              </Pressable>
            </View>
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
