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
      const pinHash = await this.hashPin(pin);
      console.log('💾 Saving Session:');
      console.log('  Email:', email);
      console.log('  PIN:', pin);
      console.log('  PIN Hash:', pinHash);
      
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
      console.log('✅ Session saved securely');
    } catch (error) {
      console.error('Failed to save session:', error);
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
        console.log('📭 No session stored');
        return null;
      }
      const session = JSON.parse(sessionStr);
      console.log('📖 Retrieved session:');
      console.log('  Email:', session.email);
      console.log('  PIN Hash on disk:', session.pinHash);
      return session;
    } catch (error) {
      console.error('Failed to retrieve session:', error);
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
      if (!session) {
        console.log('❌ No session found for PIN verification');
        return false;
      }

      const pinHash = await this.hashPin(pin);
      console.log('🔐 PIN Verification:');
      console.log('  Entered PIN:', pin);
      console.log('  Computed Hash:', pinHash);
      console.log('  Stored Hash:', session.pinHash);
      console.log('  Match?:', pinHash === session.pinHash);
      
      return pinHash === session.pinHash;
    } catch (error) {
      console.error('Failed to verify PIN:', error);
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
      console.log('Token updated');
    } catch (error) {
      console.error('Failed to update token:', error);
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

      // Keep PIN hash and user info, only clear the token
      session.token = '';
      console.log('🔓 Token cleared (PIN preserved for offline login)');
      
      await SecureStore.setItemAsync(this.SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Failed to clear token:', error);
      throw error;
    }
  }

  /**
   * Clear all stored session data on logout
   */
  async clearSession(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(this.SESSION_KEY);
      console.log('Session cleared');
    } catch (error) {
      console.error('Failed to clear session:', error);
      throw error;
    }
  }

  /**
   * Simple PIN hash function
   * In production, use a proper key derivation function like PBKDF2
   */
  private async hashPin(pin: string): Promise<string> {
    try {
      return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
    } catch (error) {
      console.error('Failed to hash PIN:', error);
      throw error;
    }
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
      console.error('Failed to get stored token:', error);
      return null;
    }
  }
}

export default new SecureStoreService();
