import { Component, OnInit, OnDestroy, inject, Input, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonIcon, IonImg, IonText, IonChip, IonItem, IonLabel, IonList,
  IonTextarea, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonBadge, IonAvatar, IonActionSheet, IonAlert, IonToast, IonModal,
  IonSlides, IonFab, IonFabButton, IonRefresher, IonRefresherContent
} from '@ionic/angular/standalone';
import { ModalController, ActionSheetController, AlertController } from '@ionic/angular';
import { addIcons } from 'ionicons/icons';
import { 
  close, heart, heartOutline, chatbubble, share, download, 
  informationCircle, eye, person, calendar, location, 
  chevronBack, chevronForward, ellipsisVertical, send
} from 'ionicons/icons';
import { Swiper } from 'swiper';
import { PhotoRealtimeService } from '../../../core/services/photos/photo-realtime.service';
import { PhotoService } from '../../../core/services/photos/photo.service';
import { Subscription } from 'rxjs';
import { PhotoComment as ApiPhotoComment } from '../../../models/photos/photo.models';

export interface PhotoViewerData {
  photos: any[];
  currentIndex: number;
  albumId?: string;
  familySlug?: string;
}

export interface PhotoComment {
  id: number;
  userId: number;
  userName: string;
  userAvatar?: string;
  comment: string;
  createdAt: string;
  isEdited: boolean;
  replies?: PhotoComment[];
}

@Component({
  selector: 'app-photo-viewer',
  templateUrl: './photo-viewer.modal.html',
  styleUrls: ['./photo-viewer.modal.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonIcon, IonImg, IonText, IonChip, IonItem, IonLabel, IonList,
    IonTextarea, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonBadge, IonAvatar, IonActionSheet, IonAlert, IonToast, IonModal,
    IonSlides, IonSlide, IonFab, IonFabButton, IonRefresher, IonRefresherContent
  ]
})
export class PhotoViewerModal implements OnInit, OnDestroy {
  @Input() data!: PhotoViewerData;
  @ViewChild('slides', { static: false }) slides!: IonSlides;

  private modalCtrl = inject(ModalController);
  private actionSheetCtrl = inject(ActionSheetController);
  private alertCtrl = inject(AlertController);
  private photoRealtimeService = inject(PhotoRealtimeService);
  private photoService = inject(PhotoService);

  currentPhoto: any = null;
  currentIndex = 0;
  showDetails = false;
  showComments = false;
  comments: ApiPhotoComment[] = [];
  newComment = '';
  loading = false;
  private subscriptions: Subscription[] = [];

  constructor() {
    addIcons({ 
      close, heart, heartOutline, chatbubble, share, download, 
      informationCircle, eye, person, calendar, location, 
      chevronBack, chevronForward, ellipsisVertical, send
    });
  }

  ngOnInit() {
    if (this.data) {
      this.currentIndex = this.data.currentIndex;
      this.updateCurrentPhoto();
      this.loadComments();
      this.setupRealtimeListeners();
    }
  }

  ngOnDestroy() {
    this.cleanupSubscriptions();
    if (this.currentPhoto && this.data.familySlug) {
      this.photoRealtimeService.unsubscribeFromPhoto(this.data.familySlug, this.currentPhoto.id);
    }
  }

  private setupRealtimeListeners() {
    if (!this.currentPhoto || !this.data.familySlug) return;

    // Subscribe to photo-specific events
    this.photoRealtimeService.subscribeToPhoto(this.data.familySlug, this.currentPhoto.id);

    // Listen for photo likes
    const likesSub = this.photoRealtimeService.photoLiked$.subscribe(event => {
      if (event && event.photoId === this.currentPhoto?.id) {
        this.currentPhoto.likesCount = event.likesCount;
        this.currentPhoto.isLiked = event.isLiked;
      }
    });
    this.subscriptions.push(likesSub);

    // Listen for photo comments
    const commentsSub = this.photoRealtimeService.photoCommented$.subscribe(event => {
      if (event && event.photoId === this.currentPhoto?.id) {
        this.currentPhoto.commentsCount = event.commentsCount;
        // Reload comments to show new comment
        this.loadComments();
      }
    });
    this.subscriptions.push(commentsSub);

    // Listen for comment deletions
    const commentDeletedSub = this.photoRealtimeService.photoCommentDeleted$.subscribe(event => {
      if (event && event.photoId === this.currentPhoto?.id) {
        this.currentPhoto.commentsCount = event.commentsCount;
        // Remove the deleted comment from the list
        this.comments = this.comments.filter(c => c.id !== event.commentId);
      }
    });
    this.subscriptions.push(commentDeletedSub);
  }

