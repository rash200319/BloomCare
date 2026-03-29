import { LoginCredentials, RegisterData, User, PinLoginCredentials, UserRole } from '../types';
import secureStore from './secureStore';
import { API_BASE_URL } from '../config/api';

interface AuthResponse {
  access_token: string;
  token_type: string;
}

const roleToApi = (role: UserRole): string => {
  const mapping: Record<UserRole, string> = {
    admin: 'ADMIN',
    clinical_specialist: 'CLINICAL_SPECIALIST',
    frontline_staff: 'FRONTLINE_STAFF',
    patient: 'PATIENT',
  };

  return mapping[role] ?? 'FRONTLINE_STAFF';
};

const roleFromApi = (role: unknown): UserRole => {
  const value = String(role ?? '').toUpperCase();
  if (value === 'ADMIN') return 'admin';
  if (value === 'CLINICAL_SPECIALIST') return 'clinical_specialist';
  if (value === 'PATIENT') return 'patient';
  return 'frontline_staff';
};

const normalizeUser = (raw: any): User => ({
  id: String(raw?.id ?? ''),
  email: String(raw?.email ?? ''),
  full_name: String(raw?.full_name ?? raw?.fullName ?? ''),
  role: roleFromApi(raw?.role),
  is_active: raw?.is_active !== false,
});

/**
 * AuthService - "Register Once, Sync Many" Strategy
 * 
 * Flow:
 * 1. REGISTRATION (requires internet):
 *    - User registers with email/password/PIN at office/Wi-Fi zone
 *    - Backend returns encrypted JWT token
 *    - Token + user info + PIN hash stored in SecureStore
 * 
 * 2. OFFLINE LOGIN:
 *    - User opens app in remote area (no internet)
 *    - Checks SecureStore for valid session
 *    - User enters PIN (not full credentials)
 *    - If PIN matches, grant offline access
 * 
 * 3. BACKGROUND SYNC:
 *    - When internet returns, retrieve stored token from SecureStore
 *    - Use token to authenticate and sync data to server
 */
class AuthService {
  private token: string | null = null;
  private user: User | null = null;
  private isOffline: boolean = false;

  async initializeAuth(): Promise<{ token: string | null; user: User | null; isOffline: boolean; hasStoredSession: boolean }> {
    try {
      // Try to retrieve stored session from SecureStore (more secure than AsyncStorage)
      const stored = await secureStore.getSession();
      
      if (stored) {
        // Session exists - user has registered before
        this.token = stored.token;
        this.user = {
          id: stored.userId,
          email: stored.email,
          full_name: stored.fullName,
          role: roleFromApi(stored.role),
          is_active: true,
        };
        
        return {
          token: this.token,
          user: this.user,
          isOffline: this.isOffline,
          hasStoredSession: true,
        };
      }

      return { token: null, user: null, isOffline: this.isOffline, hasStoredSession: false };
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      return { token: null, user: null, isOffline: this.isOffline, hasStoredSession: false };
    }
  }

  /**
   * Full login with email/password (requires internet)
   * Used for initial login or when user wants to change credentials
   */
  async login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: credentials.email,
          password: credentials.password,
        }).toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Login failed');
      }

      const authResponse: AuthResponse = await response.json();
      this.token = authResponse.access_token;

      // Fetch current user info
      const userResponse = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${authResponse.access_token}`,
        },
      });

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userRaw = await userResponse.json();
      const user = normalizeUser(userRaw);
      this.user = user;

      return { user, token: authResponse.access_token };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Register with PIN for offline access
   * User must provide a PIN (4-6 digits) for offline login
   * Requires internet connection to register
   */
  async register(data: RegisterData): Promise<{ user: User; token: string }> {
    try {
      if (!data.pin || data.pin.length < 4) {
        throw new Error('PIN must be at least 4 digits');
      }

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          role: roleToApi(data.role),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Registration failed');
      }

      const userRaw = await response.json();
      const user = normalizeUser(userRaw);

      // Auto-login and get encrypted token
      const loginResult = await this.login({
        email: data.email,
        password: data.password,
      });

      // Save session to SecureStore with PIN
      await secureStore.saveSession(
        loginResult.user.id,
        loginResult.user.email,
        loginResult.user.full_name,
        loginResult.user.role,
        loginResult.token,
        data.pin
      );

      return loginResult;
    } catch (error) {
      throw error;
    }
  }

  /**
   * PIN-based offline login
   * User enters their PIN (not email/password) to access app offline
   * No internet required - completely local
   */
  async loginWithPin(credentials: PinLoginCredentials): Promise<{ user: User; token: string }> {
    try {
      // Verify PIN against stored hash in SecureStore
      const isPinValid = await secureStore.verifyPin(credentials.pin);
      
      if (!isPinValid) {
        throw new Error('Invalid PIN');
      }

      // Retrieve session from SecureStore
      const session = await secureStore.getSession();
      if (!session) {
        throw new Error('No saved session found. Please register first.');
      }

      // Restore session
      this.token = session.token;
      this.user = {
        id: session.userId,
        email: session.email,
        full_name: session.fullName,
        role: roleFromApi(session.role),
        is_active: true,
      };

      this.isOffline = true;

      return {
        user: this.user,
        token: this.token,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout and clear all stored credentials
   */
  async logout(): Promise<void> {
    try {
      await secureStore.clearToken();
      this.token = null;
      this.user = null;
      this.isOffline = false;
    } catch (error) {
      console.error('Failed to logout:', error);
      throw error;
    }
  }

  /**
   * Fetch fresh user info from server (when online)
   */
  async getMe(): Promise<User | null> {
    if (!this.token) return null;

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      const user = normalizeUser(await response.json());
      this.user = user;
      return user;
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      return null;
    }
  }

  /**
   * Refresh token from server (when online)
   * Call this periodically when background syncing
   */
  async refreshToken(): Promise<string | null> {
    try {
      const session = await secureStore.getSession();
      if (!session) return null;

      // Try to refresh token endpoint if available
      // For now, just return current token
      // In production, implement token refresh logic
      return session.token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      return null;
    }
  }

  /**
   * Get stored token for background sync
   * This is used internally by sync services
   */
  async getStoredToken(): Promise<string | null> {
    if (this.token) return this.token;
    return await secureStore.getStoredToken();
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

  /**
   * Check if app is currently in offline mode
   */
  isInOfflineMode(): boolean {
    return this.isOffline;
  }
}

export default new AuthService();
