import { Component, inject, signal } from '@angular/core';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, 
  IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonItem, IonLabel, IonList, IonIcon, IonBadge,
  IonSpinner, IonAlert, IonToast
} from '@ionic/angular/standalone';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../core/services/notification/notification.service';
import { ApiUrlService } from '../../core/services/api.service';
import { addIcons } from 'ionicons';
import { 
  phonePortraitOutline, 
  desktopOutline, 
  tabletPortraitOutline,
  checkmarkCircle,
  alertCircle,
  timeOutline,
  notificationsOutline,
  refreshOutline,
  shieldCheckmarkOutline,
  paperPlaneOutline
} from 'ionicons/icons';

interface DeviceToken {
  id: number;
  device_type: string;
  token_preview: string;
  is_active: boolean;
  platform_data: any;
  created_at: string;
  last_used_at: string;
}

interface NotificationConfig {
  fcm_project_id: string;
  service_account_path: string;
  service_account_exists: boolean;
  service_account_project_id?: string;
  service_account_client_email?: string;
  service_account_error?: string;
}

@Component({
  selector: 'app-test-notifications',
  templateUrl: './test-notifications.page.html',
  styleUrls: ['./test-notifications.page.scss'],
  standalone: true,
  imports: [
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonItem, IonLabel, IonList, IonIcon, IonBadge,
    IonSpinner, IonAlert, IonToast
  ],
})
export class TestNotificationsPage {
  private readonly http = inject(HttpClient);
  private readonly notificationService = inject(NotificationService);
  private readonly apiUrlService = inject(ApiUrlService);

  readonly deviceTokens = signal<DeviceToken[]>([]);
  readonly config = signal<NotificationConfig | null>(null);
  readonly isLoading = signal(false);
  readonly isTesting = signal(false);
  readonly testResult = signal<string>('');
  readonly showAlert = signal(false);
  readonly showToast = signal(false);

  constructor() {
    addIcons({
      phonePortraitOutline,
      desktopOutline,
      tabletPortraitOutline,
      checkmarkCircle,
      alertCircle,
      timeOutline,
      notificationsOutline,
      refreshOutline,
      shieldCheckmarkOutline,
      paperPlaneOutline
    });

    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      await Promise.all([
        this.loadDeviceTokens(),
        this.loadConfig()
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadDeviceTokens() {
    try {
      const response = await this.http.get<any>(
        this.apiUrlService.getUrl('device-tokens/list')
      ).toPromise();

      if (response.success) {
        this.deviceTokens.set(response.data);
      }
    } catch (error) {
      console.error('Failed to load device tokens:', error);
    }
  }

  async loadConfig() {
    try {
      const response = await this.http.get<any>(
        this.apiUrlService.getUrl('notification-config')
      ).toPromise();

      if (response.success) {
        this.config.set(response.config);
      }
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  async initializeNotifications() {
    try {
      console.log('🔄 Manually initializing notifications...');
      await this.notificationService.forceInitialize();
      this.testResult.set('✅ Notification service force-initialized! Check console for details.');
      this.showAlert.set(true);
      
      // Wait a moment and reload tokens
      setTimeout(() => this.loadDeviceTokens(), 3000);
    } catch (error) {
      console.error('Initialization error:', error);
      this.testResult.set(`❌ Initialization error: ${error}`);
      this.showAlert.set(true);
    }
  }

  async requestPermissions() {
    try {
      const result = await this.notificationService.requestPermissions();
      this.testResult.set(`Permission result: ${result.receive}`);
      this.showAlert.set(true);
      
      if (result.receive === 'granted') {
        // Wait a moment and reload tokens
        setTimeout(() => this.loadDeviceTokens(), 1000);
      }
    } catch (error) {
      this.testResult.set(`Permission error: ${error}`);
      this.showAlert.set(true);
    }
  }

  async sendTestNotification() {
    this.isTesting.set(true);
    try {
      const response = await this.http.post<any>(
        this.apiUrlService.getUrl('test-notification'),
        {}
      ).toPromise();

      if (response.success) {
        this.testResult.set(`✅ ${response.message}`);
        this.showToast.set(true);
      } else {
        this.testResult.set(`❌ ${response.message}`);
        this.showAlert.set(true);
      }
    } catch (error: any) {
      const message = error.error?.message || error.message || 'Unknown error';
      this.testResult.set(`❌ Test failed: ${message}`);
      this.showAlert.set(true);
    } finally {
      this.isTesting.set(false);
    }
  }

  getDeviceIcon(deviceType: string): string {
    switch (deviceType) {
      case 'ios':
      case 'android':
        return 'phone-portrait-outline';
      case 'web':
        return 'desktop-outline';
      default:
        return 'tablet-portrait-outline';
    }
  }

  getConfigStatus(): 'success' | 'warning' | 'error' {
    const config = this.config();
    if (!config) return 'warning';
    
    if (config.service_account_exists && config.fcm_project_id) {
      return 'success';
    } else if (config.fcm_project_id) {
      return 'warning';
    }
    
    return 'error';
  }
}