import { Component, OnInit, inject, signal, computed, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonGrid, IonRow, IonCol,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonImg, IonIcon,
  IonFab, IonFabButton, IonButton, IonChip, IonText, IonSearchbar,
  IonSegment, IonSegmentButton, IonLabel, IonItem, IonList,
  IonSkeletonText, IonRefresher, IonRefresherContent, IonInfiniteScroll,
  IonInfiniteScrollContent, IonBackButton, IonButtons, IonBadge,
  IonAvatar, IonNote, IonModal, IonDatetime, IonPopover, IonCheckbox,
  IonSelect, IonSelectOption, IonThumbnail
} from '@ionic/angular/standalone';
import { ModalController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  add, heart, heartOutline, chatbubble, share, star, starOutline,
  calendar, filter, grid, list, image, videocam, location,
  person, time, eye, bookmark, bookmarkOutline
} from 'ionicons/icons';
import { MemoryService } from '../../core/services/memories/memory.service';
import { 
  Memory, MemoryResponse, MemoryFilters, MemoryTimelineItem, 
  MemoryType, MemoryVisibility 
} from '../../models/memories/memory.models';

@Component({
  selector: 'app-memory-timeline',
  templateUrl: './memory-timeline.page.html',
  styleUrls: ['./memory-timeline.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonGrid, IonRow, IonCol,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonImg, IonIcon,
    IonFab, IonFabButton, IonButton, IonChip, IonText, IonSearchbar,
    IonSegment, IonSegmentButton, IonLabel, IonItem, IonList,
    IonSkeletonText, IonRefresher, IonRefresherContent, IonInfiniteScroll,
    IonInfiniteScrollContent, IonBackButton, IonButtons, IonBadge,
    IonAvatar, IonNote, IonModal, IonDatetime, IonPopover, IonCheckbox,
    IonSelect, IonSelectOption, IonThumbnail
  ]
})
export class MemoryTimelinePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private memoryService = inject(MemoryService);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);

  @ViewChild(IonModal) filterModal!: IonModal;

  familySlug = '';
  viewMode = signal<'timeline' | 'grid' | 'list'>('timeline');
  loading = signal(true);
  loadingMore = signal(false);
  
  memories = signal<MemoryResponse[]>([]);
  timelineItems = signal<MemoryTimelineItem[]>([]);
  featuredMemories = signal<MemoryResponse[]>([]);
  
  // Pagination
  currentPage = signal(1);
  hasMoreData = signal(true);
  
  // Filters
  searchTerm = signal('');
  selectedYear = signal<number>(new Date().getFullYear());
  selectedTypes = signal<MemoryType[]>([]);
  dateFrom = signal('');
  dateTo = signal('');
  showFeaturedOnly = signal(false);
  
  // Computed
  filteredMemories = computed(() => {
    let filtered = this.memories();
    
    if (this.searchTerm()) {
      const term = this.searchTerm().toLowerCase();
      filtered = filtered.filter(memory => 
        memory.title.toLowerCase().includes(term) ||
        memory.description?.toLowerCase().includes(term) ||
        memory.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }
    
    if (this.selectedTypes().length > 0) {
      filtered = filtered.filter(memory => 
        this.selectedTypes().includes(memory.type)
      );
    }
    
    if (this.showFeaturedOnly()) {
      filtered = filtered.filter(memory => memory.isFeatured);
    }
    
    return filtered;
  });

  // Memory types for filter
  memoryTypes: { value: MemoryType, label: string, icon: string, color: string }[] = [
    { value: 'general', label: 'General', icon: 'bookmark', color: 'medium' },
    { value: 'milestone', label: 'Milestone', icon: 'star', color: 'warning' },
    { value: 'achievement', label: 'Achievement', icon: 'trophy', color: 'success' },
    { value: 'birthday', label: 'Birthday', icon: 'gift', color: 'tertiary' },
    { value: 'vacation', label: 'Vacation', icon: 'airplane', color: 'secondary' },
    { value: 'holiday', label: 'Holiday', icon: 'calendar', color: 'danger' },
    { value: 'funny_moment', label: 'Funny Moment', icon: 'happy', color: 'warning' },
    { value: 'first_time', label: 'First Time', icon: 'sparkles', color: 'success' }
  ];

  constructor() {
    addIcons({ 
      add, heart, heartOutline, chatbubble, share, star, starOutline,
      calendar, filter, grid, list, image, videocam, location,
      person, time, eye, bookmark, bookmarkOutline
    });
  }

  ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    
    try {
      // Load timeline view
      if (this.viewMode() === 'timeline') {
        await this.loadTimeline();
      } else {
        await this.loadMemories();
      }
      
      // Load featured memories
      await this.loadFeaturedMemories();
    } catch (error) {
      console.error('Error loading memories:', error);
      this.showToast('Failed to load memories', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  async loadTimeline() {
    try {
      const timeline = await this.memoryService.getTimeline(
        this.familySlug, 
        this.selectedYear()
      ).toPromise();
      
      this.timelineItems.set(timeline || []);
    } catch (error) {
      console.error('Error loading timeline:', error);
    }
  }

  async loadMemories(refresh = false) {
    if (refresh) {
      this.currentPage.set(1);
      this.hasMoreData.set(true);
      this.memories.set([]);
    }

    if (!this.hasMoreData()) return;

    try {
      this.loadingMore.set(true);
      
      const filters: MemoryFilters = {
        search: this.searchTerm() || undefined,
        type: this.selectedTypes().length > 0 ? this.selectedTypes() : undefined,
        dateFrom: this.dateFrom() || undefined,
        dateTo: this.dateTo() || undefined,
        isFeatured: this.showFeaturedOnly() || undefined,
        sortBy: 'memory_date',
        sortDirection: 'desc'
      };

      const response = await this.memoryService.getMemories(
        this.familySlug,
        this.currentPage(),
        filters
      ).toPromise();

      if (response) {
        if (refresh) {
          this.memories.set(response.data);
        } else {
          this.memories.update(current => [...current, ...response.data]);
        }
        
        this.hasMoreData.set(response.currentPage < response.lastPage);
        this.currentPage.update(page => page + 1);
      }
    } catch (error) {
      console.error('Error loading memories:', error);
      this.showToast('Failed to load memories', 'danger');
    } finally {
      this.loadingMore.set(false);
    }
  }

  async loadFeaturedMemories() {
    try {
      const featured = await this.memoryService.getFeaturedMemories(this.familySlug).toPromise();
      this.featuredMemories.set(featured || []);
    } catch (error) {
      console.error('Error loading featured memories:', error);
    }
  }

  async onRefresh(event: any) {
    await this.loadData();
    event.target.complete();
  }

  async onLoadMore(event: any) {
    await this.loadMemories();
    event.target.complete();
  }

  onSearchChange(event: any) {
    this.searchTerm.set(event.detail.value);
    this.loadMemories(true);
  }

  onViewModeChange(event: any) {
    this.viewMode.set(event.detail.value);
    this.loadData();
  }

  onYearChange(year: number) {
    this.selectedYear.set(year);
    if (this.viewMode() === 'timeline') {
      this.loadTimeline();
    } else {
      this.loadMemories(true);
    }
  }

  openFilterModal() {
    this.filterModal.present();
  }

  applyFilters() {
    this.filterModal.dismiss();
    this.loadMemories(true);
  }

  clearFilters() {
    this.selectedTypes.set([]);
    this.dateFrom.set('');
    this.dateTo.set('');
    this.showFeaturedOnly.set(false);
    this.searchTerm.set('');
    this.loadMemories(true);
  }

  async toggleLike(memory: MemoryResponse) {
    try {
      const result = await this.memoryService.toggleLike(
        this.familySlug,
        memory.id.toString(),
        memory.isLikedByCurrentUser || false
      ).toPromise();

      if (result) {
        // Update memory in arrays
        this.updateMemoryInArrays(memory.id, {
          isLikedByCurrentUser: result.liked,
          likesCount: result.likesCount
        });
        
        this.showToast(result.liked ? 'Memory liked!' : 'Like removed', 'success');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      this.showToast('Failed to update like', 'danger');
    }
  }

  async toggleFeature(memory: MemoryResponse) {
    if (!memory.permissions.canEdit) return;
    
    try {
      if (memory.isFeatured) {
        await this.memoryService.unfeatureMemory(this.familySlug, memory.id.toString()).toPromise();
      } else {
        await this.memoryService.featureMemory(this.familySlug, memory.id.toString()).toPromise();
      }
      
      this.updateMemoryInArrays(memory.id, {
        isFeatured: !memory.isFeatured
      });
      
      this.showToast(
        memory.isFeatured ? 'Memory unfeatured' : 'Memory featured!',
        'success'
      );
    } catch (error) {
      console.error('Error toggling feature:', error);
      this.showToast('Failed to update feature status', 'danger');
    }
  }

  openMemoryDetail(memory: MemoryResponse) {
    this.router.navigate(['/family', this.familySlug, 'memories', memory.id]);
  }

  openCreateMemory() {
    this.router.navigate(['/family', this.familySlug, 'memories', 'create']);
  }

  shareMemory(memory: MemoryResponse) {
    const shareUrl = this.memoryService.getShareUrl(this.familySlug, memory.id.toString());
    
    if (navigator.share) {
      navigator.share({
        title: memory.title,
        text: memory.description || 'Check out this family memory!',
        url: shareUrl
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl);
      this.showToast('Share link copied to clipboard!', 'success');
    }
  }

  getMemoryTypeIcon(type: MemoryType): string {
    return this.memoryTypes.find(t => t.value === type)?.icon || 'bookmark';
  }

  getMemoryTypeColor(type: MemoryType): string {
    return this.memoryTypes.find(t => t.value === type)?.color || 'medium';
  }

  getTimeAgo(date: string): string {
    const now = new Date();
    const memoryDate = new Date(date);
    const diffInDays = Math.floor((now.getTime() - memoryDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
  }

  private updateMemoryInArrays(memoryId: number, updates: Partial<MemoryResponse>) {
    // Update in memories array
    this.memories.update(memories => 
      memories.map(memory => 
        memory.id === memoryId ? { ...memory, ...updates } : memory
      )
    );
    
    // Update in featured memories array
    this.featuredMemories.update(featured => 
      featured.map(memory => 
        memory.id === memoryId ? { ...memory, ...updates } : memory
      )
    );
    
    // Update in timeline items
    this.timelineItems.update(items => 
      items.map(item => ({
        ...item,
        memories: item.memories.map(memory => 
          memory.id === memoryId ? { ...memory, ...updates } : memory
        )
      }))
    );
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}