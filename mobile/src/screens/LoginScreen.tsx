import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { text } from '../i18n';
import { LanguageCode, UserRole, LoginCredentials } from '../types';
import authService from '../services/authService';

interface LoginScreenProps {
  onLoginSuccess: (role: UserRole) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [useOfflinePin, setUseOfflinePin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const t = text[language];

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const credentials: LoginCredentials = { email, password };
      const { user, token } = await authService.login(credentials);
      
      if (user.role === 'frontline_staff' || user.role === 'patient') {
        onLoginSuccess(user.role);
      } else {
        Alert.alert('Error', 'Invalid role for mobile app');
      }
    } catch (error) {
      Alert.alert('Login Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfflinePinLogin = async () => {
    if (!pin) {
      Alert.alert('Error', 'Please enter your PIN');
      return;
    }

    if (pin.length < 4) {
      Alert.alert('Error', 'PIN must be at least 4 digits');
      return;
    }

    console.log('🔑 Offline PIN Login Attempt:');
    console.log('  PIN entered:', pin);

    setIsLoading(true);
    try {
      const { user, token } = await authService.loginWithPin({ pin });
      
      if (user.role === 'frontline_staff' || user.role === 'patient') {
        onLoginSuccess(user.role);
      } else {
        Alert.alert('Error', 'Invalid role for mobile app');
      }
    } catch (error) {
      console.log('❌ PIN Login error:', error);
      Alert.alert('Offline Login Failed', error instanceof Error ? error.message : 'Invalid PIN or no saved session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Language Selector */}
        <View style={styles.languageSelector}>
          <Pressable
            style={[styles.langButton, language === 'en' && styles.langButtonActive]}
            onPress={() => setLanguage('en')}
          >
            <Text style={[styles.langButtonText, language === 'en' && styles.langButtonTextActive]}>EN</Text>
          </Pressable>
          <Pressable
            style={[styles.langButton, language === 'si' && styles.langButtonActive]}
            onPress={() => setLanguage('si')}
          >
            <Text style={[styles.langButtonText, language === 'si' && styles.langButtonTextActive]}>SI</Text>
          </Pressable>
          <Pressable
            style={[styles.langButton, language === 'ta' && styles.langButtonActive]}
            onPress={() => setLanguage('ta')}
          >
            <Text style={[styles.langButtonText, language === 'ta' && styles.langButtonTextActive]}>TA</Text>
          </Pressable>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>BloomCare</Text>
          <Text style={styles.subtitle}>Welcome Back</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Pressable
              style={styles.toggleOfflineButton}
              onPress={() => {
                setUseOfflinePin(!useOfflinePin);
                setEmail('');
                setPassword('');
                setPin('');
              }}
              disabled={isLoading}
            >
              <Text style={styles.toggleOfflineText}>
                {useOfflinePin ? '🔒 Offline Mode (PIN)' : '🌐 Online Mode (Email)'}
              </Text>
            </Pressable>
          </View>

          {/* Show only email/password if NOT using offline PIN */}
          {!useOfflinePin && (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t.email}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t.email}
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  editable={!isLoading}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t.password}</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder={t.password}
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    editable={!isLoading}
                  />
                  <Pressable
                    style={styles.togglePasswordButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.togglePasswordText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable style={styles.forgotPasswordButton}>
                <Text style={styles.forgotPasswordText}>{t.forgotPassword}</Text>
              </Pressable>
            </>
          )}

          {/* Show only PIN if using offline mode */}
          {useOfflinePin && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Offline PIN (4+ digits)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your PIN"
                placeholderTextColor="#999"
                keyboardType="number-pad"
                secureTextEntry
                value={pin}
                onChangeText={setPin}
                editable={!isLoading}
              />
            </View>
          )}

          {/* Submit Button */}
          <Pressable
            style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
            onPress={useOfflinePin ? handleOfflinePinLogin : handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {t.login}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 16,
  },
  languageSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
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
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e11d48',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    gap: 16,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#f9fafb',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  passwordInput: {
    flex: 1,
    padding: 12,
    fontSize: 14,
  },
  togglePasswordButton: {
    paddingHorizontal: 12,
  },
  togglePasswordText: {
    fontSize: 12,
    color: '#e11d48',
    fontWeight: '600',
  },
  forgotPasswordButton: {
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#e11d48',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#e11d48',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleOfflineButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e11d48',
    backgroundColor: '#fce7f3',
    alignItems: 'center',
    marginBottom: 8,
  },
  toggleOfflineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e11d48',
  },
});
