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

  readonly pushToken$ = this._pushToken.asObservable();
  readonly isInitialized$ = this._isInitialized.asObservable();

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications not available on web platform');
      this._isInitialized.next(true);
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

      // Register for push notifications
      await PushNotifications.register();

      // Listen for registration
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('Push registration success, token: ', token.value);
        this._pushToken.next(token.value);
        // Here you would typically send the token to your backend
        this.sendTokenToBackend(token.value);
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error: any) => {
        console.error('Error on registration: ', JSON.stringify(error));
      });

      // Listen for push notifications
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('Push notification received: ', JSON.stringify(notification));
        // Handle received notification while app is in foreground
        this.handleForegroundNotification(notification);
      });

      // Listen for notification actions (when user taps notification)
      PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        console.log('Push notification action performed: ', JSON.stringify(notification));
        this.handleNotificationAction(notification);
      });

      this._isInitialized.next(true);
    } catch (error) {
      console.error('Error initializing push notifications:', error);
      this._isInitialized.next(true);
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

  private handleNotificationAction(actionPerformed: ActionPerformed): void {
    const data = actionPerformed.notification.data;
    
    if (data?.type === 'chat' && data?.familySlug && data?.roomId) {
      // Navigate to specific chat room
      this.router.navigate(['/family', data.familySlug, 'chat', data.roomId]);
    } else if (data?.type === 'invitation') {
      // Navigate to invitations
      this.router.navigate(['/invitations']);
    } else if (data?.type === 'family') {
      // Navigate to family
      this.router.navigate(['/family', data.familySlug]);
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
}