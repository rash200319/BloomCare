import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

type NetworkListener = (isOnline: boolean) => void;

/**
 * Network Monitoring Service
 * Tracks online/offline status and provides listeners for UI updates
 */
class NetworkStatusService {
  private isOnline: boolean = true;
  private listeners: Set<NetworkListener> = new Set();
  private netInfoUnsubscribe: (() => void) | null = null;

  async initialize(): Promise<void> {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }

    // Check current status
    const state: NetInfoState = await NetInfo.fetch();
    this.isOnline = this.isConnectedState(state);

    // Listen for changes
    this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOnline = this.isOnline;
      this.isOnline = this.isConnectedState(state);

      // Only notify if status changed
      if (wasOnline !== this.isOnline) {
        console.log(`Network status changed: ${this.isOnline ? 'ONLINE' : 'OFFLINE'}`);
        this.notifyListeners();
      }
    });
  }

  private isConnectedState(state: NetInfoState): boolean {
    return state.isConnected === true && state.isInternetReachable !== false;
  }

  subscribe(listener: NetworkListener): () => void {
    this.listeners.add(listener);

    // Call immediately with current status
    listener(this.isOnline);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener(this.isOnline);
    });
  }

  getStatus(): boolean {
    return this.isOnline;
  }

  async waitForOnline(timeoutMs: number = 60000): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isOnline) {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeoutMs);

      const unsubscribe = this.subscribe((isOnline) => {
        if (isOnline) {
          clearTimeout(timeout);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }
}

const networkStatusService = new NetworkStatusService();
export default networkStatusService;
