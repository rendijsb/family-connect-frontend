import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideIonicAngular, ModalController, AlertController, ToastController, LoadingController, ActionSheetController } from '@ionic/angular/standalone';
import { IonicModule } from '@ionic/angular';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    importProvidersFrom(IonicModule.forRoot()),
    provideIonicAngular({}),
    ModalController,
    AlertController,
    ToastController,
    LoadingController,
    ActionSheetController
  ]
};
