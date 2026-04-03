import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { text } from '../i18n';
import { LanguageCode, User } from '../types';
import authService from '../services/authService';
import { API_BASE_URL } from '../config/api';
import offlineDatabase from '../services/offlineDatabase';
import { getWeeklyInsight } from '../lib/weekly-insights';

interface PatientPortalScreenProps {
  user: User;
  onLogout: () => void;
  isOnline?: boolean;
}

interface CheckIn {
  date: string;
  systolic: number;
  diastolic: number;
  bs: number;
  notes: string;
}

interface Prescription {
  id: string;
  medication_name: string;
  dosage?: string;
  frequency?: string;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  doctor_full_name?: string;
}

interface Appointment {
  id: string;
  title: string;
  scheduled_for: string;
  appointment_type?: string;
  status?: string;
}

interface PatientProfile {
  full_name: string;
  due_date?: string;
  gestational_week?: number;
  blood_group?: string;
}

interface ScreenFactor {
  name: string;
  value: string;
}

export default function PatientPortalScreen({ user, onLogout }: PatientPortalScreenProps) {
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [selectedTab, setSelectedTab] = useState<'home' | 'care' | 'visits' | 'insights'>('home');
  const [isOnline, setIsOnline] = useState(true);
  
  // Data states
  const [patientProfile, setPatientProfile] = useState<PatientProfile>({
    full_name: user.full_name,
  });
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [latestScreening, setLatestScreening] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExplaining, setIsExplaining] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');

  const t = text[language];

  // Mock recent check-ins for history tab
  const recentCheckIns: CheckIn[] = [
    {
      date: '2025-03-28',
      systolic: 118,
      diastolic: 76,
      bs: 92,
      notes: 'Feeling good, no issues'
    },
    {
      date: '2025-03-21',
      systolic: 125,
      diastolic: 82,
      bs: 98,
      notes: 'Slight headache in afternoon'
    }
  ];

  // Calculate gestational week from due date
  const calculateGestationalWeek = (dueDate?: string): number => {
    if (!dueDate) return 24;
    try {
      const due = new Date(dueDate);
      const conception = new Date(due);
      conception.setDate(conception.getDate() - (40 * 7));
      const now = new Date();
      const weeks = Math.floor((now.getTime() - conception.getTime()) / (7 * 24 * 60 * 60 * 1000));
      return Math.max(0, Math.min(weeks, 40));
    } catch {
      return 24;
    }
  };

  const extractTopFactors = (source: any): ScreenFactor[] => {
    const factors: ScreenFactor[] = [];
    const entries = source && typeof source === 'object' ? source : {};
    const rawFeatures = Array.isArray(entries.features) ? entries.features : [];

    if (rawFeatures.length > 0) {
      rawFeatures
        .filter((item: any) => item && typeof item === 'object')
        .slice(0, 3)
        .forEach((item: any) => {
          const name = String(item.feature || item.name || 'factor').trim();
          const value = typeof item.importance === 'number'
            ? item.importance.toFixed(2)
            : typeof item.contribution === 'number'
              ? item.contribution.toFixed(2)
              : String(item.value ?? 'n/a');
          if (name) factors.push({ name, value });
        });
      return factors;
    }

    Object.entries(entries)
      .filter(([, value]) => typeof value === 'number')
      .slice(0, 3)
      .forEach(([name, value]) => {
        factors.push({ name, value: Number(value).toFixed(2) });
      });

    return factors;
  };

  const buildLocalScreeningExplanation = (): string => {
    const stage1 = latestScreening?.latest_stage1;
    const stage2 = latestScreening?.latest_stage2;
    const report = latestScreening?.latest_screening_report;
    const factors = extractTopFactors(stage2?.explainability_data || stage1?.contributing_factors || {});
    const bloodSugar = stage1?.blood_sugar;
    const systolic = stage1?.systolic;
    const diastolic = stage1?.diastolic;
    const riskLabel = String(report?.general_risk_flag || stage2?.dominant_condition || 'monitoring');

    if (language === 'si') {
      return [
        `ඔබේ නවතම screening තත්ත්වය ${riskLabel} වේ.`,
        stage1 ? `BP ${systolic ?? 'n/a'}/${diastolic ?? 'n/a'} සහ blood sugar ${bloodSugar ?? 'n/a'} දක්නට ලැබේ.` : null,
        factors.length > 0 ? `වැදගත් සාධක: ${factors.map((item) => `${item.name} (${item.value})`).join(', ')}.` : null,
        'මෙය සාමාන්‍ය වෛද්‍ය උපදෙස් වෙනුවට නොවේ; අවශ්‍ය නම් ඔබේ වෛද්‍යවරයා සමඟ සාකච්ඡා කරන්න.',
      ].filter(Boolean).join(' ');
    }

    if (language === 'ta') {
      return [
        `உங்கள் சமீபத்திய screening நிலை ${riskLabel}.`,
        stage1 ? `BP ${systolic ?? 'n/a'}/${diastolic ?? 'n/a'} மற்றும் blood sugar ${bloodSugar ?? 'n/a'} காணப்படுகிறது.` : null,
        factors.length > 0 ? `முக்கிய காரணிகள்: ${factors.map((item) => `${item.name} (${item.value})`).join(', ')}.` : null,
        'இது மருத்துவ ஆலோசனைக்கு மாற்றாகாது; தேவைப்பட்டால் உங்கள் மருத்துவரிடம் பேசுங்கள்.',
      ].filter(Boolean).join(' ');
    }

    return [
      `Your latest screening is in ${riskLabel} status.`,
      stage1 ? `BP is ${systolic ?? 'n/a'}/${diastolic ?? 'n/a'} and blood sugar is ${bloodSugar ?? 'n/a'}.` : null,
      factors.length > 0 ? `Top factors: ${factors.map((item) => `${item.name} (${item.value})`).join(', ')}.` : null,
      'This is a screening summary, not a diagnosis. Please discuss it with your doctor if you have concerns.',
    ].filter(Boolean).join(' ');
  };

  // Fetch patient data from backend
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const token = await getStoredToken();
        if (!token) {
          console.log('No token available - using offline mode');
          setIsLoading(false);
          return;
        }

        // Fetch patient dashboard
        try {
          const dashRes = await fetch(`${API_BASE_URL}/dashboard/patient/dashboard`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (dashRes.ok) {
            const dashData = await dashRes.json();
            const cachedPatient = await offlineDatabase.getPatientProfile(user.id).catch(() => null);
            setPatientProfile((prev) => ({
              ...prev,
              full_name: dashData?.full_name || prev.full_name,
              due_date: dashData?.due_date || cachedPatient?.due_date || prev.due_date,
              blood_group: dashData?.blood_group || cachedPatient?.blood_group || prev.blood_group,
            }));
          }
        } catch (err) {
          console.log('Dashboard fetch failed:', err);
        }

        // Fetch patient table fields such as blood group from patient-management lookup
        try {
          const patientRes = await fetch(`${API_BASE_URL}/patient-management/by-id/${user.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (patientRes.ok) {
            const patientRows = await patientRes.json();
            const patientRecord = Array.isArray(patientRows) ? patientRows[0] : patientRows;
            if (patientRecord) {
              setPatientProfile((prev) => ({
                ...prev,
                blood_group: patientRecord.blood_group || prev.blood_group,
                due_date: patientRecord.due_date || prev.due_date,
              }));
            }
          }
        } catch (err) {
          console.log('Patient management fetch failed:', err);
        }

        // Fetch prescriptions
        try {
          const rxRes = await fetch(`${API_BASE_URL}/prescriptions/patient/${user.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (rxRes.ok) {
            const rxData = await rxRes.json();
            setPrescriptions(Array.isArray(rxData) ? rxData : []);
          }
        } catch (err) {
          console.log('Prescriptions fetch failed:', err);
        }

        // Fetch appointments
        try {
          const apptRes = await fetch(`${API_BASE_URL}/appointments/patient/${user.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (apptRes.ok) {
            const apptData = await apptRes.json();
            setAppointments(Array.isArray(apptData) ? apptData : []);
          }
        } catch (err) {
          console.log('Appointments fetch failed:', err);
        }

        // Fetch latest screenings
        try {
          const screenRes = await fetch(`${API_BASE_URL}/patients/me/latest-screenings`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (screenRes.ok) {
            const screenData = await screenRes.json();
            setLatestScreening(screenData);
          }
        } catch (err) {
          console.log('Screening fetch failed:', err);
        }
      } catch (error) {
        console.error('Data fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user.id]);

  // Network status listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  // Get stored token (mock - in real app use secure storage)
  const getStoredToken = async () => {
    return authService.getStoredToken();
  };

  // Explain latest screenings
  const explainLatestScreenings = async () => {
    if (!latestScreening) {
      Alert.alert('No Data', 'No screening data available');
      return;
    }

    setIsExplaining(true);
    try {
      setAiExplanation(buildLocalScreeningExplanation());
    } catch (error) {
      console.error('Error explaining screening:', error);
      setAiExplanation('Error getting explanation. Please try again online.');
    } finally {
      setIsExplaining(false);
    }
  };

  const homeContent = () => {
    const gestationalWeek = calculateGestationalWeek(patientProfile.due_date);
    const daysToDelivery = patientProfile.due_date ? 
      Math.max(0, Math.ceil((new Date(patientProfile.due_date).getTime() - new Date().getTime()) / (24 * 60 * 60 * 1000))) 
      : 0;
    
    return (
      <View>
        <Text style={styles.sectionTitle}>Welcome, {patientProfile.full_name?.split(' ')[0]}</Text>

        {/* Pregnancy Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {language === 'en' ? 'Your Pregnancy' : language === 'si' ? 'ඔබේ ගර්භණ' : 'உங்கள் கர்ப்பநિலை'}
            </Text>
            <Text style={styles.cardBadge}>
              {gestationalWeek <= 13 ? '1st' : gestationalWeek <= 27 ? '2nd' : '3rd'} Trimester
            </Text>
          </View>
          <View style={styles.cardContent}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {language === 'en' ? 'Weeks Pregnant' : language === 'si' ? 'ගර්භණ සතිය' : 'கர்ப்பக் கால வாரம்'}
              </Text>
              <Text style={styles.infoValue}>{gestationalWeek}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {language === 'en' ? 'Estimated Due Date' : language === 'si' ? 'ප්‍රසව දිනය' : 'பிரசவ தேதி'}
              </Text>
              <Text style={styles.infoValue}>{patientProfile.due_date || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {language === 'en' ? 'Blood Group' : language === 'si' ? 'රුධිර කාණ්ඩ' : 'இரத்த வகை'}
              </Text>
              <Text style={styles.infoValue}>{patientProfile.blood_group || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Upcoming Appointments */}
        {appointments.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {language === 'en' ? 'Upcoming Appointments' : language === 'si' ? 'ඉදිරි පත්‍රිකා' : 'வரவிருக்கும் சந்திப்புகள்'}
            </Text>
            {appointments.slice(0, 2).map((appt, idx) => {
              const apptDate = new Date(appt.scheduled_for);
              return (
                <View key={idx} style={styles.appointmentItem}>
                  <View style={styles.appointmentDate}>
                    <Text style={styles.appointmentDay}>{apptDate.getDate().toString().padStart(2, '0')}</Text>
                    <Text style={styles.appointmentMonth}>{apptDate.toLocaleString('default', { month: 'short' }).toUpperCase()}</Text>
                  </View>
                  <View style={styles.appointmentDetails}>
                    <Text style={styles.appointmentType} numberOfLines={1}>{appt.title || appt.appointment_type || 'Appointment'}</Text>
                    <Text style={styles.appointmentTime}>{apptDate.toLocaleTimeString()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* AI Screening Explanation */}
        {latestScreening && (latestScreening.latest_stage1 || latestScreening.latest_stage2) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {language === 'en' ? 'Screening Analysis' : language === 'si' ? 'පරීක්ෂණ විශ්ලේෂණ' : 'ஸ்கிரீனிங் பகுப்பாய்வு'}
            </Text>
            <Pressable
              style={[styles.explainButton, isExplaining && { opacity: 0.6 }]}
              onPress={explainLatestScreenings}
              disabled={isExplaining}
            >
              {isExplaining ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.explainButtonText}>
                  {language === 'en' ? 'Explain My Results' : language === 'si' ? 'ප්‍රතිඵල පැහැදිලි කරන්න' : 'முடிவுகளை விளக்கவும்'}
                </Text>
              )}
            </Pressable>
            {aiExplanation && (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationText}>{aiExplanation}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const carePlanContent = () => (
    <View>
      <Text style={styles.sectionTitle}>
        {language === 'en' ? 'Care Plan' : language === 'si' ? 'සත්කාර සැලැස්ම' : 'சிகிச்சை திட்டம்'}
      </Text>

      {prescriptions.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            {language === 'en' ? 'No active prescriptions' : language === 'si' ? 'ක්‍රියාශීල ඖෂධ නොමැත' : 'செயலில் உள்ள மருந்துகள் இல்லை'}
          </Text>
        </View>
      ) : (
        prescriptions.map((rx, idx) => (
          <View key={idx} style={styles.card}>
            <Text style={styles.cardTitle}>{rx.medication_name}</Text>
            <View style={styles.prescriptionDetail_}>
              <Text style={styles.label}>
                {language === 'en' ? 'Dosage' : language === 'si' ? 'මාත්රා' : 'அளவு'}
              </Text>
              <Text style={styles.value}>{rx.dosage || 'N/A'}</Text>
            </View>
            <View style={styles.prescriptionDetail_}>
              <Text style={styles.label}>
                {language === 'en' ? 'Frequency' : language === 'si' ? 'සංඛ්‍යාතය' : 'அதிர்வெண்'}
              </Text>
              <Text style={styles.value}>{rx.frequency || 'N/A'}</Text>
            </View>
            <View style={styles.prescriptionDetail_}>
              <Text style={styles.label}>
                {language === 'en' ? 'Route' : language === 'si' ? 'මාර්ගය' : 'வழி'}
              </Text>
              <Text style={styles.value}>{rx.route || 'Oral'}</Text>
            </View>
            {rx.doctor_full_name && (
              <View style={styles.prescriptionDetail_}>
                <Text style={styles.label}>
                  {language === 'en' ? 'Prescribed By' : language === 'si' ? 'නිර්දේශ කරන ලද' : 'விதிக்கப்பட்ட'}
                </Text>
                <Text style={styles.value}>Dr. {rx.doctor_full_name}</Text>
              </View>
            )}
            <View style={styles.prescriptionDetail_}>
              <Text style={styles.label}>
                {language === 'en' ? 'Period' : language === 'si' ? 'කාල පරිච්ඡේද' : 'காலம்'}
              </Text>
              <Text style={styles.value}>
                {rx.start_date && rx.end_date ? `${rx.start_date} to ${rx.end_date}` : 'See instructions'}
              </Text>
            </View>
          </View>
        ))
      )}
    </View>
  );

  const visitsContent = () => (
    <View>
      <Text style={styles.sectionTitle}>
        {language === 'en' ? 'Visits' : language === 'si' ? 'හමුවීම්' : 'சந்திப்புகள்'}
      </Text>

      {appointments.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyText}>
            {language === 'en' ? 'No upcoming appointments' : language === 'si' ? 'ඉදිරි හමුවීම් නොමැත' : 'வரவிருக்கும் சந்திப்புகள் இல்லை'}
          </Text>
        </View>
      ) : (
        appointments.map((appt, idx) => {
          const apptDate = new Date(appt.scheduled_for);

          return (
            <View key={idx} style={styles.card}>
              <View style={styles.appointmentHeader}>
                <View style={styles.largeDate}>
                  <Text style={styles.largeDay}>{apptDate.getDate().toString().padStart(2, '0')}</Text>
                  <Text style={styles.largeMonth}>{apptDate.toLocaleString('default', { month: 'short' }).toUpperCase()}</Text>
                  <Text style={styles.largeYear}>{apptDate.getFullYear()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appointmentTitle}>{appt.title || appt.appointment_type || 'Appointment'}</Text>
                  <Text style={styles.appointmentTime}>{apptDate.toLocaleTimeString()}</Text>
                  <Text style={[styles.appointmentTime, { marginTop: 4 }]}>
                    {language === 'en' ? 'Status: ' : language === 'si' ? 'තත්ත්වය: ' : 'நிலை: '}
                    {appt.status || 'Scheduled'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );

  const insightsContent = () => (
    <View>
      <Text style={styles.sectionTitle}>
        {language === 'en' ? 'Health Insights' : language === 'si' ? 'සෞඛ්‍ය විදසුන්' : 'சுகாதார நுண்ணறிவு'}
      </Text>

      {(() => {
        const gestationalWeek = calculateGestationalWeek(patientProfile.due_date);
        const weeklyInsight = getWeeklyInsight(gestationalWeek, language);

        return (
          <View style={styles.card}>
            <Text style={styles.cardBadge}>{`Week ${weeklyInsight.week}`}</Text>
            <Text style={styles.insightTitle}>
              {language === 'en' ? 'Weekly Pregnancy Tips' : language === 'si' ? 'සතිපතා ගර්භණී උපදෙස්' : 'வாராந்த கர்ப்ப குறிப்புகள்'}
            </Text>
            <Text style={styles.insightDescription}>{weeklyInsight.description}</Text>

            {weeklyInsight.facts.map((fact, idx) => (
              <View key={idx} style={styles.tipItem}>
                <Text style={styles.tipIcon}>•</Text>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>{fact.title}</Text>
                  <Text style={styles.tipDescription}>{fact.description}</Text>
                </View>
              </View>
            ))}
          </View>
        );
      })()}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>BloomCare</Text>
          <Text style={styles.headerSubtitle}>Patient Portal</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {/* Online/Offline Badge */}
          <View style={[styles.badge, !isOnline && styles.badgeOffline]}>
            <Text style={[styles.badgeText, !isOnline && styles.badgeOfflineText]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          <Pressable style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutButtonText}>
              {language === 'en' ? 'Logout' : language === 'si' ? 'ඉවත් වන්න' : 'வெளியேறு'}
            </Text>
          </Pressable>
        </View>
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
          style={[styles.tab, selectedTab === 'home' && styles.tabActive]}
          onPress={() => setSelectedTab('home')}
        >
          <Text style={[styles.tabText, selectedTab === 'home' && styles.tabTextActive]}>
            {language === 'en' ? 'Home' : language === 'si' ? 'ගෙය' : 'வீடு'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, selectedTab === 'care' && styles.tabActive]}
          onPress={() => setSelectedTab('care')}
        >
          <Text style={[styles.tabText, selectedTab === 'care' && styles.tabTextActive]}>
            {language === 'en' ? 'Care' : language === 'si' ? 'සත්කාර' : 'பராமரிப்பு'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, selectedTab === 'visits' && styles.tabActive]}
          onPress={() => setSelectedTab('visits')}
        >
          <Text style={[styles.tabText, selectedTab === 'visits' && styles.tabTextActive]}>
            {language === 'en' ? 'Visits' : language === 'si' ? 'හමුවීම්' : 'சந்திப்புகள்'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, selectedTab === 'insights' && styles.tabActive]}
          onPress={() => setSelectedTab('insights')}
        >
          <Text style={[styles.tabText, selectedTab === 'insights' && styles.tabTextActive]}>
            {language === 'en' ? 'Tips' : language === 'si' ? 'ඉඟි' : 'குறிப்புகள்'}
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e11d48" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {selectedTab === 'home' && homeContent()}
          {selectedTab === 'care' && carePlanContent()}
          {selectedTab === 'visits' && visitsContent()}
          {selectedTab === 'insights' && insightsContent()}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
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
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ecfdf5',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  badgeOffline: {
    backgroundColor: '#fef2f2',
    borderColor: '#fca5a5',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#16a34a',
  },
  badgeOfflineText: {
    color: '#dc2626',
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
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    gap: 8,
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  cardBadge: {
    backgroundColor: '#fce7f3',
    color: '#be185d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '600',
  },
  cardContent: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  prescriptionItem: {
    paddingVertical: 12,
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
  },
  prescriptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  prescriptionDetail: {
    fontSize: 12,
    color: '#666',
  },
  prescriptionDetail_: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
  },
  label: {
    fontSize: 12,
    color: '#666',
  },
  value: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  appointmentItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
  },
  appointmentDate: {
    backgroundColor: '#fce7f3',
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  appointmentDay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#be185d',
  },
  appointmentMonth: {
    fontSize: 11,
    color: '#be185d',
    fontWeight: '600',
  },
  appointmentDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  appointmentType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  appointmentTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  appointmentHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  largeDate: {
    backgroundColor: '#fce7f3',
    width: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 12,
  },
  largeDay: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#be185d',
  },
  largeMonth: {
    fontSize: 12,
    color: '#be185d',
    fontWeight: '600',
  },
  largeYear: {
    fontSize: 10,
    color: '#be185d',
  },
  appointmentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  explainButton: {
    backgroundColor: '#e11d48',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  explainButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  explanationBox: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  explanationText: {
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  insightDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  tipItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
  },
  tipIcon: {
    fontSize: 24,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  tipDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  historyItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
  },
  historyDate: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 4,
    justifyContent: 'center',
  },
  historyDateText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  historyData: {
    flex: 1,
    gap: 4,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyLabel: {
    fontSize: 12,
    color: '#666',
  },
  historyValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1f2937',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e11d48',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
  },
  resourceItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
    alignItems: 'flex-start',
  },
  resourceIcon: {
    fontSize: 24,
  },
  resourceContent: {
    flex: 1,
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  resourceDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  contactItem: {
    paddingVertical: 12,
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e11d48',
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    marginBottom: 8,
  },
  supportButtonIcon: {
    fontSize: 20,
  },
  supportButtonText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
});
