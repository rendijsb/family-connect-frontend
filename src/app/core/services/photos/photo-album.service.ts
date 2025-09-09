import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  PhotoAlbum,
  AlbumResponse,
  PaginatedResponse,
  CreateAlbumRequest,
  UpdateAlbumRequest,
  AlbumSearchFilters,
  AlbumStats,
  Photo
} from '../../../models/photos/photo.models';

@Injectable({
  providedIn: 'root'
})
export class PhotoAlbumService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api`;
  
  // Cache for current family's albums
  private readonly _albums = new BehaviorSubject<PhotoAlbum[]>([]);
  private readonly _currentAlbum = new BehaviorSubject<PhotoAlbum | null>(null);
  
  readonly albums$ = this._albums.asObservable();
  readonly currentAlbum$ = this._currentAlbum.asObservable();

  // Get albums for a family
  getAlbums(familySlug: string, page = 1, filters?: AlbumSearchFilters): Observable<PaginatedResponse<AlbumResponse>> {
    let params = new HttpParams().set('page', page.toString());
    
    if (filters) {
      if (filters.search) params = params.set('search', filters.search);
      if (filters.privacy?.length) params = params.set('privacy', filters.privacy.join(','));
      if (filters.createdBy) params = params.set('created_by', filters.createdBy.toString());
      if (filters.sortBy) params = params.set('sort_by', filters.sortBy);
      if (filters.sortDirection) params = params.set('sort_direction', filters.sortDirection);
    }

    return this.http.get<PaginatedResponse<AlbumResponse>>(
      `${this.baseUrl}/families/${familySlug}/albums`,
      { params }
    ).pipe(
      tap(response => {
        if (page === 1) {
          this._albums.next(response.data);
        } else {
          const currentAlbums = this._albums.value;
          this._albums.next([...currentAlbums, ...response.data]);
        }
      })
    );
  }

  // Get a single album
  getAlbum(familySlug: string, albumId: string): Observable<AlbumResponse> {
    return this.http.get<AlbumResponse>(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}`
    ).pipe(
      tap(album => this._currentAlbum.next(album))
    );
  }

  // Create new album
  createAlbum(familySlug: string, albumData: CreateAlbumRequest): Observable<AlbumResponse> {
    return this.http.post<AlbumResponse>(
      `${this.baseUrl}/families/${familySlug}/albums`,
      albumData
    ).pipe(
      tap(newAlbum => {
        const currentAlbums = this._albums.value;
        this._albums.next([newAlbum, ...currentAlbums]);
      })
    );
  }

  // Update album
  updateAlbum(familySlug: string, albumId: string, updateData: UpdateAlbumRequest): Observable<AlbumResponse> {
    return this.http.put<AlbumResponse>(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}`,
      updateData
    ).pipe(
      tap(updatedAlbum => {
        // Update in albums list
        const currentAlbums = this._albums.value;
        const albumIndex = currentAlbums.findIndex(a => a.id === updatedAlbum.id);
        if (albumIndex !== -1) {
          currentAlbums[albumIndex] = updatedAlbum;
          this._albums.next([...currentAlbums]);
        }
        
        // Update current album if it's the same
        if (this._currentAlbum.value?.id === updatedAlbum.id) {
          this._currentAlbum.next(updatedAlbum);
        }
      })
    );
  }

  // Delete album
  deleteAlbum(familySlug: string, albumId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}`
    ).pipe(
      tap(() => {
        // Remove from albums list
        const currentAlbums = this._albums.value;
        const filteredAlbums = currentAlbums.filter(a => a.id.toString() !== albumId);
        this._albums.next(filteredAlbums);
        
        // Clear current album if it's the same
        if (this._currentAlbum.value?.id.toString() === albumId) {
          this._currentAlbum.next(null);
        }
      })
    );
  }

  // Get album statistics
  getAlbumStats(familySlug: string, albumId?: string): Observable<AlbumStats> {
    const url = albumId 
      ? `${this.baseUrl}/families/${familySlug}/albums/${albumId}/stats`
      : `${this.baseUrl}/families/${familySlug}/albums/stats`;
    
    return this.http.get<AlbumStats>(url);
  }

  // Set album cover photo
  setCoverPhoto(familySlug: string, albumId: string, photoId: string): Observable<AlbumResponse> {
    return this.http.post<AlbumResponse>(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}/cover`,
      { photo_id: photoId }
    ).pipe(
      tap(updatedAlbum => {
        // Update in albums list
        const currentAlbums = this._albums.value;
        const albumIndex = currentAlbums.findIndex(a => a.id === updatedAlbum.id);
        if (albumIndex !== -1) {
          currentAlbums[albumIndex] = updatedAlbum;
          this._albums.next([...currentAlbums]);
        }
        
        // Update current album if it's the same
        if (this._currentAlbum.value?.id === updatedAlbum.id) {
          this._currentAlbum.next(updatedAlbum);
        }
      })
    );
  }

  // Get recent albums across all families
  getRecentAlbums(page = 1): Observable<PaginatedResponse<AlbumResponse>> {
    const params = new HttpParams().set('page', page.toString());
    
    return this.http.get<PaginatedResponse<AlbumResponse>>(
      `${this.baseUrl}/albums/recent`,
      { params }
    );
  }

  // Search albums globally
  searchAlbums(filters: AlbumSearchFilters, page = 1): Observable<PaginatedResponse<AlbumResponse>> {
    let params = new HttpParams().set('page', page.toString());
    
    if (filters.search) params = params.set('search', filters.search);
    if (filters.privacy?.length) params = params.set('privacy', filters.privacy.join(','));
    if (filters.createdBy) params = params.set('created_by', filters.createdBy.toString());
    if (filters.sortBy) params = params.set('sort_by', filters.sortBy);
    if (filters.sortDirection) params = params.set('sort_direction', filters.sortDirection);

    return this.http.get<PaginatedResponse<AlbumResponse>>(
      `${this.baseUrl}/albums/search`,
      { params }
    );
  }

  // Duplicate album
  duplicateAlbum(familySlug: string, albumId: string, newName: string): Observable<AlbumResponse> {
    return this.http.post<AlbumResponse>(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}/duplicate`,
      { name: newName }
    ).pipe(
      tap(newAlbum => {
        const currentAlbums = this._albums.value;
        this._albums.next([newAlbum, ...currentAlbums]);
      })
    );
  }

  // Share album (generate sharing link)
  shareAlbum(familySlug: string, albumId: string, settings?: { 
    allowDownload?: boolean; 
    expiresAt?: string; 
    password?: string 
  }): Observable<{ shareUrl: string; shareCode: string }> {
    return this.http.post<{ shareUrl: string; shareCode: string }>(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}/share`,
      settings || {}
    );
  }

  // Get shared album (public access)
  getSharedAlbum(shareCode: string): Observable<AlbumResponse> {
    return this.http.get<AlbumResponse>(
      `${this.baseUrl}/albums/shared/${shareCode}`
    );
  }

  // Archive album
  archiveAlbum(familySlug: string, albumId: string): Observable<AlbumResponse> {
    return this.http.post<AlbumResponse>(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}/archive`,
      {}
    );
  }

  // Restore archived album
  restoreAlbum(familySlug: string, albumId: string): Observable<AlbumResponse> {
    return this.http.post<AlbumResponse>(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}/restore`,
      {}
    );
  }

  // Get archived albums
  getArchivedAlbums(familySlug: string, page = 1): Observable<PaginatedResponse<AlbumResponse>> {
    const params = new HttpParams().set('page', page.toString());
    
    return this.http.get<PaginatedResponse<AlbumResponse>>(
      `${this.baseUrl}/families/${familySlug}/albums/archived`,
      { params }
    );
  }

  // Download entire album as ZIP
  downloadAlbum(familySlug: string, albumId: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}/download`,
      { responseType: 'blob' }
    );
  }

  // Update album permissions
  updatePermissions(familySlug: string, albumId: string, permissions: {
    allowedMembers?: number[];
    allowDownload?: boolean;
    allowComments?: boolean;
  }): Observable<AlbumResponse> {
    return this.http.put<AlbumResponse>(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}/permissions`,
      permissions
    );
  }

  // Merge albums
  mergeAlbums(familySlug: string, sourceAlbumIds: string[], targetAlbumId: string): Observable<AlbumResponse> {
    return this.http.post<AlbumResponse>(
      `${this.baseUrl}/families/${familySlug}/albums/merge`,
      {
        source_album_ids: sourceAlbumIds,
        target_album_id: targetAlbumId
      }
    );
  }

  // Get album activity/history
  getAlbumActivity(familySlug: string, albumId: string, page = 1): Observable<PaginatedResponse<any>> {
    const params = new HttpParams().set('page', page.toString());
    
    return this.http.get<PaginatedResponse<any>>(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}/activity`,
      { params }
    );
  }

  // Clear cached data
  clearCache(): void {
    this._albums.next([]);
    this._currentAlbum.next(null);
  }

  // Update album locally (for real-time updates)
  updateAlbumLocally(albumId: number, updates: Partial<PhotoAlbum>): void {
    const currentAlbums = this._albums.value;
    const albumIndex = currentAlbums.findIndex(a => a.id === albumId);
    
    if (albumIndex !== -1) {
      currentAlbums[albumIndex] = { ...currentAlbums[albumIndex], ...updates };
      this._albums.next([...currentAlbums]);
    }
    
    if (this._currentAlbum.value?.id === albumId) {
      this._currentAlbum.next({ ...this._currentAlbum.value, ...updates });
    }
  }

  // Add photo to album locally
  addPhotoToAlbum(albumId: number, photo: Photo): void {
    this.updateAlbumLocally(albumId, {
      photoCount: (this._currentAlbum.value?.photoCount || 0) + 1,
      totalSize: (this._currentAlbum.value?.totalSize || 0) + photo.size,
      lastUpdatedAt: new Date().toISOString()
    });
  }

  // Remove photo from album locally
  removePhotoFromAlbum(albumId: number, photo: Photo): void {
    this.updateAlbumLocally(albumId, {
      photoCount: Math.max((this._currentAlbum.value?.photoCount || 1) - 1, 0),
      totalSize: Math.max((this._currentAlbum.value?.totalSize || photo.size) - photo.size, 0),
      lastUpdatedAt: new Date().toISOString()
    });
  }

  // Get cached albums
  getCachedAlbums(): PhotoAlbum[] {
    return this._albums.value;
  }

  // Get cached current album
  getCachedCurrentAlbum(): PhotoAlbum | null {
    return this._currentAlbum.value;
  }

  // Generate album URL
  getAlbumUrl(familySlug: string, albumId: string): string {
    return `${window.location.origin}/family/${familySlug}/photos/${albumId}`;
  }

  // Generate album cover URL
  getAlbumCoverUrl(album: PhotoAlbum): string {
    if (!album.coverPhoto) {
      return '/assets/default-album-cover.jpg';
    }
    
    const baseUrl = environment.production ? environment.apiUrl : 'http://localhost:8000';
    return `${baseUrl}/storage/${album.coverPhoto}?v=${new Date(album.updatedAt).getTime()}`;
  }

  // Check if user can perform action on album
  canPerformAction(album: AlbumResponse, action: 'edit' | 'delete' | 'addPhotos' | 'managePhotos'): boolean {
    switch (action) {
      case 'edit':
        return album.permissions?.canEdit || false;
      case 'delete':
        return album.permissions?.canDelete || false;
      case 'addPhotos':
        return album.permissions?.canAddPhotos || false;
      case 'managePhotos':
        return album.permissions?.canManagePhotos || false;
      default:
        return false;
    }
  }
}