import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent, 
  IonCardHeader, IonCardTitle, IonIcon, IonFab, IonFabButton, IonButton, 
  IonChip, IonText, IonSearchbar, IonSegment, IonSegmentButton, IonLabel, 
  IonSkeletonText, IonRefresher, IonRefresherContent, IonBackButton, 
  IonButtons, IonBadge, IonNote, IonProgressBar, IonModal, IonItem, IonList,
  IonAvatar
} from '@ionic/angular/standalone';
import { ToastController, AlertController, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  add, lock_closed, lock_open, time, gift, document, image, 
  videocam, musical_notes, people, calendar, star, archive
} from 'ionicons/icons';
import { TimeCapsuleService } from '../../core/services/memories/time-capsule.service';
import { 
  FamilyTimeCapsule, TimeCapsuleFilters, AddTimeCapsuleContentRequest
} from '../../models/memories/memory.models';

@Component({
  selector: 'app-time-capsule',
  templateUrl: './time-capsule.page.html',
  styleUrls: ['./time-capsule.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent,
    IonCardHeader, IonCardTitle, IonIcon, IonFab, IonFabButton, IonButton,
    IonChip, IonText, IonSearchbar, IonSegment, IonSegmentButton, IonLabel,
    IonSkeletonText, IonRefresher, IonRefresherContent, IonBackButton,
    IonButtons, IonBadge, IonNote, IonProgressBar, IonModal, IonItem, IonList,
    IonAvatar
  ]
})
export class TimeCapsulePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private timeCapsuleService = inject(TimeCapsuleService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private modalCtrl = inject(ModalController);

  familySlug = '';
  viewMode = signal<'all' | 'sealed' | 'opened' | 'ready'>('all');
  loading = signal(true);
  
  timeCapsules = signal<FamilyTimeCapsule[]>([]);
  sealedCapsules = signal<FamilyTimeCapsule[]>([]);
  readyToOpen = signal<FamilyTimeCapsule[]>([]);
  
  // Pagination
  currentPage = signal(1);
  hasMoreData = signal(true);
  
  // Filters
  searchTerm = signal('');
  
  // Computed
  filteredTimeCapsules = computed(() => {
    let filtered = this.timeCapsules();
    
    if (this.searchTerm()) {
      const term = this.searchTerm().toLowerCase();
      filtered = filtered.filter(capsule => 
        capsule.title.toLowerCase().includes(term) ||
        capsule.description?.toLowerCase().includes(term)
      );
    }
    
    // Filter by view mode
    switch (this.viewMode()) {
      case 'sealed':
        return filtered.filter(capsule => !capsule.isOpened);
      case 'opened':
        return filtered.filter(capsule => capsule.isOpened);
      case 'ready':
        return filtered.filter(capsule => this.canBeOpened(capsule));
      default:
        return filtered;
    }
  });

  constructor() {
    addIcons({ 
      add, lock_closed, lock_open, time, gift, document, image, 
      videocam, musical_notes, people, calendar, star, archive
    });
  }

  ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    
    try {
      await this.loadTimeCapsules();
      await this.loadSealedCapsules();
      await this.loadReadyToOpen();
    } catch (error) {
      console.error('Error loading time capsules:', error);
      this.showToast('Failed to load time capsules', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  async loadTimeCapsules(refresh = false) {
    if (refresh) {
      this.currentPage.set(1);
      this.hasMoreData.set(true);
      this.timeCapsules.set([]);
    }

    if (!this.hasMoreData()) return;

    try {
      const filters: TimeCapsuleFilters = {
        sortBy: 'opens_at',
        sortDirection: 'asc'
      };

      const response = await this.timeCapsuleService.getTimeCapsules(
        this.familySlug,
        this.currentPage(),
        filters
      ).toPromise();

      if (response) {
        if (refresh) {
          this.timeCapsules.set(response.data);
        } else {
          this.timeCapsules.update(current => [...current, ...response.data]);
        }
        
        this.hasMoreData.set(response.currentPage < response.lastPage);
        this.currentPage.update(page => page + 1);
      }
    } catch (error) {
      console.error('Error loading time capsules:', error);
    }
  }

  async loadSealedCapsules() {
    try {
      const sealed = await this.timeCapsuleService.getSealedTimeCapsules(this.familySlug).toPromise();
      this.sealedCapsules.set(sealed || []);
    } catch (error) {
      console.error('Error loading sealed capsules:', error);
    }
  }

  async loadReadyToOpen() {
    try {
      const ready = await this.timeCapsuleService.getReadyToOpenTimeCapsules(this.familySlug).toPromise();
      this.readyToOpen.set(ready || []);
    } catch (error) {
      console.error('Error loading ready to open capsules:', error);
    }
  }

  async onRefresh(event: any) {
    await this.loadData();
    event.target.complete();
  }

  onSearchChange(event: any) {
    this.searchTerm.set(event.detail.value);
  }

  onViewModeChange(event: any) {
    this.viewMode.set(event.detail.value);
  }

  async openTimeCapsule(capsule: FamilyTimeCapsule) {
    if (!this.canBeOpened(capsule)) {
      this.showToast('This time capsule cannot be opened yet', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Open Time Capsule',
      message: `Are you ready to open "${capsule.title}"? This cannot be undone!`,
      buttons: [
        { text: 'Not Yet', role: 'cancel' },
        {
          text: 'Open It!',
          handler: async () => {
            try {
              const openedCapsule = await this.timeCapsuleService.openTimeCapsule(
                this.familySlug, 
                capsule.id.toString()
              ).toPromise();
              
              this.updateCapsuleInArray(capsule.id, openedCapsule!);
              this.showToast('🎉 Time capsule opened!', 'success');
              this.openCapsuleDetail(openedCapsule!);
            } catch (error) {
              console.error('Error opening time capsule:', error);
              this.showToast('Failed to open time capsule', 'danger');
            }
          }
        }
      ]
    });
    
    await alert.present();
  }

  async contributeToTimeCapsule(capsule: FamilyTimeCapsule) {
    if (capsule.isOpened) {
      this.showToast('Cannot contribute to an opened time capsule', 'warning');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Add to Time Capsule',
      message: 'What would you like to add?',
      inputs: [
        {
          name: 'message',
          type: 'textarea',
          placeholder: 'Write a message for the future...'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Add Message',
          handler: async (data) => {
            if (data.message) {
              try {
                const contentData: AddTimeCapsuleContentRequest = {
                  type: 'message',
                  content: data.message
                };
                
                await this.timeCapsuleService.addContent(
                  this.familySlug, 
                  capsule.id.toString(), 
                  contentData
                ).toPromise();
                
                this.showToast('Message added to time capsule!', 'success');
                this.loadData(); // Refresh to show updated contributor count
              } catch (error) {
                console.error('Error adding content:', error);
                this.showToast('Failed to add content', 'danger');
              }
            }
          }
        }
      ]
    });
    
    await alert.present();
  }

  openCreateTimeCapsule() {
    this.router.navigate(['/family', this.familySlug, 'time-capsules', 'create']);
  }

  openCapsuleDetail(capsule: FamilyTimeCapsule) {
    this.router.navigate(['/family', this.familySlug, 'time-capsules', capsule.id]);
  }

  getDaysUntilOpening(capsule: FamilyTimeCapsule): number {
    return this.timeCapsuleService.getDaysUntilOpening(capsule);
  }

  canBeOpened(capsule: FamilyTimeCapsule): boolean {
    return this.timeCapsuleService.canBeOpened(capsule);
  }

  isOpeningSoon(capsule: FamilyTimeCapsule): boolean {
    return this.timeCapsuleService.isOpeningSoon(capsule);
  }

  getOpeningNotification(capsule: FamilyTimeCapsule): string {
    return this.timeCapsuleService.generateOpeningNotification(capsule);
  }

  formatTimeUntilOpening(capsule: FamilyTimeCapsule): string {
    return this.timeCapsuleService.formatTimeUntilOpening(capsule);
  }

  getProgressPercentage(capsule: FamilyTimeCapsule): number {
    if (capsule.isOpened) return 100;
    
    const totalTime = new Date(capsule.opensAt).getTime() - new Date(capsule.sealedAt).getTime();
    const elapsed = new Date().getTime() - new Date(capsule.sealedAt).getTime();
    
    return Math.min(100, Math.max(0, (elapsed / totalTime) * 100));
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
  }

  formatDateTime(date: string): string {
    return new Date(date).toLocaleString();
  }

  private updateCapsuleInArray(capsuleId: number, updates: Partial<FamilyTimeCapsule>) {
    this.timeCapsules.update(capsules => 
      capsules.map(capsule => 
        capsule.id === capsuleId ? { ...capsule, ...updates } : capsule
      )
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