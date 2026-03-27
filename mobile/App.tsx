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
import { assistantNarrative, text } from './src/i18n';
import { enqueuePending, readPendingQueue } from './src/services/offlineQueue';
import { calculateMap, DEFAULT_IMPUTE, offlineStage1Risk } from './src/services/riskEngine';
import { buildPendingRecord, submitRiskOnline, syncPendingRecords } from './src/services/syncService';
import { FieldState, LanguageCode, RiskResponse, Stage1VitalsInput } from './src/types';

const initialFields: FieldState = {
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

const badgeStyle = (online: boolean): object => ({
  backgroundColor: online ? '#ecfdf3' : '#fef2f2',
  color: online ? '#166534' : '#991b1b'
});

export default function App(): React.JSX.Element {
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [fields, setFields] = useState<FieldState>(initialFields);
  const [risk, setRisk] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const t = text[language];

  const map = useMemo(() => {
    const systolic = num(fields.systolic, DEFAULT_IMPUTE.systolic);
    const diastolic = num(fields.diastolic, DEFAULT_IMPUTE.diastolic);
    return calculateMap(systolic, diastolic);
  }, [fields.diastolic, fields.systolic]);

  const refreshQueueCount = async (): Promise<void> => {
    const queue = await readPendingQueue();
    setPendingCount(queue.length);
  };

  useEffect(() => {
    refreshQueueCount().catch(() => undefined);

    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(nowOnline);
      if (nowOnline) {
        handleSync().catch(() => undefined);
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
      pcos: num(fields.pcos, DEFAULT_IMPUTE.pcos),
      previous_complications: num(fields.previousComplications, DEFAULT_IMPUTE.previous_complications),
      preexisting_diabetes: num(fields.preexistingDiabetes, DEFAULT_IMPUTE.preexisting_diabetes),
      mental_health: num(fields.mentalHealth, DEFAULT_IMPUTE.mental_health),
      sleep_pattern: num(fields.sleepPattern, DEFAULT_IMPUTE.sleep_pattern),
      exercise: num(fields.exercise, DEFAULT_IMPUTE.exercise),
      education: num(fields.education, DEFAULT_IMPUTE.education),
      map: calculateMap(systolic, diastolic)
    };
  };

  const handleSync = async (): Promise<void> => {
    setSyncing(true);
    try {
      const syncResult = await syncPendingRecords();
      setPendingCount(syncResult.pending);
    } finally {
      setSyncing(false);
    }
  };

  const handleRiskAssessment = async (): Promise<void> => {
    setLoading(true);

    const vitals = buildVitalsInput();

    try {
      if (online) {
        const response = await submitRiskOnline(vitals, 7000);
        if (response.ok) {
          try {
            const onlineResult: RiskResponse = await response.json();
            setRisk(onlineResult);

            // Keep assessment snappy; sync in background without blocking UI state.
            handleSync().catch(() => undefined);
            return;
          } catch {
            // If response parsing fails, fall through to offline mode.
          }
        }
      }

      const offlineResult = offlineStage1Risk(vitals);
      setRisk(offlineResult);
      await enqueuePending(buildPendingRecord(vitals));
      await refreshQueueCount();
    } catch {
      const offlineResult = offlineStage1Risk(vitals);
      setRisk(offlineResult);
      await enqueuePending(buildPendingRecord(vitals));
      await refreshQueueCount();
    } finally {
      setLoading(false);
    }
  };

  const setField = (key: keyof FieldState, value: string): void => {
    setFields((previous) => ({ ...previous, [key]: value }));
  };

  const resetForm = (): void => {
    setFields(initialFields);
    setRisk(null);
  };

  const riskColor = risk?.risk_level === 'high' ? '#991b1b' : '#166534';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <ExpoStatusBar style="dark" />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>{t.appTitle}</Text>
          <Text style={styles.subtitle}>{t.appSubtitle}</Text>

          <View style={styles.languageRow}>
            {(['en', 'si', 'ta'] as LanguageCode[]).map((code) => (
              <Pressable
                key={code}
                style={[styles.languageChip, language === code && styles.languageChipActive]}
                onPress={() => setLanguage(code)}
              >
                <Text style={[styles.languageChipText, language === code && styles.languageChipTextActive]}>{code.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.statusRow}>
            <Text style={[styles.statusBadge, badgeStyle(online)]}>
              {online ? t.online : t.offline}
            </Text>
            <Text style={styles.pendingText}>
              {t.pendingSync}: {pendingCount}
            </Text>
            <Pressable style={styles.syncButton} onPress={() => handleSync().catch(() => Alert.alert('Sync failed'))}>
              {syncing ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.syncButtonText}>{t.syncNow}</Text>}
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Input label={t.patientName} value={fields.patientName} onChangeText={(v) => setField('patientName', v)} />
          <Input label={t.age} value={fields.age} keyboardType="numeric" onChangeText={(v) => setField('age', v)} />
          <Input label={t.systolic} value={fields.systolic} keyboardType="numeric" onChangeText={(v) => setField('systolic', v)} />
          <Input label={t.diastolic} value={fields.diastolic} keyboardType="numeric" onChangeText={(v) => setField('diastolic', v)} />
          <Input label={t.bmi} value={fields.bmi} keyboardType="numeric" onChangeText={(v) => setField('bmi', v)} />
          <Input label={t.heartRate} value={fields.heartRate} keyboardType="numeric" onChangeText={(v) => setField('heartRate', v)} />
          <Input label={t.bloodSugar} value={fields.bs} keyboardType="numeric" onChangeText={(v) => setField('bs', v)} />
          <Input label={t.temperature} value={fields.temperature} keyboardType="numeric" onChangeText={(v) => setField('temperature', v)} />
          <Input label={t.hemoglobin} value={fields.hemoglobin} keyboardType="numeric" onChangeText={(v) => setField('hemoglobin', v)} />
          <Input label={t.pcos} value={fields.pcos} keyboardType="numeric" onChangeText={(v) => setField('pcos', v)} />
          <Input label={t.prevComplications} value={fields.previousComplications} keyboardType="numeric" onChangeText={(v) => setField('previousComplications', v)} />
          <Input label={t.preexistingDiabetes} value={fields.preexistingDiabetes} keyboardType="numeric" onChangeText={(v) => setField('preexistingDiabetes', v)} />
          <Input label={t.mentalHealth} value={fields.mentalHealth} keyboardType="numeric" onChangeText={(v) => setField('mentalHealth', v)} />
          <Input label={t.sleepPattern} value={fields.sleepPattern} keyboardType="numeric" onChangeText={(v) => setField('sleepPattern', v)} />
          <Input label={t.exercise} value={fields.exercise} keyboardType="numeric" onChangeText={(v) => setField('exercise', v)} />
          <Input label={t.education} value={fields.education} keyboardType="numeric" onChangeText={(v) => setField('education', v)} />

          <Text style={styles.mapText}>MAP: {map.toFixed(1)} mmHg</Text>

          <View style={styles.actionRow}>
            <Pressable style={styles.primaryButton} onPress={() => handleRiskAssessment().catch(() => Alert.alert('Assessment failed'))}>
              {loading ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.primaryButtonText}>{t.assessRisk}</Text>}
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={resetForm}>
              <Text style={styles.secondaryButtonText}>{t.clearForm}</Text>
            </Pressable>
          </View>
        </View>

        {risk && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t.result}</Text>
            <Text style={[styles.riskLevel, { color: riskColor }]}>Level: {risk.risk_level.toUpperCase()}</Text>
            <Text style={styles.metaText}>Score: {Math.round(risk.risk_score * 100)}%</Text>
            <Text style={styles.metaText}>BP Status: {risk.bp_status}</Text>
            <Text style={styles.metaText}>{risk.observation}</Text>

            <Text style={[styles.sectionTitle, styles.marginTop]}>{t.recommendations}</Text>
            {risk.recommendations.map((item) => (
              <Text key={item} style={styles.bulletItem}>- {item}</Text>
            ))}

            <Text style={[styles.sectionTitle, styles.marginTop]}>{t.assistant}</Text>
            <Text style={styles.assistantText}>{assistantNarrative(language, risk)}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'numeric';
};

function Input({ label, value, onChangeText, keyboardType = 'default' }: InputProps): React.JSX.Element {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  container: {
    padding: 16,
    paddingBottom: 44,
    gap: 14
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a'
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#334155'
  },
  languageRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8
  },
  languageChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  languageChipActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8'
  },
  languageChipText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '700'
  },
  languageChipTextActive: {
    color: '#ffffff'
  },
  statusRow: {
    marginTop: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap'
  },
  statusBadge: {
    borderRadius: 999,
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: '700'
  },
  pendingText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600'
  },
  syncButton: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10
  },
  syncButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1
  },
  fieldWrap: {
    marginBottom: 10
  },
  label: {
    color: '#334155',
    fontSize: 12,
    marginBottom: 4,
    fontWeight: '600'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc'
  },
  mapText: {
    marginTop: 6,
    marginBottom: 10,
    fontWeight: '700',
    color: '#0f172a'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700'
  },
  sectionTitle: {
    fontWeight: '800',
    fontSize: 15,
    color: '#0f172a'
  },
  riskLevel: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '900'
  },
  metaText: {
    marginTop: 4,
    color: '#334155',
    fontSize: 13
  },
  bulletItem: {
    marginTop: 6,
    color: '#0f172a',
    fontSize: 13,
    lineHeight: 18
  },
  marginTop: {
    marginTop: 12
  },
  assistantText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: '#0f172a'
  }
});
