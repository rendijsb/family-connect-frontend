import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { RoleEnum } from '../../models/users/user.models';

export const roleGuard = (allowedRoles: RoleEnum[]): CanActivateFn => {
  return (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    const user = authService.user();

    if (user && user.role && allowedRoles.includes(user.role.name as RoleEnum)) {
      return true;
    } else {
      // Redirect to unauthorized page or appropriate route
      router.navigate(['/tabs/home']); // or '/unauthorized' if you have that page
      return false;
    }
  };
};
