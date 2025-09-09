import { Injectable, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WebSocketService } from '../websocket/websocket.service';
import { PhotoAlbumService } from './photo-album.service';
import { PhotoService } from './photo.service';
import {
  PhotoLikedEvent,
  PhotoCommentedEvent,
  PhotoUploadedEvent,
  AlbumUpdatedEvent,
  Photo,
  PhotoComment
} from '../../../models/photos/photo.models';

@Injectable({
  providedIn: 'root'
})
export class PhotoRealtimeService {
  private websocketService = inject(WebSocketService);
  private albumService = inject(PhotoAlbumService);
  private photoService = inject(PhotoService);

  // Real-time event streams
  private readonly _photoLiked = new BehaviorSubject<PhotoLikedEvent | null>(null);
  private readonly _photoCommented = new BehaviorSubject<PhotoCommentedEvent | null>(null);
  private readonly _photoCommentDeleted = new BehaviorSubject<any | null>(null);
  private readonly _photoUploaded = new BehaviorSubject<PhotoUploadedEvent | null>(null);
  private readonly _albumUpdated = new BehaviorSubject<AlbumUpdatedEvent | null>(null);
  private readonly _albumCreated = new BehaviorSubject<any | null>(null);

  readonly photoLiked$ = this._photoLiked.asObservable();
  readonly photoCommented$ = this._photoCommented.asObservable();
  readonly photoCommentDeleted$ = this._photoCommentDeleted.asObservable();
  readonly photoUploaded$ = this._photoUploaded.asObservable();
  readonly albumUpdated$ = this._albumUpdated.asObservable();
  readonly albumCreated$ = this._albumCreated.asObservable();

  private subscribedChannels = new Set<string>();

  constructor() {
    this.setupGlobalListeners();
  }

  private setupGlobalListeners() {
    // Listen for connection status
    this.websocketService.connectionStatus$.subscribe(status => {
      console.log('Photo realtime - WebSocket status:', status);
    });
  }

  // Subscribe to family photo channels
  subscribeToFamilyPhotos(familySlug: string) {
    const channelName = `family.${familySlug}.photos`;
    
    if (this.subscribedChannels.has(channelName)) {
      return;
    }

    console.log('Subscribing to family photos channel:', channelName);
    
    this.websocketService.subscribeToChannel(channelName, (data: any) => {
      this.handleFamilyPhotoEvent(data);
    });

    this.subscribedChannels.add(channelName);
  }

  // Subscribe to specific album channels
  subscribeToAlbum(familySlug: string, albumId: string) {
    const channelName = `family.${familySlug}.album.${albumId}`;
    
    if (this.subscribedChannels.has(channelName)) {
      return;
    }

    console.log('Subscribing to album channel:', channelName);
    
    this.websocketService.subscribeToChannel(channelName, (data: any) => {
      this.handleAlbumEvent(data);
    });

    this.subscribedChannels.add(channelName);
  }

  // Subscribe to specific photo channels
  subscribeToPhoto(familySlug: string, photoId: string) {
    const channelName = `family.${familySlug}.photo.${photoId}`;
    
    if (this.subscribedChannels.has(channelName)) {
      return;
    }

    console.log('Subscribing to photo channel:', channelName);
    
    this.websocketService.subscribeToChannel(channelName, (data: any) => {
      this.handlePhotoEvent(data);
    });

    this.subscribedChannels.add(channelName);
  }

  // Unsubscribe from channels
  unsubscribeFromFamily(familySlug: string) {
    const channelName = `family.${familySlug}.photos`;
    this.websocketService.unsubscribeFromChannel(channelName);
    this.subscribedChannels.delete(channelName);
  }

  unsubscribeFromAlbum(familySlug: string, albumId: string) {
    const channelName = `family.${familySlug}.album.${albumId}`;
    this.websocketService.unsubscribeFromChannel(channelName);
    this.subscribedChannels.delete(channelName);
  }

  unsubscribeFromPhoto(familySlug: string, photoId: string) {
    const channelName = `family.${familySlug}.photo.${photoId}`;
    this.websocketService.unsubscribeFromChannel(channelName);
    this.subscribedChannels.delete(channelName);
  }

  // Event handlers
  private handleFamilyPhotoEvent(event: any) {
    console.log('Family photo event received:', event);

    switch (event.type) {
      case 'photo.uploaded':
        this.handlePhotoUploaded(event.data);
        break;
      case 'album.created':
        this.handleAlbumCreated(event.data);
        break;
      case 'album.updated':
        this.handleAlbumUpdated(event.data);
        break;
      case 'album.deleted':
        this.handleAlbumDeleted(event.data);
        break;
    }
  }