  private cleanupSubscriptions() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  private updateRealtimeSubscription() {
    // Clean up previous subscriptions
    this.cleanupSubscriptions();
    if (this.currentPhoto && this.data.familySlug) {
      this.photoRealtimeService.unsubscribeFromPhoto(this.data.familySlug, this.currentPhoto.id);
    }
    
    // Set up new subscriptions for current photo
    this.setupRealtimeListeners();
  }

  updateCurrentPhoto() {
    if (this.data.photos && this.data.photos[this.currentIndex]) {
      this.currentPhoto = this.data.photos[this.currentIndex];
      this.incrementViews();
      this.updateRealtimeSubscription();
    }
  }

  async onSlideChange() {
    if (this.slides) {
      this.currentIndex = await this.slides.getActiveIndex();
      this.updateCurrentPhoto();
      this.loadComments();
    }
  }

  goToPrevious() {
    if (this.currentIndex > 0) {
      this.slides?.slidePrev();
    }
  }

  goToNext() {
    if (this.currentIndex < this.data.photos.length - 1) {
      this.slides?.slideNext();
    }
  }

  toggleDetails() {
    this.showDetails = !this.showDetails;
  }

  toggleComments() {
    this.showComments = !this.showComments;
    if (this.showComments && this.comments.length === 0) {
      this.loadComments();
    }
  }

  async toggleLike() {
    if (!this.currentPhoto || !this.data.familySlug) return;

    const originalLiked = this.currentPhoto.isLiked;
    const originalCount = this.currentPhoto.likesCount;

    try {
      // Optimistic update
      this.currentPhoto.isLiked = !this.currentPhoto.isLiked;
      if (this.currentPhoto.isLiked) {
        this.currentPhoto.likesCount++;
      } else {
        this.currentPhoto.likesCount--;
      }

      // Call API to like/unlike photo
      await this.photoService.toggleLike(this.data.familySlug, this.currentPhoto.id, originalLiked).toPromise();
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert on error
      this.currentPhoto.isLiked = originalLiked;
      this.currentPhoto.likesCount = originalCount;
    }
  }

  async loadComments() {
    if (!this.currentPhoto || !this.data.familySlug) return;

    this.loading = true;
    try {
      const response = await this.photoService.getComments(
        this.data.familySlug, 
        this.currentPhoto.id
      ).toPromise();
      
      this.comments = response?.data || [];
    } catch (error) {
      console.error('Error loading comments:', error);
      // Fallback to empty comments
      this.comments = [];
    } finally {
      this.loading = false;
    }
  }

  async addComment() {
    if (!this.newComment.trim() || !this.currentPhoto || !this.data.familySlug) return;

    const commentText = this.newComment.trim();
    this.newComment = '';

    try {
      const response = await this.photoService.addComment(
        this.data.familySlug,
        this.currentPhoto.id,
        { comment: commentText }
      ).toPromise();
      
      if (response) {
        // The real-time listener will handle updating the UI
        // But we can optimistically add the comment
        this.comments.unshift(response);
        this.currentPhoto.commentsCount++;
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      // Restore the comment text on error
      this.newComment = commentText;
    }
  }

  async presentMoreActions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Photo Actions',
      buttons: [
        {
          text: 'Download',
          icon: 'download',
          handler: () => this.downloadPhoto()
        },
        {
          text: 'Share',
          icon: 'share',
          handler: () => this.sharePhoto()
        },
        {
          text: 'Add to Favorites',
          icon: 'heart',
          handler: () => this.addToFavorites()
        },
        {
          text: 'Report',
          icon: 'flag',
          handler: () => this.reportPhoto()
        },
        {
          text: 'Cancel',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  downloadPhoto() {
    if (!this.currentPhoto) return;
    
    // TODO: Implement download
    console.log('Download photo:', this.currentPhoto.id);
  }

  sharePhoto() {
    if (!this.currentPhoto) return;
    
    // TODO: Implement sharing
    console.log('Share photo:', this.currentPhoto.id);
  }

  addToFavorites() {
    if (!this.currentPhoto) return;
    
    this.currentPhoto.isFavorite = !this.currentPhoto.isFavorite;
    // TODO: Call API to toggle favorite
  }

  reportPhoto() {
    console.log('Report photo:', this.currentPhoto?.id);
  }

  incrementViews() {
    if (!this.currentPhoto || !this.data.familySlug) return;
    
    // Optimistically increment views
    this.currentPhoto.viewsCount++;
    
    // Call API to increment views (fire and forget)
    this.photoService.incrementViews(this.data.familySlug, this.currentPhoto.id)
      .toPromise()
      .catch(error => {
        console.error('Error incrementing views:', error);
        // Revert on error
        this.currentPhoto.viewsCount--;
      });
  }

  dismiss() {
    this.modalCtrl.dismiss();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return 'Unknown size';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}