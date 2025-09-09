import { Routes } from '@angular/router';

export const photosRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./photo-albums.page').then(m => m.PhotoAlbumsPage),
    data: { title: 'Photo Albums' }
  },
  {
    path: ':albumId',
    loadComponent: () => import('./album-detail.page').then(m => m.AlbumDetailPage),
    data: { title: 'Album Details' }
  }
];