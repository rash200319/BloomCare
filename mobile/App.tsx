import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { User, UserRole } from './src/types';
import authService from './src/services/authService';
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

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const { user: savedUser, token } = await authService.initializeAuth();
        if (savedUser && token) {
          setUser(savedUser);

          if (savedUser.role === 'frontline_staff') {
            // Morning Sync: preload assigned patients + mini history while user is online at clinic.
            try {
              await morningSyncAssignedPatients(savedUser.id);
            } catch (error) {
              // Keep app usable even when sync endpoint/network is unavailable.
            }

            // Try flushing dirty records from previous offline sessions.
            try {
              await syncDirtyVitalsUpdates();
            } catch (error) {
              // Ignore transient upload failures.
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
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

  // Show loading screen
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return (
      <>
        <ExpoStatusBar style="dark" />
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  // Show appropriate dashboard based on user role
  if (user.role === 'frontline_staff') {
    return (
      <>
        <ExpoStatusBar style="dark" />
        <FrontlineStaffScreen user={user} onLogout={handleLogout} />
      </>
    );
  }

  if (user.role === 'patient') {
    return (
      <>
        <ExpoStatusBar style="dark" />
        <PatientPortalScreen user={user} onLogout={handleLogout} />
      </>
    );
  }

  // Unsupported role
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#e11d48" />
    </View>
  );
}
