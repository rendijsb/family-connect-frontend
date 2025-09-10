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
    this.websocketService.connectionState$.subscribe(status => {
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
    
    this.websocketService.joinPrivateChannel(channelName).then(channel => {
      channel.listen('photo.uploaded', (data: any) => this.handleFamilyPhotoEvent({ type: 'photo.uploaded', data }));
      channel.listen('album.created', (data: any) => this.handleFamilyPhotoEvent({ type: 'album.created', data }));
      channel.listen('album.updated', (data: any) => this.handleFamilyPhotoEvent({ type: 'album.updated', data }));
      channel.listen('album.deleted', (data: any) => this.handleFamilyPhotoEvent({ type: 'album.deleted', data }));
    }).catch(error => {
      console.error('Failed to subscribe to family photos channel:', error);
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
    
    this.websocketService.joinPrivateChannel(channelName).then(channel => {
      channel.listen('photo.uploaded', (data: any) => this.handleAlbumEvent({ type: 'photo.uploaded', data }));
      channel.listen('photo.deleted', (data: any) => this.handleAlbumEvent({ type: 'photo.deleted', data }));
      channel.listen('album.updated', (data: any) => this.handleAlbumEvent({ type: 'album.updated', data }));
      channel.listen('album.stats.updated', (data: any) => this.handleAlbumEvent({ type: 'album.stats.updated', data }));
    }).catch(error => {
      console.error('Failed to subscribe to album channel:', error);
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
    
    this.websocketService.joinPrivateChannel(channelName).then(channel => {
      channel.listen('photo.liked', (data: any) => this.handlePhotoEvent({ type: 'photo.liked', data }));
      channel.listen('photo.unliked', (data: any) => this.handlePhotoEvent({ type: 'photo.unliked', data }));
      channel.listen('photo.commented', (data: any) => this.handlePhotoEvent({ type: 'photo.commented', data }));
      channel.listen('photo.comment.deleted', (data: any) => this.handlePhotoEvent({ type: 'photo.comment.deleted', data }));
      channel.listen('photo.updated', (data: any) => this.handlePhotoEvent({ type: 'photo.updated', data }));
      channel.listen('photo.views.updated', (data: any) => this.handlePhotoEvent({ type: 'photo.views.updated', data }));
    }).catch(error => {
      console.error('Failed to subscribe to photo channel:', error);
    });

    this.subscribedChannels.add(channelName);
  }

  // Unsubscribe from channels
  unsubscribeFromFamily(familySlug: string) {
    const channelName = `family.${familySlug}.photos`;
    this.websocketService.leaveChannel(channelName);
    this.subscribedChannels.delete(channelName);
  }

  unsubscribeFromAlbum(familySlug: string, albumId: string) {
    const channelName = `family.${familySlug}.album.${albumId}`;
    this.websocketService.leaveChannel(channelName);
    this.subscribedChannels.delete(channelName);
  }

  unsubscribeFromPhoto(familySlug: string, photoId: string) {
    const channelName = `family.${familySlug}.photo.${photoId}`;
    this.websocketService.leaveChannel(channelName);
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
      this.websocketService.leaveChannel(channel);
    });
    
    this.subscribedChannels.clear();
    
    // Reset subjects
    this._photoLiked.next(null);
    this._photoCommented.next(null);
    this._photoUploaded.next(null);
    this._albumUpdated.next(null);
  }
}