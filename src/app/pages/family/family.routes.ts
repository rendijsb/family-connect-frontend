import { Routes } from '@angular/router';
import {
  familyGuard,
  familyModeratorGuard,
  familyAllGuard,
} from '../../core/guards/family.guard';

export const routes: Routes = [
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
  {
    path: ':slug/chat',
    canActivate: [familyGuard, familyAllGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('../chat/chat-list/chat-list.page').then((m) => m.ChatListPage),
      },
      {
        path: 'create',
        loadComponent: () =>
          import('../chat/create-room/create-chat-room.page').then(
            (m) => m.CreateChatRoomPage
          ),
      },
      {
        path: ':roomId',
        loadComponent: () =>
          import('../chat/chat-room/chat-room.page').then((m) => m.ChatRoomPage),
      },
      {
        path: ':roomId/settings',
        loadComponent: () =>
          import('../chat/room-settings/room-settings.page').then(
            (m) => m.RoomSettingsPage
          ),
      },
    ],
  },
];

export const familyRoutes = routes;

export const invitationRoutes: Routes = [
  {
    path: 'invitations',
    loadComponent: () =>
      import('../invitations/pending-invitations.page').then(
        (m) => m.PendingInvitationsPage
      ),
  },
];
