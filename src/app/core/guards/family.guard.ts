import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { FamilyService } from '../services/family/family.service';
import { AuthService } from '../services/auth/auth.service';
import { FamilyRoleEnum } from '../../models/families/family.models';

export const familyGuard: CanActivateFn = (route, state) => {
  const familyService = inject(FamilyService);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  const familySlug = route.params['slug'];
  if (!familySlug) {
    router.navigate(['/tabs/family']);
    return false;
  }

  return familyService.getFamilyBySlug(familySlug).pipe(
    map(response => {
      const family = response.data;

      if (!family) {
        router.navigate(['/tabs/family']);
        return false;
      }

      if (!family.currentUserRole) {
        router.navigate(['/tabs/family']);
        return false;
      }

      return true;
    }),
    catchError(error => {
      console.error('Family guard error:', error);
      router.navigate(['/tabs/family']);
      return of(false);
    })
  );
};

export const familyRoleGuard = (allowedRoles: FamilyRoleEnum[]): CanActivateFn => {
  return (route, state) => {
    const familyService = inject(FamilyService);
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }

    const familySlug = route.params['slug'];
    if (!familySlug) {
      router.navigate(['/tabs/family']);
      return false;
    }

    return familyService.getFamilyBySlug(familySlug).pipe(
      map(response => {
        const family = response.data;

        if (!family || !family.currentUserRole) {
          router.navigate(['/tabs/family']);
          return false;
        }

        const userRole = family.currentUserRole as FamilyRoleEnum;

        if (!allowedRoles.includes(userRole)) {
          router.navigate([`/family/${familySlug}`]);
          return false;
        }

        return true;
      }),
      catchError(error => {
        console.error('Family role guard error:', error);
        router.navigate(['/tabs/family']);
        return of(false);
      })
    );
  };
};

export const familyOwnerGuard: CanActivateFn = familyRoleGuard([FamilyRoleEnum.OWNER]);

export const familyModeratorGuard: CanActivateFn = familyRoleGuard([
  FamilyRoleEnum.OWNER,
  FamilyRoleEnum.MODERATOR
]);

export const familyMemberGuard: CanActivateFn = familyRoleGuard([
  FamilyRoleEnum.OWNER,
  FamilyRoleEnum.MODERATOR,
  FamilyRoleEnum.MEMBER
]);

export const familyAllGuard: CanActivateFn = familyRoleGuard([
  FamilyRoleEnum.OWNER,
  FamilyRoleEnum.MODERATOR,
  FamilyRoleEnum.MEMBER,
  FamilyRoleEnum.CHILD
]);

export const familyPermissionGuard = (permission: string): CanActivateFn => {
  return (route, state) => {
    const familyService = inject(FamilyService);
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      router.navigate(['/login']);
      return false;
    }

    const familySlug = route.params['slug'];
    if (!familySlug) {
      router.navigate(['/tabs/family']);
      return false;
    }

    return familyService.getFamilyBySlug(familySlug).pipe(
      map(response => {
        const family = response.data;

        if (!family) {
          router.navigate(['/tabs/family']);
          return false;
        }

        if (!familyService.hasPermission(family, permission)) {
          router.navigate([`/family/${familySlug}`]);
          return false;
        }

        return true;
      }),
      catchError(error => {
        console.error('Family permission guard error:', error);
        router.navigate(['/tabs/family']);
        return of(false);
      })
    );
  };
};
