import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonGrid, IonRow, IonCol,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonImg, IonIcon,
  IonFab, IonFabButton, IonButton, IonChip, IonText, IonSearchbar,
  IonSegment, IonSegmentButton, IonLabel, IonItem, IonList,
  IonSkeletonText, IonRefresher, IonRefresherContent, IonInfiniteScroll,
  IonInfiniteScrollContent, IonBackButton, IonButtons
} from '@ionic/angular/standalone';
import { ModalController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons/icons';
import { 
  add, image, videocam, download, eye, heart, chatbubble, 
  person, time, folder, grid, list, funnel 
} from 'ionicons/icons';
import { PhotoAlbumService } from '../../core/services/photos/photo-album.service';
import { PhotoRealtimeService } from '../../core/services/photos/photo-realtime.service';
import { AlbumResponse, AlbumSearchFilters } from '../../models/photos/photo.models';

@Component({
  selector: 'app-photo-albums',
  templateUrl: './photo-albums.page.html',
  styleUrls: ['./photo-albums.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonGrid, IonRow, IonCol,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonImg, IonIcon,
    IonFab, IonFabButton, IonButton, IonChip, IonText, IonSearchbar,
    IonSegment, IonSegmentButton, IonLabel, IonItem, IonList,
    IonSkeletonText, IonRefresher, IonRefresherContent, IonInfiniteScroll,
    IonInfiniteScrollContent, IonBackButton, IonButtons
  ]
})
export class PhotoAlbumsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private albumService = inject(PhotoAlbumService);
  private photoRealtimeService = inject(PhotoRealtimeService);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);

  familySlug = '';
  albums: AlbumResponse[] = [];
  filteredAlbums: AlbumResponse[] = [];
  loading = true;
  loadingMore = false;
  hasMoreData = true;
  currentPage = 1;
  searchTerm = '';
  selectedSegment: 'all' | 'recent' | 'mine' = 'all';
  viewMode: 'grid' | 'list' = 'grid';

  constructor() {
    addIcons({ 
      add, image, videocam, download, eye, heart, chatbubble, 
      person, time, folder, grid, list, funnel 
    });
  }

  async ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    
    // Set up real-time listeners
    this.setupRealtimeListeners();
    
    await this.loadAlbums();
  }

  ngOnDestroy() {
    // Clean up real-time listeners
    this.photoRealtimeService.unsubscribeFromFamily(this.familySlug);
  }

  private setupRealtimeListeners() {
    // Subscribe to family photo events
    this.photoRealtimeService.subscribeToFamilyPhotos(this.familySlug);

    // Listen for album updates
    this.photoRealtimeService.albumUpdated$.subscribe(event => {
      if (event) {
        console.log('Album updated:', event);
        // The album service will handle local updates automatically
      }
    });

    // Listen for photo uploads to update album stats
    this.photoRealtimeService.photoUploaded$.subscribe(event => {
      if (event) {
        console.log('Photo uploaded to album:', event.albumId);
        // Album stats are automatically updated by the service
      }
    });
  }

  async loadAlbums(refresh = false) {
    if (refresh) {
      this.currentPage = 1;
      this.hasMoreData = true;
      this.albums = [];
    }

    this.loading = refresh || this.currentPage === 1;
    this.loadingMore = !this.loading && this.currentPage > 1;

    try {
      const filters = this.buildFilters();
      
      const response = await this.albumService.getAlbums(
        this.familySlug, 
        this.currentPage, 
        filters
      ).toPromise();

      if (response) {
        if (refresh || this.currentPage === 1) {
          this.albums = response.data;
        } else {
          this.albums = [...this.albums, ...response.data];
        }

        this.hasMoreData = this.currentPage < response.lastPage;
        this.filterAlbums();
      }
    } catch (error) {
      console.error('Error loading albums:', error);
      await this.showErrorToast('Failed to load albums');
    } finally {
      this.loading = false;
      this.loadingMore = false;
    }
  }

  private buildFilters(): AlbumSearchFilters {
    const filters: AlbumSearchFilters = {
      sortBy: 'updated_at',
      sortDirection: 'desc'
    };

    if (this.searchTerm.trim()) {
      filters.search = this.searchTerm.trim();
    }

    switch (this.selectedSegment) {
      case 'recent':
        filters.sortBy = 'updated_at';
        break;
      case 'mine':
        // TODO: Add current user ID filter
        // filters.createdBy = this.currentUserId;
        break;
    }

    return filters;
  }

  onSearchChange(event: any) {
    this.searchTerm = event.detail.value || '';
    this.debounceSearch();
  }

  onSegmentChange(event: any) {
    this.selectedSegment = event.detail.value;
    this.loadAlbums(true);
  }

  filterAlbums() {
    this.filteredAlbums = this.albums;
  }

  private searchTimeout: any;
  private debounceSearch() {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadAlbums(true);
    }, 500);
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid';
  }

  async doRefresh(event: any) {
    await this.loadAlbums(true);
    event.target.complete();
  }

  async loadMore(event: any) {
    if (!this.hasMoreData || this.loadingMore) {
      event.target.complete();
      return;
    }

    this.currentPage++;
    await this.loadAlbums();
    event.target.complete();
  }

  async openCreateAlbumModal() {
    const { CreateAlbumModal } = await import('../../shared/modals/create-album/create-album.modal');
    
    const modal = await this.modalCtrl.create({
      component: CreateAlbumModal,
      componentProps: {
        familySlug: this.familySlug
      }
    });
    
    await modal.present();
    
    const { data } = await modal.onWillDismiss();
    if (data?.album) {
      // Refresh albums to show the new one
      await this.loadAlbums(true);
    }
  }

  openAlbum(album: AlbumResponse) {
    this.router.navigate(['/family', this.familySlug, 'photos', album.id]);
  }

  async showErrorToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color: 'danger'
    });
    await toast.present();
  }

  trackByAlbumId(index: number, album: AlbumResponse): number {
    return album.id;
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

  getPrivacyIcon(privacy: string): string {
    switch (privacy) {
      case 'private': return 'lock-closed';
      case 'public': return 'globe';
      case 'specific_members': return 'people';
      default: return 'home';
    }
  }

  getPrivacyColor(privacy: string): string {
    switch (privacy) {
      case 'private': return 'danger';
      case 'public': return 'success';
      case 'specific_members': return 'warning';
      default: return 'primary';
    }
  }
}