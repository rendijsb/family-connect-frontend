import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './core/services/auth/auth.service';
import { NotificationService } from './core/services/notification/notification.service';
import { ToastNotificationService } from './core/services/notification/toast-notification.service';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-root',
  templateUrl: 'app.html',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
})
export class App implements OnInit {
  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private toastNotificationService: ToastNotificationService
  ) {}

  async ngOnInit() {
    if (Capacitor.isNativePlatform()) {
      await this.initializeNativeFeatures();
      // Initialize push notifications after native features
      await this.notificationService.initialize();
    }

    // Initialize toast notifications for real-time events
    this.toastNotificationService.initialize();

    await this.authService.waitForInitialization().toPromise();
  }

  private async initializeNativeFeatures() {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#1a1a1a' });

      await SplashScreen.hide();
    } catch (error) {
      console.error('Error initializing native features:', error);
    }
  }
}
