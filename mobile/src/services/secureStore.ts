import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

/**
 * SecureStore Wrapper Service
 * Provides encrypted storage for sensitive data (JWT tokens, PINs, etc.)
 * More secure than AsyncStorage - data is encrypted at rest on device
 */

interface StoredSession {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  token: string;
  pinHash: string;
  registeredAt: string;
}

class SecureStoreService {
  private readonly SESSION_KEY = 'bloomcare_session';
  private readonly TOKEN_KEY = 'bloomcare_auth_token';
  private readonly PIN_KEY = 'bloomcare_user_pin';
  private readonly PIN_SALT_KEY = 'bloomcare_pin_salt_v2';

  /**
   * Save user session with encrypted JWT token
   * Called after successful initial registration/login
   */
  async saveSession(
    userId: string,
    email: string,
    fullName: string,
    role: string,
    token: string,
    pin: string
  ): Promise<void> {
    try {
      const pinHash = pin ? await this.hashPin(pin) : '';
      const session: StoredSession = {
        userId,
        email,
        fullName,
        role,
        token,
        pinHash,
        registeredAt: new Date().toISOString(),
      };

      await SecureStore.setItemAsync(this.SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to save session');
      throw error;
    }
  }

  /**
   * Retrieve stored session (contains encrypted token)
   * Safe to call even in offline mode
   */
  async getSession(): Promise<StoredSession | null> {
    try {
      const sessionStr = await SecureStore.getItemAsync(this.SESSION_KEY);
      if (!sessionStr) {
        return null;
      }
      return JSON.parse(sessionStr) as StoredSession;
    } catch (error) {
      console.error('Failed to retrieve session');
      return null;
    }
  }

  /**
   * Verify PIN for offline login
   * Returns true if PIN matches the stored hash
   */
  async verifyPin(pin: string): Promise<boolean> {
    try {
      const session = await this.getSession();
      if (!session?.pinHash) {
        return false;
      }

      for (const candidate of await this.pinHashCandidates(pin)) {
        if (candidate === session.pinHash) {
          // Upgrade legacy unsalted hashes on successful verify
          if (!session.pinHash.startsWith('v2:')) {
            const upgraded = await this.hashPin(pin);
            session.pinHash = upgraded;
            await SecureStore.setItemAsync(this.SESSION_KEY, JSON.stringify(session));
          }
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to verify PIN');
      return false;
    }
  }

  /**
   * Update stored token (e.g., when refreshing auth on reconnect)
   */
  async updateToken(newToken: string): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session) throw new Error('No session found');

      session.token = newToken;
      await SecureStore.setItemAsync(this.SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to update token');
      throw error;
    }
  }

  /**
   * Clear only the token on logout, keep PIN and user info for offline login
   * This allows users to return to offline PIN login without re-registering
   */
  async clearToken(): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session) return;

      session.token = '';
      await SecureStore.setItemAsync(this.SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to clear token');
      throw error;
    }
  }

  /**
   * Clear all stored session data on logout
   */
  async clearSession(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.SESSION_KEY);
    } catch (error) {
      console.error('Failed to clear session');
      throw error;
    }
  }

  private async getOrCreatePinSalt(): Promise<string> {
    const existing = await SecureStore.getItemAsync(this.PIN_SALT_KEY);
    if (existing) return existing;
    const bytes = await Crypto.getRandomBytesAsync(16);
    const salt = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await SecureStore.setItemAsync(this.PIN_SALT_KEY, salt);
    return salt;
  }

  /**
   * Salted SHA-256 PIN hash (v2). Legacy unsalted SHA-256 still verified for migration.
   */
  private async hashPin(pin: string): Promise<string> {
    const salt = await this.getOrCreatePinSalt();
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${salt}:${pin}`
    );
    return `v2:${salt}:${digest}`;
  }

  private async legacyHashPin(pin: string): Promise<string> {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
  }

  /**
   * Compute current (v2) PIN hash for offline credential storage
   */
  async computePinHash(pin: string): Promise<string> {
    return this.hashPin(pin);
  }

  /**
   * Candidate hashes for lookup (v2 first, then legacy unsalted).
   */
  async pinHashCandidates(pin: string): Promise<string[]> {
    const current = await this.hashPin(pin);
    const legacy = await this.legacyHashPin(pin);
    return current === legacy ? [current] : [current, legacy];
  }

  /**
   * Check if user has a stored session
   */
  async hasSession(): Promise<boolean> {
    const session = await this.getSession();
    return session !== null;
  }

  /**
   * Get stored token without requiring PIN (internal use)
   * Use with caution - only in scenarios where token is needed for sync
   */
  async getStoredToken(): Promise<string | null> {
    try {
      const session = await this.getSession();
      return session?.token || null;
    } catch (error) {
      console.error('Failed to get stored token');
      return null;
    }
  }
}

export default new SecureStoreService();
