import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './core/services/auth/auth.service';
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
  constructor(private authService: AuthService) {}

  async ngOnInit() {
    if (Capacitor.isNativePlatform()) {
      await this.initializeNativeFeatures();
    }

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
