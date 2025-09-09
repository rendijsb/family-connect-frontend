import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonGrid, IonRow, IonCol,
  IonCard, IonCardContent, IonImg, IonIcon, IonFab, IonFabButton, 
  IonButton, IonChip, IonText, IonSearchbar, IonCheckbox, IonItem,
  IonSkeletonText, IonRefresher, IonRefresherContent, IonInfiniteScroll,
  IonInfiniteScrollContent, IonBackButton, IonButtons, IonBadge,
  IonActionSheet, IonAlert, IonToast, IonModal, IonLabel
} from '@ionic/angular/standalone';
import { ActionSheetController, AlertController, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons/icons';
import { 
  add, image, videocam, download, eye, heart, chatbubble, 
  person, time, folder, grid, list, funnel, ellipsisVertical,
  cloudUpload, checkboxOutline, checkbox, close, share, trash
} from 'ionicons/icons';
import { PhotoRealtimeService } from '../../core/services/photos/photo-realtime.service';
import { PhotoService } from '../../core/services/photos/photo.service';

export interface Photo {
  id: number;
  filename: string;
  originalName: string;
  path: string;
  thumbnailPath?: string;
  size: number;
  width?: number;
  height?: number;
  description?: string;
  tags?: string[];
  location?: string;
  takenAt?: string;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  isFavorite: boolean;
  uploadedBy: {
    id: number;
    name: string;
    avatar?: string;
  };
  createdAt: string;
}

@Component({
  selector: 'app-album-detail',
  templateUrl: './album-detail.page.html',
  styleUrls: ['./album-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonGrid, IonRow, IonCol,
    IonCard, IonCardContent, IonImg, IonIcon, IonFab, IonFabButton, 
    IonButton, IonChip, IonText, IonSearchbar, IonCheckbox, IonItem,
    IonSkeletonText, IonRefresher, IonRefresherContent, IonInfiniteScroll,
    IonInfiniteScrollContent, IonBackButton, IonButtons, IonBadge,
    IonActionSheet, IonAlert, IonToast, IonModal, IonLabel
  ]
})
export class AlbumDetailPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private actionSheetCtrl = inject(ActionSheetController);
  private alertCtrl = inject(AlertController);
  private modalCtrl = inject(ModalController);
  private photoRealtimeService = inject(PhotoRealtimeService);
  private photoService = inject(PhotoService);

  familySlug = '';
  albumId = '';
  album: any = null;
  photos: Photo[] = [];
  filteredPhotos: Photo[] = [];
  loading = true;
  searchTerm = '';
  selectionMode = false;
  selectedPhotos: Set<number> = new Set();

  constructor() {
    addIcons({ 
      add, image, videocam, download, eye, heart, chatbubble, 
      person, time, folder, grid, list, funnel, ellipsisVertical,
      cloudUpload, checkboxOutline, checkbox, close, share, trash
    });
  }

  async ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.albumId = this.route.snapshot.paramMap.get('albumId') || '';
    
    // Set up real-time listeners
    this.setupRealtimeListeners();
    
    await this.loadAlbumData();
  }

  ngOnDestroy() {
    // Clean up real-time listeners
    this.photoRealtimeService.unsubscribeFromAlbum(this.familySlug, this.albumId);
  }

  private setupRealtimeListeners() {
    // Subscribe to album events
    this.photoRealtimeService.subscribeToAlbum(this.familySlug, this.albumId);

    // Listen for photo uploads
    this.photoRealtimeService.photoUploaded$.subscribe(event => {
      if (event && event.albumId.toString() === this.albumId) {
        console.log('New photo uploaded:', event.photo);
        // Add the new photo to the current photos array
        this.photos.unshift(event.photo);
        this.filterPhotos();
      }
    });

    // Listen for photo likes
    this.photoRealtimeService.photoLiked$.subscribe(event => {
      if (event) {
        const photo = this.photos.find(p => p.id === event.photoId);
        if (photo) {
          photo.likesCount = event.likesCount;
          photo.isLikedByCurrentUser = event.liked;
        }
      }
    });

    // Listen for photo comments
    this.photoRealtimeService.photoCommented$.subscribe(event => {
      if (event) {
        const photo = this.photos.find(p => p.id === event.photoId);
        if (photo) {
          photo.commentsCount = event.commentsCount;
        }
      }
    });
  }

  async loadAlbumData() {
    this.loading = true;
    try {
      // TODO: Replace with actual API calls
      // const [album, photos] = await Promise.all([
      //   this.photoService.getAlbum(this.familySlug, this.albumId),
      //   this.photoService.getPhotos(this.familySlug, this.albumId)
      // ]);
      
      // Mock data for now
      this.album = {
        id: 1,
        name: 'Summer Vacation 2024',
        description: 'Our amazing family trip to the beach',
        privacy: 'family',
        photoCount: 42,
        videoCount: 5,
        totalSize: 125000000,
        createdBy: { id: 1, name: 'John Doe', avatar: '/assets/avatar.jpg' }
      };

      this.photos = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        filename: `photo-${i + 1}.jpg`,
        originalName: `IMG_${1000 + i}.jpg`,
        path: `/assets/sample-photo-${(i % 3) + 1}.jpg`,
        thumbnailPath: `/assets/sample-photo-${(i % 3) + 1}.jpg`,
        size: Math.floor(Math.random() * 5000000) + 1000000,
        width: 1920,
        height: 1080,
        description: i % 4 === 0 ? `Beautiful sunset photo ${i + 1}` : undefined,
        tags: i % 3 === 0 ? ['sunset', 'beach', 'vacation'] : undefined,
        location: i % 5 === 0 ? 'Miami Beach, FL' : undefined,
        takenAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        viewsCount: Math.floor(Math.random() * 100),
        likesCount: Math.floor(Math.random() * 20),
        commentsCount: Math.floor(Math.random() * 10),
        isFavorite: Math.random() > 0.7,
        uploadedBy: {
          id: Math.floor(Math.random() * 3) + 1,
          name: ['John Doe', 'Jane Smith', 'Bob Johnson'][Math.floor(Math.random() * 3)]
        },
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
      }));
      
      this.filterPhotos();
    } catch (error) {
      console.error('Error loading album data:', error);
    } finally {
      this.loading = false;
    }
  }

  onSearchChange(event: any) {
    this.searchTerm = event.detail.value || '';
    this.filterPhotos();
  }

  filterPhotos() {
    let filtered = [...this.photos];

    if (this.searchTerm.trim()) {
      filtered = filtered.filter(photo => 
        photo.originalName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        photo.description?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        photo.tags?.some(tag => tag.toLowerCase().includes(this.searchTerm.toLowerCase()))
      );
    }

    this.filteredPhotos = filtered;
  }

  toggleSelectionMode() {
    this.selectionMode = !this.selectionMode;
    if (!this.selectionMode) {
      this.selectedPhotos.clear();
    }
  }

  togglePhotoSelection(photo: Photo) {
    if (this.selectedPhotos.has(photo.id)) {
      this.selectedPhotos.delete(photo.id);
    } else {
      this.selectedPhotos.add(photo.id);
    }
  }

  selectAllPhotos() {
    this.filteredPhotos.forEach(photo => this.selectedPhotos.add(photo.id));
  }

  deselectAllPhotos() {
    this.selectedPhotos.clear();
  }

  async openPhoto(photo: Photo, index: number) {
    if (this.selectionMode) {
      this.togglePhotoSelection(photo);
      return;
    }

    const { PhotoViewerModal } = await import('../../shared/modals/photo-viewer/photo-viewer.modal');
    
    const modal = await this.modalCtrl.create({
      component: PhotoViewerModal,
      componentProps: {
        data: {
          photos: this.filteredPhotos,
          currentIndex: index,
          albumId: this.albumId,
          familySlug: this.familySlug
        }
      }
    });
    
    await modal.present();
  }

  async presentPhotoActionSheet(photo: Photo, event: Event) {
    event.stopPropagation();
    
    const actionSheet = await this.actionSheetCtrl.create({
      header: photo.originalName,
      buttons: [
        {
          text: 'View Details',
          icon: 'information-circle',
          handler: () => this.viewPhotoDetails(photo)
        },
        {
          text: 'Download',
          icon: 'download',
          handler: () => this.downloadPhoto(photo)
        },
        {
          text: 'Share',
          icon: 'share',
          handler: () => this.sharePhoto(photo)
        },
        {
          text: photo.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
          icon: photo.isFavorite ? 'heart' : 'heart-outline',
          handler: () => this.toggleFavorite(photo)
        },
        {
          text: 'Delete',
          icon: 'trash',
          role: 'destructive',
          handler: () => this.deletePhoto(photo)
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

  async presentBulkActions() {
    if (this.selectedPhotos.size === 0) return;

    const actionSheet = await this.actionSheetCtrl.create({
      header: `${this.selectedPhotos.size} photos selected`,
      buttons: [
        {
          text: 'Download Selected',
          icon: 'download',
          handler: () => this.downloadSelectedPhotos()
        },
        {
          text: 'Add to Favorites',
          icon: 'heart',
          handler: () => this.addSelectedToFavorites()
        },
        {
          text: 'Move to Album',
          icon: 'folder',
          handler: () => this.moveSelectedPhotos()
        },
        {
          text: 'Delete Selected',
          icon: 'trash',
          role: 'destructive',
          handler: () => this.deleteSelectedPhotos()
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

  async doRefresh(event: any) {
    await this.loadAlbumData();
    event.target.complete();
  }

  async openUploadModal() {
    const { PhotoUploadModal } = await import('../../shared/modals/photo-upload/photo-upload.modal');
    
    const modal = await this.modalCtrl.create({
      component: PhotoUploadModal,
      componentProps: {
        familySlug: this.familySlug,
        albumId: this.albumId,
        albumName: this.album?.name
      }
    });
    
    await modal.present();
    
    const { data } = await modal.onWillDismiss();
    if (data?.uploaded) {
      // Refresh photos to show new uploads
      await this.loadAlbumData();
    }
  }

  // Action handlers
  viewPhotoDetails(photo: Photo) {
    console.log('View details for:', photo.id);
  }

  downloadPhoto(photo: Photo) {
    console.log('Download photo:', photo.id);
  }

  sharePhoto(photo: Photo) {
    console.log('Share photo:', photo.id);
  }

  toggleFavorite(photo: Photo) {
    photo.isFavorite = !photo.isFavorite;
    console.log('Toggle favorite for:', photo.id);
  }

  async deletePhoto(photo: Photo) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Photo',
      message: `Are you sure you want to delete "${photo.originalName}"?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { 
          text: 'Delete', 
          role: 'destructive',
          handler: () => {
            console.log('Delete photo:', photo.id);
            // TODO: Implement delete
          }
        }
      ]
    });

    await alert.present();
  }

  downloadSelectedPhotos() {
    console.log('Download selected photos:', Array.from(this.selectedPhotos));
  }

  addSelectedToFavorites() {
    console.log('Add to favorites:', Array.from(this.selectedPhotos));
  }

  moveSelectedPhotos() {
    console.log('Move photos:', Array.from(this.selectedPhotos));
  }

  async deleteSelectedPhotos() {
    const alert = await this.alertCtrl.create({
      header: 'Delete Photos',
      message: `Are you sure you want to delete ${this.selectedPhotos.size} photos?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { 
          text: 'Delete', 
          role: 'destructive',
          handler: () => {
            console.log('Delete photos:', Array.from(this.selectedPhotos));
            // TODO: Implement bulk delete
          }
        }
      ]
    });

    await alert.present();
  }

  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  async loadMore(event: any) {
    // TODO: Implement infinite scroll for photos
    event.target.complete();
  }

  trackByPhotoId(index: number, photo: Photo): number {
    return photo.id;
  }
}