import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpEventType } from '@angular/common/http';
import { Observable, BehaviorSubject, map, tap, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Photo,
  PhotoResponse,
  PaginatedResponse,
  UpdatePhotoRequest,
  PhotoSearchFilters,
  PhotoComment,
  CreateCommentRequest,
  UpdateCommentRequest,
  UploadPhotoRequest,
  BulkUploadRequest,
  UploadProgress,
  PhotoStats
} from '../../../models/photos/photo.models';

@Injectable({
  providedIn: 'root'
})
export class PhotoService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api`;
  
  private readonly _uploadProgress = new BehaviorSubject<UploadProgress[]>([]);
  readonly uploadProgress$ = this._uploadProgress.asObservable();

  // Get photos from an album
  getPhotos(familySlug: string, albumId: string, page = 1, filters?: PhotoSearchFilters): Observable<PaginatedResponse<PhotoResponse>> {
    let params = new HttpParams().set('page', page.toString());
    
    if (filters) {
      if (filters.search) params = params.set('search', filters.search);
      if (filters.tags?.length) params = params.set('tags', filters.tags.join(','));
      if (filters.dateFrom) params = params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params = params.set('date_to', filters.dateTo);
      if (filters.uploadedBy) params = params.set('uploaded_by', filters.uploadedBy.toString());
      if (filters.isFavorite !== undefined) params = params.set('is_favorite', filters.isFavorite.toString());
      if (filters.hasLocation !== undefined) params = params.set('has_location', filters.hasLocation.toString());
      if (filters.sortBy) params = params.set('sort_by', filters.sortBy);
      if (filters.sortDirection) params = params.set('sort_direction', filters.sortDirection);
    }

    return this.http.get<PaginatedResponse<PhotoResponse>>(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}/photos`,
      { params }
    );
  }

  // Get a single photo
  getPhoto(familySlug: string, photoId: string): Observable<PhotoResponse> {
    return this.http.get<PhotoResponse>(
      `${this.baseUrl}/families/${familySlug}/albums/photos/${photoId}`
    );
  }

  // Upload single photo
  uploadPhoto(familySlug: string, albumId: string, photoData: UploadPhotoRequest): Observable<any> {
    const formData = new FormData();
    formData.append('file', photoData.file);
    
    if (photoData.description) formData.append('description', photoData.description);
    if (photoData.tags?.length) formData.append('tags', JSON.stringify(photoData.tags));
    if (photoData.location) formData.append('location', photoData.location);
    if (photoData.peopleTagged?.length) formData.append('people_tagged', JSON.stringify(photoData.peopleTagged));

    return this.http.post(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}/photos`,
      formData,
      {
        reportProgress: true,
        observe: 'events'
      }
    );
  }

  // Bulk upload photos
  bulkUploadPhotos(familySlug: string, albumId: string, uploadData: BulkUploadRequest): Observable<any> {
    const formData = new FormData();
    
    uploadData.files.forEach((photo, index) => {
      formData.append(`files[${index}]`, photo.file);
      if (photo.description) formData.append(`descriptions[${index}]`, photo.description);
      if (photo.tags?.length) formData.append(`tags[${index}]`, JSON.stringify(photo.tags));
      if (photo.location) formData.append(`locations[${index}]`, photo.location);
      if (photo.peopleTagged?.length) formData.append(`people_tagged[${index}]`, JSON.stringify(photo.peopleTagged));
    });

    return this.http.post(
      `${this.baseUrl}/families/${familySlug}/albums/${albumId}/photos/bulk`,
      formData,
      {
        reportProgress: true,
        observe: 'events'
      }
    );
  }

  // Update photo
  updatePhoto(familySlug: string, photoId: string, updateData: UpdatePhotoRequest): Observable<PhotoResponse> {
    return this.http.put<PhotoResponse>(
      `${this.baseUrl}/families/${familySlug}/albums/photos/${photoId}`,
      updateData
    );
  }

  // Delete photo
  deletePhoto(familySlug: string, photoId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/families/${familySlug}/albums/photos/${photoId}`
    );
  }

  // Like/Unlike photo
  likePhoto(familySlug: string, photoId: string): Observable<{ liked: boolean; likesCount: number }> {
    return this.http.post<{ liked: boolean; likesCount: number }>(
      `${this.baseUrl}/families/${familySlug}/albums/photos/${photoId}/like`,
      {}
    );
  }

  unlikePhoto(familySlug: string, photoId: string): Observable<{ liked: boolean; likesCount: number }> {
    return this.http.delete<{ liked: boolean; likesCount: number }>(
      `${this.baseUrl}/families/${familySlug}/albums/photos/${photoId}/like`
    );
  }

  // Toggle like (convenience method)
  toggleLike(familySlug: string, photoId: string, currentlyLiked: boolean): Observable<{ liked: boolean; likesCount: number }> {
    return currentlyLiked 
      ? this.unlikePhoto(familySlug, photoId)
      : this.likePhoto(familySlug, photoId);
  }

  // Get photo comments
  getComments(familySlug: string, photoId: string, page = 1): Observable<PaginatedResponse<PhotoComment>> {
    const params = new HttpParams().set('page', page.toString());
    
    return this.http.get<PaginatedResponse<PhotoComment>>(
      `${this.baseUrl}/families/${familySlug}/albums/photos/${photoId}/comments`,
      { params }
    );
  }

  // Add comment
  addComment(familySlug: string, photoId: string, commentData: CreateCommentRequest): Observable<PhotoComment> {
    return this.http.post<PhotoComment>(
      `${this.baseUrl}/families/${familySlug}/albums/photos/${photoId}/comments`,
      commentData
    );
  }

  // Update comment
  updateComment(familySlug: string, commentId: string, commentData: UpdateCommentRequest): Observable<PhotoComment> {
    return this.http.put<PhotoComment>(
      `${this.baseUrl}/families/${familySlug}/albums/comments/${commentId}`,
      commentData
    );
  }

  // Delete comment
  deleteComment(familySlug: string, commentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/families/${familySlug}/albums/comments/${commentId}`
    );
  }

  // Get recent photos across all albums
  getRecentPhotos(page = 1): Observable<PaginatedResponse<PhotoResponse>> {
    const params = new HttpParams().set('page', page.toString());
    
    return this.http.get<PaginatedResponse<PhotoResponse>>(
      `${this.baseUrl}/photos/recent`,
      { params }
    );
  }

  // Get favorite photos
  getFavoritePhotos(page = 1): Observable<PaginatedResponse<PhotoResponse>> {
    const params = new HttpParams().set('page', page.toString());
    
    return this.http.get<PaginatedResponse<PhotoResponse>>(
      `${this.baseUrl}/photos/favorites`,
      { params }
    );
  }

  // Get photos tagged with specific user
  getPhotosTaggedWithUser(userId: string, page = 1): Observable<PaginatedResponse<PhotoResponse>> {
    const params = new HttpParams().set('page', page.toString());
    
    return this.http.get<PaginatedResponse<PhotoResponse>>(
      `${this.baseUrl}/photos/tagged/${userId}`,
      { params }
    );
  }

  // Search photos globally
  searchPhotos(filters: PhotoSearchFilters, page = 1): Observable<PaginatedResponse<PhotoResponse>> {
    let params = new HttpParams().set('page', page.toString());
    
    if (filters.search) params = params.set('search', filters.search);
    if (filters.tags?.length) params = params.set('tags', filters.tags.join(','));
    if (filters.dateFrom) params = params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params = params.set('date_to', filters.dateTo);
    if (filters.uploadedBy) params = params.set('uploaded_by', filters.uploadedBy.toString());
    if (filters.isFavorite !== undefined) params = params.set('is_favorite', filters.isFavorite.toString());
    if (filters.hasLocation !== undefined) params = params.set('has_location', filters.hasLocation.toString());
    if (filters.sortBy) params = params.set('sort_by', filters.sortBy);
    if (filters.sortDirection) params = params.set('sort_direction', filters.sortDirection);

    return this.http.get<PaginatedResponse<PhotoResponse>>(
      `${this.baseUrl}/photos/search`,
      { params }
    );
  }

  // Get photo statistics
  getPhotoStats(familySlug?: string): Observable<PhotoStats> {
    const url = familySlug 
      ? `${this.baseUrl}/families/${familySlug}/photos/stats`
      : `${this.baseUrl}/photos/stats`;
    
    return this.http.get<PhotoStats>(url);
  }

  // Increment view count
  incrementViews(familySlug: string, photoId: string): Observable<{ viewsCount: number }> {
    return this.http.post<{ viewsCount: number }>(
      `${this.baseUrl}/families/${familySlug}/albums/photos/${photoId}/view`,
      {}
    );
  }

  // Download photo
  downloadPhoto(familySlug: string, photoId: string): Observable<Blob> {
    return this.http.get(
      `${this.baseUrl}/families/${familySlug}/albums/photos/${photoId}/download`,
      { responseType: 'blob' }
    );
  }

  // Download multiple photos as ZIP
  downloadPhotos(familySlug: string, photoIds: string[]): Observable<Blob> {
    return this.http.post(
      `${this.baseUrl}/families/${familySlug}/albums/photos/download-bulk`,
      { photo_ids: photoIds },
      { responseType: 'blob' }
    );
  }

  // Move photos to another album
  movePhotos(familySlug: string, photoIds: string[], targetAlbumId: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/families/${familySlug}/albums/photos/move`,
      { 
        photo_ids: photoIds,
        target_album_id: targetAlbumId
      }
    );
  }

  // Update upload progress
  updateUploadProgress(progress: UploadProgress[]): void {
    this._uploadProgress.next(progress);
  }

  // Get current upload progress
  getUploadProgress(): UploadProgress[] {
    return this._uploadProgress.value;
  }

  // Clear upload progress
  clearUploadProgress(): void {
    this._uploadProgress.next([]);
  }

  // Helper method to process upload events
  processUploadEvent(event: any, fileId: string): UploadProgress | null {
    if (event.type === HttpEventType.UploadProgress) {
      const progress = Math.round(100 * event.loaded / (event.total || 1));
      return {
        fileId,
        filename: '',
        progress,
        status: 'uploading'
      };
    } else if (event.type === HttpEventType.Response) {
      return {
        fileId,
        filename: '',
        progress: 100,
        status: 'completed'
      };
    }
    return null;
  }

  // Get photo URL with cache busting
  getPhotoUrl(photo: Photo, type: 'thumbnail' | 'full' = 'full'): string {
    const path = type === 'thumbnail' && photo.thumbnailPath ? photo.thumbnailPath : photo.path;
    const baseUrl = environment.production ? environment.apiUrl : 'http://localhost:8000';
    return `${baseUrl}/storage/${path}?v=${new Date(photo.updatedAt).getTime()}`;
  }

  // Generate sharing URL
  getShareUrl(familySlug: string, photoId: string): string {
    return `${window.location.origin}/family/${familySlug}/photos/shared/${photoId}`;
  }
}