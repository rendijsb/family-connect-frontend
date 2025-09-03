import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { map } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthInitialized()) {
    return authService.waitForInitialization().pipe(
      map(() => {
        if (authService.isAuthenticated()) {
          return true;
        } else {
          router.navigate(['/login']);
          return false;
        }
      })
    );
  }

  if (authService.isAuthenticated()) {
    return true;
  } else {
    router.navigate(['/login']);
    return false;
  }
};
