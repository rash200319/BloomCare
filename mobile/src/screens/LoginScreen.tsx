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
import { LanguageCode, UserRole } from '../types';
import authService from '../services/authService';

interface LoginScreenProps {
  onLoginSuccess: (role: UserRole) => void;
  isOnline: boolean;
}

type LoginStep = 'role-selection' | 'online-login' | 'first-password-setup' | 'offline-pin' | 'pin-setup';

export default function LoginScreen({ onLoginSuccess, isOnline }: LoginScreenProps) {
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [step, setStep] = useState<LoginStep>('role-selection');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allowPinSkip, setAllowPinSkip] = useState(false);

  const t = text[language];

  const resetOnlineForm = (): void => {
    setEmail('');
    setNationalId('');
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTemporaryPassword('');
  };

  const handleRoleSelect = (role: UserRole): void => {
    setSelectedRole(role);
    setStep('online-login');
  };

  const handleOnlineLogin = async (): Promise<void> => {
    if (!isOnline) {
      Alert.alert('Internet Required', 'First-time login requires an internet connection.');
      return;
    }

    if (!selectedRole) {
      Alert.alert('Error', 'Please choose a role first');
      return;
    }

    if (selectedRole === 'patient') {
      const nic = nationalId.trim().toUpperCase();
      if (!nic || !password) {
        Alert.alert('Error', 'Please enter NIC and password');
        return;
      }

      setIsLoading(true);
      try {
        const { user, isFirstLogin } = await authService.loginPatient(nic, password);
        if (user.role !== 'patient') {
          Alert.alert('Error', 'Patient login required');
          return;
        }

        if (isFirstLogin) {
          setTemporaryPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setStep('first-password-setup');
          return;
        }

        setPin('');
        setPinConfirm('');
        setAllowPinSkip(true);
        setStep('pin-setup');
      } catch (error) {
        Alert.alert('Login Failed', error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const { user, isFirstLogin } = await authService.loginStaff(email.trim().toLowerCase(), password);
      if (user.role !== 'frontline_staff') {
        Alert.alert('Error', 'Staff login required');
        return;
      }

      if (isFirstLogin) {
        setTemporaryPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setStep('first-password-setup');
        return;
      }

      setPin('');
      setPinConfirm('');
      setAllowPinSkip(true);
      setStep('pin-setup');
    } catch (error) {
      Alert.alert('Login Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFirstPasswordSetup = async (): Promise<void> => {
    if (!isOnline) {
      Alert.alert('Internet Required', 'You should be online for this step.');
      return;
    }

    if (!selectedRole) {
      Alert.alert('Error', 'Please choose a role first');
      return;
    }

    if (selectedRole === 'patient' && !nationalId.trim()) {
      Alert.alert('Error', 'Please enter NIC');
      return;
    }

    if (selectedRole !== 'patient' && !email.trim()) {
      Alert.alert('Error', 'Please enter email');
      return;
    }

    if (!temporaryPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please enter temporary password, new password, and confirmation');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      if (selectedRole === 'patient') {
        const nic = nationalId.trim().toUpperCase();
        await authService.setupPatientFirstLoginPassword(nic, temporaryPassword, newPassword, confirmPassword);
        await authService.loginPatient(nic, newPassword);
      } else {
        const userEmail = email.trim().toLowerCase();
        await authService.setupStaffFirstLoginPassword(userEmail, temporaryPassword, newPassword, confirmPassword);
        await authService.loginStaff(userEmail, newPassword);
      }

      setPin('');
      setPinConfirm('');
      setAllowPinSkip(false);
      setStep('pin-setup');
    } catch (error) {
      Alert.alert('Password Setup Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSetup = async (): Promise<void> => {
    if (!pin || !pinConfirm) {
      Alert.alert('Error', 'Please enter and confirm your PIN');
      return;
    }

    if (pin.length < 4 || pin.length > 6) {
      Alert.alert('Error', 'PIN must be 4-6 digits');
      return;
    }

    if (pin !== pinConfirm) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }

    setIsLoading(true);
    try {
      await authService.setPinForOfflineAccess(pin);
      const user = authService.getUser();
      if (user) {
        onLoginSuccess(user.role);
      }
    } catch (error) {
      Alert.alert('PIN Setup Failed', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOfflinePinLogin = async (): Promise<void> => {
    if (!pin) {
      Alert.alert('Error', 'Please enter your PIN');
      return;
    }

    if (pin.length < 4 || pin.length > 6) {
      Alert.alert('Error', 'PIN must be 4-6 digits');
      return;
    }

    setIsLoading(true);
    try {
      const { user } = await authService.loginWithPin(pin);
      if (user) {
        onLoginSuccess(user.role);
      }
    } catch (error) {
      Alert.alert('Offline Login Failed', error instanceof Error ? error.message : 'Invalid PIN or no saved session');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>BloomCare</Text>
          <View style={styles.statusBadge}>
            <Text style={[styles.statusText, { color: isOnline ? '#16a34a' : '#ea580c' }]}> 
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.languageSelector}>
          <Pressable style={[styles.langButton, language === 'en' && styles.langButtonActive]} onPress={() => setLanguage('en')}>
            <Text style={[styles.langButtonText, language === 'en' && styles.langButtonTextActive]}>EN</Text>
          </Pressable>
          <Pressable style={[styles.langButton, language === 'si' && styles.langButtonActive]} onPress={() => setLanguage('si')}>
            <Text style={[styles.langButtonText, language === 'si' && styles.langButtonTextActive]}>SI</Text>
          </Pressable>
          <Pressable style={[styles.langButton, language === 'ta' && styles.langButtonActive]} onPress={() => setLanguage('ta')}>
            <Text style={[styles.langButtonText, language === 'ta' && styles.langButtonTextActive]}>TA</Text>
          </Pressable>
        </View>

        {step === 'role-selection' && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Select Your Portal</Text>
            <Pressable style={styles.roleCard} onPress={() => handleRoleSelect('patient')}>
              <Text style={styles.roleTitle}>Patient Portal</Text>
              <Text style={styles.roleDescription}>View appointments, records, and screening history.</Text>
              <Text style={styles.roleAction}>First-Time Login</Text>
            </Pressable>
            <Pressable style={styles.roleCard} onPress={() => handleRoleSelect('frontline_staff')}>
              <Text style={styles.roleTitle}>Frontline Staff Portal</Text>
              <Text style={styles.roleDescription}>Manage assigned patients and screenings.</Text>
              <Text style={styles.roleAction}>First-Time Login</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => setStep('offline-pin')}>
              <Text style={styles.secondaryButtonText}>Offline PIN Login</Text>
            </Pressable>
          </View>
        )}

        {step === 'online-login' && selectedRole && (
          <View style={styles.form}>
            <Pressable onPress={() => { setStep('role-selection'); resetOnlineForm(); setSelectedRole(null); }}>
              <Text style={styles.backButton}>Back</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>{selectedRole === 'patient' ? 'Patient Login' : 'Staff Login'}</Text>
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>You should be online for first-time login and password setup.</Text>
            </View>

            {selectedRole === 'patient' ? (
              <View style={styles.formGroup}>
                <Text style={styles.label}>NIC</Text>
                <TextInput
                  style={styles.input}
                  placeholder="NIC / National ID"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                  value={nationalId}
                  onChangeText={setNationalId}
                  editable={!isLoading}
                />
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@example.com"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  editable={!isLoading}
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Enter password"
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  editable={!isLoading}
                />
                <Pressable style={styles.togglePasswordButton} onPress={() => setShowPassword((value) => !value)}>
                  <Text style={styles.togglePasswordText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </Pressable>
              </View>
            </View>

            <Pressable style={[styles.submitButton, (!isOnline || isLoading) && styles.submitButtonDisabled]} onPress={handleOnlineLogin} disabled={!isOnline || isLoading}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Login</Text>}
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={() => {
                setNewPassword('');
                setConfirmPassword('');
                setStep('first-password-setup');
              }}
              disabled={!isOnline || isLoading}
            >
              <Text style={styles.secondaryButtonText}>First-Time Login</Text>
            </Pressable>
          </View>
        )}

        {step === 'first-password-setup' && (
          <View style={styles.form}>
            <Pressable onPress={() => setStep('online-login')}>
              <Text style={styles.backButton}>Back</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>Create Password</Text>
            <View style={styles.warningBox}>
              <Text style={styles.warningText}>You should be online for this step.</Text>
            </View>

            {selectedRole === 'patient' ? (
              <View style={styles.formGroup}>
                <Text style={styles.label}>NIC</Text>
                <TextInput
                  style={styles.input}
                  placeholder="NIC / National ID"
                  placeholderTextColor="#999"
                  autoCapitalize="characters"
                  value={nationalId}
                  onChangeText={setNationalId}
                  editable={!isLoading}
                />
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="email@example.com"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  editable={!isLoading}
                />
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Temporary Password</Text>
              <TextInput style={styles.input} placeholder="Issued at registration" placeholderTextColor="#999" secureTextEntry={!showPassword} value={temporaryPassword} onChangeText={setTemporaryPassword} editable={!isLoading} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>New Password</Text>
              <TextInput style={styles.input} placeholder="Create password" placeholderTextColor="#999" secureTextEntry={!showPassword} value={newPassword} onChangeText={setNewPassword} editable={!isLoading} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput style={styles.input} placeholder="Confirm password" placeholderTextColor="#999" secureTextEntry={!showPassword} value={confirmPassword} onChangeText={setConfirmPassword} editable={!isLoading} />
            </View>
            <Pressable style={[styles.submitButton, (!isOnline || isLoading) && styles.submitButtonDisabled]} onPress={handleFirstPasswordSetup} disabled={!isOnline || isLoading}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Save Password</Text>}
            </Pressable>
          </View>
        )}

        {step === 'pin-setup' && (
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Set Offline PIN</Text>
            <Text style={styles.description}>Create a 4-6 digit PIN for offline access.</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>PIN</Text>
              <TextInput style={styles.input} placeholder="4-6 digits" placeholderTextColor="#999" keyboardType="number-pad" secureTextEntry value={pin} onChangeText={setPin} editable={!isLoading} />
            </View>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirm PIN</Text>
              <TextInput style={styles.input} placeholder="Re-enter PIN" placeholderTextColor="#999" keyboardType="number-pad" secureTextEntry value={pinConfirm} onChangeText={setPinConfirm} editable={!isLoading} />
            </View>
            <Pressable style={[styles.submitButton, isLoading && styles.submitButtonDisabled]} onPress={handlePinSetup} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Activate Offline Access</Text>}
            </Pressable>
            {allowPinSkip && (
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  const user = authService.getUser();
                  if (user) {
                    onLoginSuccess(user.role);
                  }
                }}
                disabled={isLoading}
              >
                <Text style={styles.secondaryButtonText}>Skip for Now</Text>
              </Pressable>
            )}
          </View>
        )}

        {step === 'offline-pin' && (
          <View style={styles.form}>
            <Pressable onPress={() => setStep('role-selection')}>
              <Text style={styles.backButton}>Back</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>Offline PIN Login</Text>
            <Text style={styles.description}>Use your saved PIN to access cached data.</Text>
            <View style={styles.formGroup}>
              <Text style={styles.label}>PIN</Text>
              <TextInput style={styles.input} placeholder="Enter PIN" placeholderTextColor="#999" keyboardType="number-pad" secureTextEntry value={pin} onChangeText={setPin} editable={!isLoading} />
            </View>
            <Pressable style={[styles.submitButton, isLoading && styles.submitButtonDisabled]} onPress={handleOfflinePinLogin} disabled={isLoading}>
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Access Offline</Text>}
            </Pressable>
          </View>
        )}
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
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e11d48',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f9ff',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
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
  form: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
  },
  warningBox: {
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 12,
  },
  warningText: {
    fontSize: 13,
    color: '#92400e',
    fontWeight: '600',
  },
  backButton: {
    fontSize: 14,
    color: '#e11d48',
    fontWeight: '600',
  },
  roleCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  roleDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  roleAction: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e11d48',
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
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
});
