
import { Routes } from '@angular/router';
import { familyGuard, familyAllGuard } from '../../core/guards/family.guard';

export const chatRoutes: Routes = [
  {
    path: ':slug/chat',
    canActivate: [familyGuard, familyAllGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./chat-list/chat-list.page').then((m) => m.ChatListPage),
      },
      {
        path: 'create',
        loadComponent: () =>
          import('./create-room/create-chat-room.page').then(
            (m) => m.CreateChatRoomPage
          ),
      },
      {
        path: ':roomId',
        loadComponent: () =>
          import('./chat-room/chat-room.page').then((m) => m.ChatRoomPage),
      },
      {
        path: ':roomId/settings',
        loadComponent: () =>
          import('./room-settings/room-settings.page').then(
            (m) => m.RoomSettingsPage
          ),
      },
    ],
  },
];
