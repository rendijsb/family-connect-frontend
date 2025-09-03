import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { RoleEnum } from './models/users/user.models';

export const routes: Routes = [
  {
    path: '',
    redirectTo: (route) => {
      return '/login';
    },
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then(m => m.RegisterPage)
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadChildren: () => import('./tabs/tabs.routes').then(m => m.routes)
  },
  {
    path: 'family',
    canActivate: [authGuard],
    loadChildren: () => import('./pages/family/family.routes').then(m => m.familyRoutes)
  },
  {
    path: 'invitations',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/invitations/pending-invitations.page').then(m => m.PendingInvitationsPage)
  },
  // {
  //   path: 'profile/:userId',
  //   canActivate: [authGuard],
  //   loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage)
  // },
  // {
  //   path: 'chat',
  //   canActivate: [authGuard],
  //   loadChildren: () => import('./pages/chat/chat.routes').then(m => m.chatRoutes)
  // },
  // {
  //   path: 'not-found',
  //   loadComponent: () => import('./pages/not-found/not-found.page').then(m => m.NotFoundPage)
  // },
  // {
  //   path: 'unauthorized',
  //   loadComponent: () => import('./pages/unauthorized/unauthorized.page').then(m => m.UnauthorizedPage)
  // },
  {
    path: '**',
    redirectTo: '/not-found'
  }
];
