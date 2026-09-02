import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { User, UserRole, LanguageCode } from './src/types';
import authService from './src/services/authService';
import networkStatusService from './src/services/networkStatusService';
import backgroundSyncService from './src/services/backgroundSyncService';
import { loadLanguage, saveLanguage } from './src/services/languageService';
import {
  morningSyncAssignedPatients,
  syncDirtyVitalsUpdates,
} from './src/services/syncService';
import LoginScreen from './src/screens/LoginScreen';
import FrontlineStaffScreen from './src/screens/FrontlineStaffScreen';
import PatientPortalScreen from './src/screens/PatientPortalScreen';

export default function App(): React.JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [language, setLanguage] = useState<LanguageCode>('en');

  const handleLanguageChange = (lang: LanguageCode): void => {
    setLanguage(lang);
    void saveLanguage(lang);
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const savedLanguage = await loadLanguage();
        setLanguage(savedLanguage);

        await networkStatusService.initialize();
        setIsOnline(networkStatusService.getStatus());

        const { user: savedUser, token, isOffline } = await authService.initializeAuth();
        
        if (savedUser && token) {
          setUser(savedUser);

          if (!isOffline && networkStatusService.getStatus()) {
            if (savedUser.role === 'frontline_staff') {
              try {
                await morningSyncAssignedPatients(savedUser.id);
              } catch (error) {
                console.error('Morning sync failed:', error);
              }

              try {
                await syncDirtyVitalsUpdates();
              } catch (error) {
                console.error('Dirty sync failed:', error);
              }
            }
          }

          await backgroundSyncService.initialize();
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();

    const unsubscribe = networkStatusService.subscribe((online) => {
      setIsOnline(online);
    });

    return () => {
      unsubscribe();
      backgroundSyncService.stop();
    };
  }, []);

  const handleLoginSuccess = (role: UserRole) => {
    const currentUser = authService.getUser();
    if (currentUser) {
      setUser(currentUser);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  if (!user) {
    return (
      <>
        <ExpoStatusBar style="dark" />
        <LoginScreen
          onLoginSuccess={handleLoginSuccess}
          isOnline={isOnline}
          language={language}
          onLanguageChange={handleLanguageChange}
        />
      </>
    );
  }

  if (user.role === 'frontline_staff') {
    return (
      <>
        <ExpoStatusBar style="dark" />
        <FrontlineStaffScreen
          user={user}
          onLogout={handleLogout}
          isOnline={isOnline}
          language={language}
          onLanguageChange={handleLanguageChange}
        />
      </>
    );
  }

  if (user.role === 'patient') {
    return (
      <>
        <ExpoStatusBar style="dark" />
        <PatientPortalScreen
          user={user}
          onLogout={handleLogout}
          isOnline={isOnline}
          language={language}
          onLanguageChange={handleLanguageChange}
        />
      </>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#e11d48" />
    </View>
  );
}
