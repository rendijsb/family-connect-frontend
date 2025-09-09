import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { addIcons } from 'ionicons';
import { homeOutline, peopleOutline, personCircleOutline } from 'ionicons/icons';

addIcons({
  personCircleOutline,
  peopleOutline,
  homeOutline,
});

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
