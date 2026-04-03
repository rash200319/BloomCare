import { LoginCredentials, User, UserRole } from '../types';
import secureStore from './secureStore';
import offlineDatabase from './offlineDatabase';
import networkStatusService from './networkStatusService';
import { API_BASE_URL } from '../config/api';

interface StaffLoginResponse {
  id: string;
  role: string;
  is_first_login: boolean;
  access_token: string;
}

interface PatientLoginResponse {
  id: string;
  role: string;
  is_first_login: boolean;
  access_token: string;
}

interface LoginResult {
  user: User;
  token: string;
  isFirstLogin: boolean;
}

interface FirstLoginSetupResponse {
  message: string;
}

const roleFromApi = (role: unknown): UserRole => {
  const value = String(role ?? '').toUpperCase();
  if (value === 'ADMIN') return 'admin';
  if (value === 'CLINICAL_SPECIALIST') return 'clinical_specialist';
  if (value === 'PATIENT') return 'patient';
  return 'frontline_staff';
};

/**
 * AuthService - Offline-First Authentication
 *
 * Online-First Login: Users authenticate online for first-time login
 * - Staff: email + password
 * - Patients: national_id + password
 * - Token + credentials stored securely
 * - User sets 4-6 digit PIN for offline access
 *
 * Offline Access: After first login, users can access app offline with PIN
 * - All data comes from local SQLite cache
 * - Background sync uploads pending changes when online
 */
class AuthService {
  private token: string | null = null;
  private user: User | null = null;
  private isOffline: boolean = false;

  async initializeAuth(): Promise<{
    token: string | null;
    user: User | null;
    isOffline: boolean;
    hasStoredSession: boolean;
  }> {
    try {
      await offlineDatabase.initialize();

      const stored = await secureStore.getSession();

      if (stored) {
        this.token = stored.token;
        this.user = {
          id: stored.userId,
          email: stored.email,
          full_name: stored.fullName,
          role: roleFromApi(stored.role),
          is_active: true,
        };

        await offlineDatabase.cacheUserProfile(this.user);

        const isOnline = networkStatusService.getStatus();
        this.isOffline = !isOnline;

        return {
          token: this.token,
          user: this.user,
          isOffline: this.isOffline,
          hasStoredSession: true,
        };
      }

      return {
        token: null,
        user: null,
        isOffline: this.isOffline,
        hasStoredSession: false,
      };
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      return {
        token: null,
        user: null,
        isOffline: false,
        hasStoredSession: false,
      };
    }
  }

  /**
   * Staff login: email + password (requires internet)
   */
  async loginStaff(email: string, password: string): Promise<LoginResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const authResponse: StaffLoginResponse = await response.json();
      this.token = authResponse.access_token;

      const user: User = {
        id: authResponse.id,
        email,
        full_name: email,
        role: roleFromApi(authResponse.role),
        is_active: true,
      };

      this.user = user;
      await offlineDatabase.cacheUserProfile(user);
      await secureStore.saveSession(user.id, user.email, user.full_name, user.role, this.token, '');

