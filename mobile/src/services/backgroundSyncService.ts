import networkStatusService from './networkStatusService';
import dataSyncService from './dataSyncService';
import authService from './authService';
import frontlineStaffOperationsService from './frontlineStaffOperationsService';
import patientOperationsService from './patientOperationsService';
import { syncPendingFrontlineActions } from './syncService';

/**
 * BackgroundSyncService
 * Monitors network connectivity and automatically syncs data when online
 */
class BackgroundSyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isWaitingForConnection: boolean = false;

  /**
   * Initialize background sync
   * Starts monitoring network and syncing when online
   */
  async initialize(): Promise<void> {
    // Subscribe to network status changes
    networkStatusService.subscribe(async (isOnline: boolean) => {
      if (isOnline) {
        console.log('Network online - triggering sync');
        await this.sync();
      } else {
        console.log('Network offline - pausing sync');
      }
    });

    // Also set up periodic sync every 60 seconds when online
    this.syncInterval = setInterval(async () => {
      if (networkStatusService.getStatus() && !dataSyncService.isSyncInProgress()) {
        await this.sync();
      }
    }, 60000); // 60 seconds
  }

  /**
   * Perform sync based on user role
   */
  private async sync(): Promise<void> {
    try {
      if (dataSyncService.isSyncInProgress()) {
        console.log('Sync already in progress, skipping');
        return;
      }

      const user = authService.getUser();
      if (!user) {
        console.log('Not authenticated, skipping sync');
        return;
      }

      console.log(`Starting background sync for ${user.role}...`);

      if (user.role === 'patient') {
        // Sync patient data
        const result = await dataSyncService.syncPatientData(user.id);
        if (result.success) {
          console.log(`Patient sync successful: ${result.itemsSynced} items`);

          // After syncing, also sync pending operations
          const syncResult = await patientOperationsService.syncPending();
          console.log(`Pending vitals synced: ${syncResult.synced}`);
        }
      } else if (user.role === 'frontline_staff') {
        // Sync frontline staff data — registrations first, then vitals.
        const registryResult = await syncPendingFrontlineActions();
        console.log(
          `Frontline registry sync: ${registryResult.synced} synced, ${registryResult.pending} pending`
        );
        if (registryResult.errors.length > 0) {
          console.error('Frontline registry sync errors:', registryResult.errors);
        }
        const result = await frontlineStaffOperationsService.syncPendingOperations();
        console.log(`Frontline staff sync: ${result.synced} synced, ${result.failed} failed`);
      }
    } catch (error) {
      console.error('Background sync error:', error);
    }
  }

  /**
   * Force immediate sync (useful for UI sync buttons)
   */
  async forceSync(): Promise<{ success: boolean; message: string }> {
    if (!networkStatusService.getStatus()) {
      return { success: false, message: 'No internet connection' };
    }

    try {
      await this.sync();
      return { success: true, message: 'Sync completed' };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Sync failed',
      };
    }
  }

  /**
   * Wait for connection and sync
   * Useful when trying to upload important data
   */
  async waitForConnectionAndSync(timeoutMs: number = 60000): Promise<boolean> {
    if (this.isWaitingForConnection) {
      return false;
    }

    this.isWaitingForConnection = true;

    try {
      const isOnline = await networkStatusService.waitForOnline(timeoutMs);
      if (isOnline) {
        console.log('Connection restored - syncing...');
        await this.sync();
        return true;
      } else {
        console.log('Connection timeout - sync deferred');
        return false;
      }
    } finally {
      this.isWaitingForConnection = false;
    }
  }

  /**
   * Stop background sync
   */
  stop(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Background sync stopped');
    }
  }

  /**
   * Check if waiting for connection
   */
  isWaiting(): boolean {
    return this.isWaitingForConnection;
  }
}

const backgroundSyncService = new BackgroundSyncService();
export default backgroundSyncService;
