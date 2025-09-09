import { Injectable, inject } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed, PermissionStatus } from '@capacitor/push-notifications';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ApiUrlService } from '../api.service';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: any;
  type?: 'chat' | 'invitation' | 'general';
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly platform = inject(Platform);
  private readonly router = inject(Router);
  private readonly apiUrlService = inject(ApiUrlService);

  private readonly _pushToken = new BehaviorSubject<string | null>(null);
  private readonly _isInitialized = new BehaviorSubject<boolean>(false);
  private _listenersRegistered = false;

  readonly pushToken$ = this._pushToken.asObservable();
  readonly isInitialized$ = this._isInitialized.asObservable();

  async initialize(): Promise<void> {
    console.log('🔔 NotificationService: Starting initialization...');
    
    if (!Capacitor.isNativePlatform()) {
      console.log('🌐 Web platform detected - using browser notifications for testing');
      await this.initializeWebNotifications();
      this._isInitialized.next(true);
      return;
    }

    if (this._isInitialized.value) {
      console.log('Push notifications already initialized');
      console.log('Current token:', this._pushToken.value ? 'EXISTS' : 'NONE');
      console.log('Listeners registered:', this._listenersRegistered);
      return;
    }

    try {
      console.log('📋 Step 1: Checking permissions...');
      // Check if push notifications are supported
      const permissions = await PushNotifications.checkPermissions();
      console.log('Current notification permissions:', permissions);

      console.log('🔐 Step 2: Requesting permissions...');
      // Request permission first
      const permResult = await PushNotifications.requestPermissions();
      console.log('Permission request result:', permResult);

      if (permResult.receive !== 'granted') {
        console.warn('⚠️ Push notification permission denied, but will still register for future use');
      } else {
        console.log('✅ Push notification permission GRANTED!');
      }

      console.log('🧹 Step 3: Cleaning up old listeners...');
      await this.cleanupListeners();

      console.log('📝 Step 4: Registering for push notifications...');
      console.log('🔍 Platform info:');
      console.log('- Platform:', Capacitor.getPlatform());
      console.log('- Is native platform:', Capacitor.isNativePlatform());
      console.log('- Platform platforms:', this.platform.platforms());
      
      // Always try to register regardless of permission status
      // The user might grant permission later
      await PushNotifications.register();
      console.log('✅ PushNotifications.register() completed successfully');
      
      // Set up a timeout to detect if registration never happens
      console.log('⏱️ Setting up 10-second timeout to check registration...');
      setTimeout(() => {
        if (!this._pushToken.value) {
          console.warn('⚠️ TIMEOUT: No push token received after 10 seconds!');
          console.warn('⚠️ This usually means:');
          console.warn('⚠️ 1. iOS app is not configured for push notifications');
          console.warn('⚠️ 2. Device is not connected to internet');
          console.warn('⚠️ 3. Apple Push Notification service is unreachable');
          console.warn('⚠️ 4. App is running on iOS Simulator (which doesn\'t support push)');
        }
      }, 10000);

      console.log('👂 Step 5: Setting up listeners...');
      if (!this._listenersRegistered) {
        console.log('🔗 Adding registration listener...');
        PushNotifications.addListener('registration', (token: Token) => {
          console.log('🎯 Push registration success, token: ', token.value);
          this._pushToken.next(token.value);
          console.log('📤 Sending token to backend...');
          this.sendTokenToBackend(token.value);
        });

        console.log('🚨 Adding registration error listener...');
        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('❌ Push registration error: ', JSON.stringify(error));
          console.error('❌ Error type:', typeof error);
          console.error('❌ Error message:', error?.message || 'No message');
          console.error('❌ Error code:', error?.code || 'No code');
        });

        console.log('📲 Adding notification received listener...');
        PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          console.log('Push notification received: ', JSON.stringify(notification));
          this.handleForegroundNotification(notification);
        });

        console.log('👆 Adding notification action listener...');
        PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
          console.log('Push notification action performed: ', JSON.stringify(notification));
          this.handleNotificationAction(notification);
        });

        this._listenersRegistered = true;
        console.log('✅ All push notification listeners registered');
      } else {
        console.log('ℹ️ Listeners already registered, skipping...');
      }

      console.log('🏁 Step 6: Initialization complete!');
      this._isInitialized.next(true);
      
      // Let's also check what happened
      setTimeout(() => {
        console.log('🔍 Post-initialization check:');
        console.log('- Initialized:', this._isInitialized.value);
        console.log('- Token exists:', this._pushToken.value ? 'YES' : 'NO');
        console.log('- Token value:', this._pushToken.value ? this._pushToken.value.substring(0, 20) + '...' : 'NONE');
        console.log('- Listeners registered:', this._listenersRegistered);
      }, 1000);
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error);
      this._isInitialized.next(true);
    }
  }

  async cleanupListeners(): Promise<void> {
    try {
      if (this._listenersRegistered) {
        await PushNotifications.removeAllListeners();
        this._listenersRegistered = false;
        console.log('Push notification listeners cleaned up');
      }
    } catch (error) {
      console.error('Error cleaning up listeners:', error);
    }
  }

  async checkPermissions(): Promise<PermissionStatus> {
    return await PushNotifications.checkPermissions();
  }

  async requestPermissions(): Promise<PermissionStatus> {
    return await PushNotifications.requestPermissions();
  }

  private async sendTokenToBackend(token: string): Promise<void> {
    console.log('🚀 Attempting to send token to backend:', token.substring(0, 20) + '...');
    console.log('📍 Backend URL:', this.apiUrlService.getUrl('device-tokens'));
    console.log('📱 Platform:', this.platform.platforms());
    console.log('🔧 Device type:', Capacitor.getPlatform());
    
    try {
      const authToken = await this.getAuthToken();
      console.log('🔑 Auth token exists:', authToken ? 'YES' : 'NO');
      
      const requestBody = {
        token,
        platform: this.platform.platforms(),
        device_type: Capacitor.getPlatform()
      };
      console.log('📦 Request body:', requestBody);
      
      const response = await fetch(this.apiUrlService.getUrl('device-tokens'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📡 Response error body:', errorText);
        throw new Error(`Failed to register device token: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log('📡 Response data:', responseData);
      console.log('✅ Device token successfully registered with backend!');
    } catch (error) {
      console.error('❌ Failed to send token to backend:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      // Get token from localStorage or your auth service
      return localStorage.getItem('auth_token');
    } catch {
      return null;
    }
  }

  private handleForegroundNotification(notification: PushNotificationSchema): void {
    // Show local notification or toast when app is in foreground
    console.log('Handling foreground notification:', notification);

    // You could show a toast or in-app notification here
    // this.toastService.showToast(notification.body || 'New message', 'primary');
  }

  private async handleNotificationAction(actionPerformed: ActionPerformed): Promise<void> {
    try {
      const data = actionPerformed.notification.data;
      console.log('Handling notification action with data:', data);

      // Validate data exists and has expected structure
      if (!data || typeof data !== 'object') {
        console.warn('Invalid notification data structure:', data);
        return;
      }

      // Add delay to prevent immediate crash loops
      await new Promise(resolve => setTimeout(resolve, 500));

      // Handle different notification types with validation
      if (data.type === 'chat' && this.isValidChatData(data)) {
        await this.navigateToChat(data.familySlug, data.roomId);
      } else if (data.type === 'invitation') {
        await this.navigateToInvitations();
      } else if (data.type === 'family' && this.isValidFamilyData(data)) {
        await this.navigateToFamily(data.familySlug);
      } else {
        console.log('Unhandled notification type or invalid data:', data);
        // Default fallback - navigate to home
        await this.navigateToHome();
      }
    } catch (error) {
      console.error('Error handling notification action:', error);
      // Fallback to home page on any error to prevent crash loops
      await this.navigateToHome();
    }
  }

  private isValidChatData(data: any): boolean {
    return data &&
           typeof data.familySlug === 'string' &&
           data.familySlug.trim().length > 0 &&
           typeof data.roomId === 'string' &&
           data.roomId.trim().length > 0;
  }

  private isValidFamilyData(data: any): boolean {
    return data &&
           typeof data.familySlug === 'string' &&
           data.familySlug.trim().length > 0;
  }

  private async navigateToChat(familySlug: string, roomId: string): Promise<void> {
    try {
      console.log('Navigating to chat:', familySlug, roomId);
      await this.router.navigate(['/family', familySlug, 'chat', roomId]);
    } catch (error) {
      console.error('Failed to navigate to chat:', error);
      await this.navigateToHome();
    }
  }

  private async navigateToInvitations(): Promise<void> {
    try {
      console.log('Navigating to invitations');
      await this.router.navigate(['/invitations']);
    } catch (error) {
      console.error('Failed to navigate to invitations:', error);
      await this.navigateToHome();
    }
  }

  private async navigateToFamily(familySlug: string): Promise<void> {
    try {
      console.log('Navigating to family:', familySlug);
      await this.router.navigate(['/family', familySlug]);
    } catch (error) {
      console.error('Failed to navigate to family:', error);
      await this.navigateToHome();
    }
  }

  private async navigateToHome(): Promise<void> {
    try {
      console.log('Navigating to home as fallback');
      await this.router.navigate(['/tabs/home']);
    } catch (error) {
      console.error('Failed to navigate to home:', error);
      // Last resort - try to navigate to root
      try {
        await this.router.navigate(['/']);
      } catch (finalError) {
        console.error('All navigation attempts failed:', finalError);
      }
    }
  }

  // Method to create local notifications (for testing or immediate feedback)
  showLocalNotification(payload: NotificationPayload): void {
    if (Capacitor.isNativePlatform()) {
      // Could use Local Notifications plugin here if needed
      console.log('Would show local notification:', payload);
    }
  }

  getCurrentToken(): string | null {
    return this._pushToken.value;
  }

  isReady(): boolean {
    return this._isInitialized.value;
  }

  // Method to reset and reinitialize notifications (useful for troubleshooting)
  async resetNotifications(): Promise<void> {
    console.log('🔄 Resetting push notifications...');
    this._isInitialized.next(false);
    this._listenersRegistered = false;
    this._pushToken.next(null);

    try {
      await this.cleanupListeners();
      await this.initialize();
    } catch (error) {
      console.error('Error resetting notifications:', error);
    }
  }

  // Force re-initialization even if already initialized
  async forceInitialize(): Promise<void> {
    console.log('🔥 Force initializing notifications...');
    this._isInitialized.next(false);
    await this.initialize();
  }

  // Web notifications fallback for testing
  private async initializeWebNotifications(): Promise<void> {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('🌐 Web notification permission:', permission);
      
      if (permission === 'granted') {
        // Generate a fake token for testing
        const fakeToken = 'web-test-token-' + Date.now();
        this._pushToken.next(fakeToken);
        console.log('🎯 Web notification token generated:', fakeToken);
        
        // Send to backend for testing
        await this.sendTokenToBackend(fakeToken);
      }
    }
  }
}
