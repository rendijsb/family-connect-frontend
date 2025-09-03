import { Routes } from '@angular/router';
import {
  familyGuard,
  familyModeratorGuard,
} from '../../core/guards/family.guard';

export const familyRoutes: Routes = [
  {
    path: 'create',
    loadComponent: () =>
      import('./create/family-create.page').then((m) => m.FamilyCreatePage),
  },
  {
    path: ':slug',
    canActivate: [familyGuard],
    loadComponent: () =>
      import('./detail/family-detail.page').then((m) => m.FamilyDetailPage),
  },
  {
    path: ':slug/members',
    canActivate: [familyGuard, familyModeratorGuard],
    loadComponent: () =>
      import('./members/family-members.page').then((m) => m.FamilyMembersPage),
  },
  {
    path: ':slug/settings',
    canActivate: [familyGuard, familyModeratorGuard],
    loadComponent: () =>
      import('./settings/family-settings.page').then(
        (m) => m.FamilySettingsPage
      ),
  },
];

export const invitationRoutes: Routes = [
  {
    path: 'invitations',
    loadComponent: () =>
      import('../invitations/pending-invitations.page').then(
        (m) => m.PendingInvitationsPage
      ),
  },
];