      return { user, token: this.token, isFirstLogin: authResponse.is_first_login };
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Cannot reach backend at ${API_BASE_URL}. Check server and network.`);
      }
      throw error;
    }
  }

  /**
   * Patient login: national_id + password (requires internet for first-time)
   */
  async loginPatient(nationalId: string, password: string): Promise<LoginResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/patient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ national_id: nationalId, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Login failed');
      }

      const authResponse: PatientLoginResponse = await response.json();
      this.token = authResponse.access_token;

      const user: User = {
        id: authResponse.id,
        email: nationalId,
        full_name: nationalId,
        role: 'patient',
        is_active: true,
      };

      this.user = user;
      await offlineDatabase.cacheUserProfile(user);
      await secureStore.saveSession(user.id, nationalId, user.full_name, 'patient', this.token, '');

      return { user, token: this.token, isFirstLogin: authResponse.is_first_login };
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Cannot reach backend at ${API_BASE_URL}. Check server and network.`);
      }
      throw error;
    }
  }

  async setupStaffFirstLoginPassword(email: string, password: string, confirmPassword: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/first-login/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirm_password: confirmPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to set first-time password');
      }

      await response.json() as FirstLoginSetupResponse;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Cannot reach backend at ${API_BASE_URL}. Check server and network.`);
      }
      throw error;
    }
  }

  async setupPatientFirstLoginPassword(nationalId: string, password: string, confirmPassword: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/first-login/patient`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ national_id: nationalId, password, confirm_password: confirmPassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to set first-time password');
      }

      await response.json() as FirstLoginSetupResponse;
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Cannot reach backend at ${API_BASE_URL}. Check server and network.`);
      }
      throw error;
    }
  }

  /**
   * Offline PIN login (no internet required)
   */
  async loginWithPin(pin: string): Promise<{ user: User; token: string }> {
    try {
      if (!pin || pin.length < 4 || pin.length > 6) {
        throw new Error('PIN must be 4-6 digits');
      }

      const pinHash = await secureStore.computePinHash(pin);
      const credential = await offlineDatabase.getOfflineCredentialByPinHash(pinHash);
      if (!credential) throw new Error('Invalid PIN');

      this.token = '';
      this.user = {
        id: credential.user_id,
        email: credential.identifier,
        full_name: credential.full_name,
        role: roleFromApi(credential.role),
        is_active: true,
      };

      this.isOffline = true;

      await secureStore.saveSession(
        this.user.id,
        this.user.email,
        this.user.full_name,
        this.user.role,
        '',
        pin
      );

      return { user: this.user, token: this.token };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Set PIN for offline access (after first login)
   */
  async setPinForOfflineAccess(pin: string): Promise<void> {
    try {
      const session = await secureStore.getSession();
      if (!session || !this.user) throw new Error('No active session');

      if (!pin || pin.length < 4 || pin.length > 6) {
        throw new Error('PIN must be 4-6 digits');
      }

      const pinHash = await secureStore.computePinHash(pin);
      const pinInUse = await offlineDatabase.isPinHashInUse(pinHash, this.user.id);
      if (pinInUse) {
        throw new Error('This PIN is already used on this device. Choose a different PIN.');
      }

      await secureStore.saveSession(
        session.userId,
        session.email,
        session.fullName,
        session.role,
        session.token,
        pin
      );

      await offlineDatabase.upsertOfflineCredential({
        user_id: this.user.id,
        identifier: session.email,
        full_name: session.fullName,
        role: session.role,
        pin_hash: pinHash,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Update PIN for offline access
   */
  async updatePin(newPin: string): Promise<void> {
    try {
      const session = await secureStore.getSession();
      if (!session || !this.user) throw new Error('No active session');

      if (!newPin || newPin.length < 4 || newPin.length > 6) {
        throw new Error('PIN must be 4-6 digits');
      }

      const pinHash = await secureStore.computePinHash(newPin);
      const pinInUse = await offlineDatabase.isPinHashInUse(pinHash, this.user.id);
      if (pinInUse) {
        throw new Error('This PIN is already used on this device. Choose a different PIN.');
      }

      await secureStore.saveSession(
        session.userId,
        session.email,
        session.fullName,
        session.role,
        session.token,
        newPin
      );

      await offlineDatabase.upsertOfflineCredential({
        user_id: this.user.id,
        identifier: session.email,
        full_name: session.fullName,
        role: session.role,
        pin_hash: pinHash,
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout and clear credentials
   */
  async logout(): Promise<void> {
    try {
      await secureStore.clearToken();
      this.token = null;
      this.user = null;
      this.isOffline = false;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async getStoredToken(): Promise<string | null> {
    if (this.token) return this.token;
    const session = await secureStore.getSession();
    return session?.token || null;
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): User | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return !!this.token && !!this.user;
  }

  isInOfflineMode(): boolean {
    return this.isOffline;
  }

  setOfflineMode(offline: boolean): void {
    this.isOffline = offline;
  }
}

export default new AuthService();
