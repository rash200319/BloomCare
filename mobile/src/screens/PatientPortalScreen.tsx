import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { text } from '../i18n';
import { LanguageCode, User } from '../types';
import { Feather } from '@expo/vector-icons';

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

export default function PatientPortalScreen({ user, onLogout }: PatientPortalScreenProps) {
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [selectedTab, setSelectedTab] = useState<'home' | 'history' | 'resources'>('home');

  const t = text[language];

  // Mock data - would be fetched from backend in real app
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

  const homeContent = () => (
    <View>
      <Text style={styles.sectionTitle}>Welcome, {user.full_name}</Text>

      {/* Pregnancy Info Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Your Pregnancy</Text>
          <Text style={styles.cardBadge}>Trimester 2</Text>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Weeks Pregnant</Text>
            <Text style={styles.infoValue}>18-20</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Estimated Due Date</Text>
            <Text style={styles.infoValue}>September 15, 2025</Text>
          </View>
        </View>
      </View>

      {/* Quick Health Check */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Health Check</Text>
        <Pressable style={styles.quickCheckButton}>
          <Text style={styles.quickCheckButtonText}>Record Vitals</Text>
        </Pressable>
        <View style={styles.checkItems}>
          <View style={styles.checkItem}>
            <Text style={styles.checkItemIcon}>✓</Text>
            <Text style={styles.checkItemText}>Daily monitoring</Text>
          </View>
          <View style={styles.checkItem}>
            <Text style={styles.checkItemIcon}>✓</Text>
            <Text style={styles.checkItemText}>Stay hydrated</Text>
          </View>
          <View style={styles.checkItem}>
            <Text style={styles.checkItemIcon}>✓</Text>
            <Text style={styles.checkItemText}>Regular exercise</Text>
          </View>
        </View>
      </View>

      {/* Next Appointments */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upcoming Appointments</Text>
        <View style={styles.appointmentItem}>
          <View style={styles.appointmentDate}>
            <Text style={styles.appointmentDay}>04</Text>
            <Text style={styles.appointmentMonth}>APR</Text>
          </View>
          <View style={styles.appointmentDetails}>
            <Text style={styles.appointmentType}>Regular Check-up</Text>
            <Text style={styles.appointmentTime}>At Hospital - 10:00 AM</Text>
          </View>
        </View>
        <View style={styles.appointmentItem}>
          <View style={styles.appointmentDate}>
            <Text style={styles.appointmentDay}>18</Text>
            <Text style={styles.appointmentMonth}>APR</Text>
          </View>
          <View style={styles.appointmentDetails}>
            <Text style={styles.appointmentType}>Ultrasound Scan</Text>
            <Text style={styles.appointmentTime}>At Clinic - 2:00 PM</Text>
          </View>
        </View>
      </View>

      {/* Health Tips */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Daily Wellness Tips</Text>
        <View style={styles.tipItem}>
          <Text style={styles.tipIcon}>💧</Text>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Stay Hydrated</Text>
            <Text style={styles.tipDescription}>Drink at least 8-10 glasses of water daily</Text>
          </View>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipIcon}>🚶</Text>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Light Exercise</Text>
            <Text style={styles.tipDescription}>30 minutes of walking daily is beneficial</Text>
          </View>
        </View>
        <View style={styles.tipItem}>
          <Text style={styles.tipIcon}>😴</Text>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Get Rest</Text>
            <Text style={styles.tipDescription}>Sleep 8-9 hours at night for proper recovery</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const historyContent = () => (
    <View>
      <Text style={styles.sectionTitle}>Health History</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent Check-ins</Text>
        {recentCheckIns.map((checkIn, idx) => (
          <View key={idx} style={styles.historyItem}>
            <View style={styles.historyDate}>
              <Text style={styles.historyDateText}>{checkIn.date}</Text>
            </View>
            <View style={styles.historyData}>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>BP</Text>
                <Text style={styles.historyValue}>{checkIn.systolic}/{checkIn.diastolic}</Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>Blood Sugar</Text>
                <Text style={styles.historyValue}>{checkIn.bs} mg/dL</Text>
              </View>
              <View style={styles.historyRow}>
                <Text style={styles.historyLabel}>Notes</Text>
                <Text style={styles.historyValue}>{checkIn.notes}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Vital Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>120/80</Text>
            <Text style={styles.statLabel}>Avg BP</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>95</Text>
            <Text style={styles.statLabel}>Avg Blood Sugar</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const resourcesContent = () => (
    <View>
      <Text style={styles.sectionTitle}>Resources & Education</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Pregnancy Information</Text>
        <Pressable style={styles.resourceItem}>
          <Text style={styles.resourceIcon}>📖</Text>
          <View style={styles.resourceContent}>
            <Text style={styles.resourceTitle}>Trimester 2 Guide</Text>
            <Text style={styles.resourceDescription}>What to expect this trimester</Text>
          </View>
        </Pressable>
        <Pressable style={styles.resourceItem}>
          <Text style={styles.resourceIcon}>🍎</Text>
          <View style={styles.resourceContent}>
            <Text style={styles.resourceTitle}>Nutrition for Pregnancy</Text>
            <Text style={styles.resourceDescription}>Proper diet for maternal health</Text>
          </View>
        </Pressable>
        <Pressable style={styles.resourceItem}>
          <Text style={styles.resourceIcon}>🏥</Text>
          <View style={styles.resourceContent}>
            <Text style={styles.resourceTitle}>When to Seek Help</Text>
            <Text style={styles.resourceDescription}>Warning signs during pregnancy</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Emergency Contacts</Text>
        <View style={styles.contactItem}>
          <Text style={styles.contactLabel}>Hospital Hotline</Text>
          <Pressable>
            <Text style={styles.contactValue}>+94 11 2 687 000</Text>
          </Pressable>
        </View>
        <View style={styles.contactItem}>
          <Text style={styles.contactLabel}>Emergency</Text>
          <Pressable>
            <Text style={styles.contactValue}>119</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Support</Text>
        <Pressable style={styles.supportButton}>
          <Text style={styles.supportButtonIcon}>💬</Text>
          <Text style={styles.supportButtonText}>Chat with Healthcare Provider</Text>
        </Pressable>
        <Pressable style={styles.supportButton}>
          <Text style={styles.supportButtonIcon}>📞</Text>
          <Text style={styles.supportButtonText}>Schedule a Call</Text>
        </Pressable>
      </View>
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
        <Pressable style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutButtonText}>{t.logout}</Text>
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

      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        <Pressable
          style={[styles.tab, selectedTab === 'home' && styles.tabActive]}
          onPress={() => setSelectedTab('home')}
        >
          <Text style={[styles.tabText, selectedTab === 'home' && styles.tabTextActive]}>Home</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, selectedTab === 'history' && styles.tabActive]}
          onPress={() => setSelectedTab('history')}
        >
          <Text style={[styles.tabText, selectedTab === 'history' && styles.tabTextActive]}>History</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, selectedTab === 'resources' && styles.tabActive]}
          onPress={() => setSelectedTab('resources')}
        >
          <Text style={[styles.tabText, selectedTab === 'resources' && styles.tabTextActive]}>Resources</Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {selectedTab === 'home' && homeContent()}
        {selectedTab === 'history' && historyContent()}
        {selectedTab === 'resources' && resourcesContent()}
        <View style={{ height: 20 }} />
      </ScrollView>
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
    fontSize: 14,
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
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
  quickCheckButton: {
    backgroundColor: '#e11d48',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 12,
  },
  quickCheckButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  checkItems: {
    gap: 8,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkItemIcon: {
    fontSize: 18,
    color: '#16a34a',
  },
  checkItemText: {
    fontSize: 13,
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