  private handleAlbumEvent(event: any) {
    console.log('Album event received:', event);

    switch (event.type) {
      case 'photo.uploaded':
        this.handlePhotoUploaded(event.data);
        break;
      case 'photo.deleted':
        this.handlePhotoDeleted(event.data);
        break;
      case 'album.updated':
        this.handleAlbumUpdated(event.data);
        break;
      case 'album.stats.updated':
        this.handleAlbumStatsUpdated(event.data);
        break;
    }
  }

  private handlePhotoEvent(event: any) {
    console.log('Photo event received:', event);

    switch (event.type) {
      case 'photo.liked':
        this.handlePhotoLiked(event.data);
        break;
      case 'photo.unliked':
        this.handlePhotoUnliked(event.data);
        break;
      case 'photo.commented':
        this.handlePhotoCommented(event.data);
        break;
      case 'photo.comment.deleted':
        this.handlePhotoCommentDeleted(event.data);
        break;
      case 'photo.updated':
        this.handlePhotoUpdated(event.data);
        break;
      case 'photo.views.updated':
        this.handlePhotoViewsUpdated(event.data);
        break;
    }
  }

  // Specific event handlers
  private handlePhotoUploaded(data: PhotoUploadedEvent) {
    console.log('Photo uploaded:', data);
    
    // Update album stats locally
    this.albumService.addPhotoToAlbum(data.albumId, data.photo);
    
    // Emit event for components
    this._photoUploaded.next(data);
  }

  private handlePhotoLiked(data: PhotoLikedEvent) {
    console.log('Photo liked:', data);
    this._photoLiked.next(data);
  }

  private handlePhotoUnliked(data: PhotoLikedEvent) {
    console.log('Photo unliked:', data);
    this._photoLiked.next(data);
  }

  private handlePhotoCommented(data: PhotoCommentedEvent) {
    console.log('Photo commented:', data);
    this._photoCommented.next(data);
  }

  private handlePhotoCommentDeleted(data: { photoId: number; commentId: number; commentsCount: number }) {
    console.log('Photo comment deleted:', data);
    
    // Create a synthetic event for comment deletion
    const commentEvent: PhotoCommentedEvent = {
      photoId: data.photoId,
      comment: { id: data.commentId } as PhotoComment,
      commentsCount: data.commentsCount
    };
    
    this._photoCommented.next(commentEvent);
  }

  private handleAlbumCreated(data: any) {
    console.log('Album created:', data);
    // The album service will handle this via its API call
  }

  private handleAlbumUpdated(data: AlbumUpdatedEvent) {
    console.log('Album updated:', data);
    
    // Update album locally
    this.albumService.updateAlbumLocally(data.albumId, data.changes);
    
    // Emit event
    this._albumUpdated.next(data);
  }

  private handleAlbumDeleted(data: { albumId: number }) {
    console.log('Album deleted:', data);
    // Components should handle navigation away from deleted album
  }

  private handleAlbumStatsUpdated(data: { albumId: number; stats: any }) {
    console.log('Album stats updated:', data);
    
    this.albumService.updateAlbumLocally(data.albumId, {
      photoCount: data.stats.photoCount,
      videoCount: data.stats.videoCount,
      totalSize: data.stats.totalSize,
      lastUpdatedAt: new Date().toISOString()
    });
  }

  private handlePhotoDeleted(data: { photoId: number; albumId: number; photo: Photo }) {
    console.log('Photo deleted:', data);
    
    // Update album stats
    this.albumService.removePhotoFromAlbum(data.albumId, data.photo);
  }

  private handlePhotoUpdated(data: { photoId: number; updates: Partial<Photo> }) {
    console.log('Photo updated:', data);
    // Components should refresh photo data
  }

  private handlePhotoViewsUpdated(data: { photoId: number; viewsCount: number }) {
    console.log('Photo views updated:', data);
    // Update can be handled locally in components
  }

  // Utility methods for components
  getLatestPhotoLikedEvent(): PhotoLikedEvent | null {
    return this._photoLiked.value;
  }

  getLatestPhotoCommentedEvent(): PhotoCommentedEvent | null {
    return this._photoCommented.value;
  }

  getLatestPhotoUploadedEvent(): PhotoUploadedEvent | null {
    return this._photoUploaded.value;
  }

  getLatestAlbumUpdatedEvent(): AlbumUpdatedEvent | null {
    return this._albumUpdated.value;
  }

  // Cleanup
  cleanup() {
    console.log('Cleaning up photo realtime service');
    
    this.subscribedChannels.forEach(channel => {
      this.websocketService.unsubscribeFromChannel(channel);
    });
    
    this.subscribedChannels.clear();
    
    // Reset subjects
    this._photoLiked.next(null);
    this._photoCommented.next(null);
    this._photoUploaded.next(null);
    this._albumUpdated.next(null);
  }
}