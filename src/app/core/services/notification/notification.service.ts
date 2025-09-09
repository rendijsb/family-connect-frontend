import { Injectable, inject } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed, PermissionStatus } from '@capacitor/push-notifications';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

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

  private readonly _pushToken = new BehaviorSubject<string | null>(null);
  private readonly _isInitialized = new BehaviorSubject<boolean>(false);
  private _listenersRegistered = false;

  readonly pushToken$ = this._pushToken.asObservable();
  readonly isInitialized$ = this._isInitialized.asObservable();

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications not available on web platform');
      this._isInitialized.next(true);
      return;
    }

    if (this._isInitialized.value) {
      console.log('Push notifications already initialized');
      return;
    }

    try {
      // Check if push notifications are supported
      const permissions = await PushNotifications.checkPermissions();
      console.log('Current notification permissions:', permissions);

      // Request permission first
      const permResult = await PushNotifications.requestPermissions();
      console.log('Permission request result:', permResult);

      if (permResult.receive !== 'granted') {
        console.warn('Push notification permission denied');
        this._isInitialized.next(true);
        return;
      }

      await this.cleanupListeners();

      await PushNotifications.register();

      if (!this._listenersRegistered) {
        PushNotifications.addListener('registration', (token: Token) => {
          console.log('Push registration success, token: ', token.value);
          this._pushToken.next(token.value);
          this.sendTokenToBackend(token.value);
        });

        PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Error on registration: ', JSON.stringify(error));
        });

        PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          console.log('Push notification received: ', JSON.stringify(notification));
          this.handleForegroundNotification(notification);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
          console.log('Push notification action performed: ', JSON.stringify(notification));
          this.handleNotificationAction(notification);
        });

        this._listenersRegistered = true;
        console.log('Push notification listeners registered');
      }

      this._isInitialized.next(true);
    } catch (error) {
      console.error('Error initializing push notifications:', error);
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
    try {
      // TODO: Implement API call to store device token
      // await this.http.post('/api/device-tokens', { token, platform: this.platform.platforms() }).toPromise();
      console.log('Device token to send to backend:', token);
    } catch (error) {
      console.error('Failed to send token to backend:', error);
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
    console.log('Resetting push notifications...');
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
}
