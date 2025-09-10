import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Memory,
  MemoryResponse,
  MemoryFilters,
  CreateMemoryRequest,
  UpdateMemoryRequest,
  CreateMemoryCommentRequest,
  UpdateMemoryCommentRequest,
  MemoryComment,
  MemoryTimelineItem,
  MemoryStats,
  PaginatedResponse
} from '../../../models/memories/memory.models';

@Injectable({
  providedIn: 'root'
})
export class MemoryService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api`;
  
  private readonly _featuredMemories = new BehaviorSubject<Memory[]>([]);
  readonly featuredMemories$ = this._featuredMemories.asObservable();

  // Get memories for a family
  getMemories(familySlug: string, page = 1, filters?: MemoryFilters): Observable<PaginatedResponse<MemoryResponse>> {
    let params = new HttpParams().set('page', page.toString());
    
    if (filters) {
      if (filters.search) params = params.set('search', filters.search);
      if (filters.type?.length) params = params.set('type', filters.type.join(','));
      if (filters.tags?.length) params = params.set('tags', filters.tags.join(','));
      if (filters.participants?.length) params = params.set('participants', filters.participants.join(','));
      if (filters.dateFrom) params = params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params = params.set('date_to', filters.dateTo);
      if (filters.createdBy) params = params.set('created_by', filters.createdBy.toString());
      if (filters.visibility?.length) params = params.set('visibility', filters.visibility.join(','));
      if (filters.isFeatured !== undefined) params = params.set('is_featured', filters.isFeatured.toString());
      if (filters.sortBy) params = params.set('sort_by', filters.sortBy);
      if (filters.sortDirection) params = params.set('sort_direction', filters.sortDirection);
    }

    return this.http.get<PaginatedResponse<MemoryResponse>>(
      `${this.baseUrl}/families/${familySlug}/memories`,
      { params }
    );
  }

  // Get memory timeline
  getTimeline(familySlug: string, year?: number): Observable<MemoryTimelineItem[]> {
    let params = new HttpParams();
    if (year) params = params.set('year', year.toString());

    return this.http.get<MemoryTimelineItem[]>(
      `${this.baseUrl}/families/${familySlug}/memories/timeline`,
      { params }
    );
  }

  // Get featured memories
  getFeaturedMemories(familySlug: string): Observable<MemoryResponse[]> {
    return this.http.get<MemoryResponse[]>(
      `${this.baseUrl}/families/${familySlug}/memories/featured`
    );
  }

  // Get single memory
  getMemory(familySlug: string, memoryId: string): Observable<MemoryResponse> {
    return this.http.get<MemoryResponse>(
      `${this.baseUrl}/families/${familySlug}/memories/${memoryId}`
    );
  }

  // Create memory
  createMemory(familySlug: string, memoryData: CreateMemoryRequest): Observable<MemoryResponse> {
    const formData = new FormData();
    
    formData.append('title', memoryData.title);
    formData.append('type', memoryData.type);
    formData.append('memory_date', memoryData.memoryDate);
    formData.append('visibility', memoryData.visibility);
    
    if (memoryData.description) formData.append('description', memoryData.description);
    if (memoryData.participants?.length) formData.append('participants', JSON.stringify(memoryData.participants));
    if (memoryData.location) formData.append('location', JSON.stringify(memoryData.location));
    if (memoryData.tags?.length) formData.append('tags', JSON.stringify(memoryData.tags));
    if (memoryData.visibleTo?.length) formData.append('visible_to', JSON.stringify(memoryData.visibleTo));
    if (memoryData.isFeatured) formData.append('is_featured', memoryData.isFeatured.toString());
    
    // Handle media files
    if (memoryData.media && Array.isArray(memoryData.media)) {
      memoryData.media.forEach((file, index) => {
        if (file instanceof File) {
          formData.append(`media[${index}]`, file);
        }
      });
    }

    return this.http.post<MemoryResponse>(
      `${this.baseUrl}/families/${familySlug}/memories`,
      formData
    );
  }

  // Update memory
  updateMemory(familySlug: string, memoryId: string, updateData: UpdateMemoryRequest): Observable<MemoryResponse> {
    return this.http.put<MemoryResponse>(
      `${this.baseUrl}/families/${familySlug}/memories/${memoryId}`,
      updateData
    );
  }

  // Delete memory
  deleteMemory(familySlug: string, memoryId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/families/${familySlug}/memories/${memoryId}`
    );
  }

  // Like/Unlike memory
  likeMemory(familySlug: string, memoryId: string): Observable<{ liked: boolean; likesCount: number }> {
    return this.http.post<{ liked: boolean; likesCount: number }>(
      `${this.baseUrl}/families/${familySlug}/memories/${memoryId}/like`,
      {}
    );
  }

  unlikeMemory(familySlug: string, memoryId: string): Observable<{ liked: boolean; likesCount: number }> {
    return this.http.delete<{ liked: boolean; likesCount: number }>(
      `${this.baseUrl}/families/${familySlug}/memories/${memoryId}/like`
    );
  }

  // Toggle like (convenience method)
  toggleLike(familySlug: string, memoryId: string, currentlyLiked: boolean): Observable<{ liked: boolean; likesCount: number }> {
    return currentlyLiked 
      ? this.unlikeMemory(familySlug, memoryId)
      : this.likeMemory(familySlug, memoryId);
  }

  // Feature/Unfeature memory
  featureMemory(familySlug: string, memoryId: string): Observable<{ featured: boolean }> {
    return this.http.post<{ featured: boolean }>(
      `${this.baseUrl}/families/${familySlug}/memories/${memoryId}/feature`,
      {}
    );
  }

  unfeatureMemory(familySlug: string, memoryId: string): Observable<{ featured: boolean }> {
    return this.http.delete<{ featured: boolean }>(
      `${this.baseUrl}/families/${familySlug}/memories/${memoryId}/feature`
    );
  }

  // Get memory comments
  getComments(familySlug: string, memoryId: string, page = 1): Observable<PaginatedResponse<MemoryComment>> {
    const params = new HttpParams().set('page', page.toString());
    
    return this.http.get<PaginatedResponse<MemoryComment>>(
      `${this.baseUrl}/families/${familySlug}/memories/${memoryId}/comments`,
      { params }
    );
  }

  // Add comment
  addComment(familySlug: string, memoryId: string, commentData: CreateMemoryCommentRequest): Observable<MemoryComment> {
    return this.http.post<MemoryComment>(
      `${this.baseUrl}/families/${familySlug}/memories/${memoryId}/comments`,
      commentData
    );
  }

  // Update comment
  updateComment(familySlug: string, commentId: string, commentData: UpdateMemoryCommentRequest): Observable<MemoryComment> {
    return this.http.put<MemoryComment>(
      `${this.baseUrl}/families/${familySlug}/memories/comments/${commentId}`,
      commentData
    );
  }

  // Delete comment
  deleteComment(familySlug: string, commentId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/families/${familySlug}/memories/comments/${commentId}`
    );
  }

  // Get recent memories (global)
  getRecentMemories(page = 1): Observable<PaginatedResponse<MemoryResponse>> {
    const params = new HttpParams().set('page', page.toString());
    
    return this.http.get<PaginatedResponse<MemoryResponse>>(
      `${this.baseUrl}/memories/recent`,
      { params }
    );
  }

  // Get favorite memories (global)
  getFavoriteMemoriesGlobal(page = 1): Observable<PaginatedResponse<MemoryResponse>> {
    const params = new HttpParams().set('page', page.toString());
    
    return this.http.get<PaginatedResponse<MemoryResponse>>(
      `${this.baseUrl}/memories/favorites`,
      { params }
    );
  }

  // Search memories globally
  searchMemories(filters: MemoryFilters, page = 1): Observable<PaginatedResponse<MemoryResponse>> {
    let params = new HttpParams().set('page', page.toString());
    
    if (filters.search) params = params.set('search', filters.search);
    if (filters.type?.length) params = params.set('type', filters.type.join(','));
    if (filters.tags?.length) params = params.set('tags', filters.tags.join(','));
    if (filters.dateFrom) params = params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params = params.set('date_to', filters.dateTo);
    if (filters.sortBy) params = params.set('sort_by', filters.sortBy);
    if (filters.sortDirection) params = params.set('sort_direction', filters.sortDirection);

    return this.http.get<PaginatedResponse<MemoryResponse>>(
      `${this.baseUrl}/memories/search`,
      { params }
    );
  }

  // Get memory statistics
  getMemoryStats(familySlug?: string): Observable<MemoryStats> {
    const url = familySlug 
      ? `${this.baseUrl}/families/${familySlug}/memories/stats`
      : `${this.baseUrl}/memories/stats`;
    
    return this.http.get<MemoryStats>(url);
  }

  // Generate memory video
  generateMemoryVideo(familySlug: string, memoryIds: string[]): Observable<{ jobId: string }> {
    return this.http.post<{ jobId: string }>(
      `${this.baseUrl}/families/${familySlug}/memories/generate-video`,
      { memory_ids: memoryIds }
    );
  }

  // Generate memory book
  generateMemoryBook(familySlug: string, filters?: MemoryFilters): Observable<{ jobId: string }> {
    return this.http.post<{ jobId: string }>(
      `${this.baseUrl}/families/${familySlug}/memories/generate-book`,
      { filters }
    );
  }

  // Export memories
  exportMemories(familySlug: string, format: 'pdf' | 'json' | 'csv', filters?: MemoryFilters): Observable<Blob> {
    let params = new HttpParams().set('format', format);
    
    if (filters) {
      if (filters.dateFrom) params = params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params = params.set('date_to', filters.dateTo);
      if (filters.type?.length) params = params.set('type', filters.type.join(','));
    }

    return this.http.get(
      `${this.baseUrl}/families/${familySlug}/memories/export`,
      { 
        params,
        responseType: 'blob' 
      }
    );
  }

  // Get memory media URL
  getMediaUrl(media: any): string {
    if (media?.url) {
      return media.url.startsWith('http') 
        ? media.url 
        : `${environment.apiUrl}/storage/${media.url}`;
    }
    return '';
  }

  // Generate sharing URL
  getShareUrl(familySlug: string, memoryId: string): string {
    return `${window.location.origin}/family/${familySlug}/memories/shared/${memoryId}`;
  }

  // Update featured memories cache
  updateFeaturedMemories(memories: Memory[]): void {
    this._featuredMemories.next(memories);
  }

  // Get featured memories from cache
  getFeaturedMemoriesFromCache(): Memory[] {
    return this._featuredMemories.value;
  }

  // Clear featured memories cache
  clearFeaturedMemoriesCache(): void {
    this._featuredMemories.next([]);
  }
}