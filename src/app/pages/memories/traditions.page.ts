import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent, 
  IonCardHeader, IonCardTitle, IonIcon, IonFab, IonFabButton, IonButton, 
  IonChip, IonText, IonSearchbar, IonSegment, IonSegmentButton, IonLabel, 
  IonItem, IonList, IonSkeletonText, IonRefresher, IonRefresherContent, 
  IonBackButton, IonButtons, IonBadge, IonNote, IonGrid, IonRow, IonCol,
  IonToggle, IonProgressBar
} from '@ionic/angular/standalone';
import { ToastController, AlertController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  add, refresh, calendar, flame, heart, gift, restaurant, musical_notes,
  play, pause, checkmark_circle, time, people, star
} from 'ionicons/icons';
import { TraditionService } from '../../core/services/memories/tradition.service';
import { 
  FamilyTradition, TraditionFilters, TraditionFrequency 
} from '../../models/memories/memory.models';

@Component({
  selector: 'app-traditions',
  templateUrl: './traditions.page.html',
  styleUrls: ['./traditions.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent,
    IonCardHeader, IonCardTitle, IonIcon, IonFab, IonFabButton, IonButton,
    IonChip, IonText, IonSearchbar, IonSegment, IonSegmentButton, IonLabel,
    IonItem, IonList, IonSkeletonText, IonRefresher, IonRefresherContent,
    IonBackButton, IonButtons, IonBadge, IonNote, IonGrid, IonRow, IonCol,
    IonToggle, IonProgressBar
  ]
})
export class TraditionsPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private traditionService = inject(TraditionService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);

  familySlug = '';
  viewMode = signal<'active' | 'all' | 'inactive'>('active');
  loading = signal(true);
  
  traditions = signal<FamilyTradition[]>([]);
  activeTraditions = signal<FamilyTradition[]>([]);
  
  // Pagination
  currentPage = signal(1);
  hasMoreData = signal(true);
  
  // Filters
  searchTerm = signal('');
  selectedFrequencies = signal<TraditionFrequency[]>([]);
  
  // Computed
  filteredTraditions = computed(() => {
    let filtered = this.traditions();
    
    if (this.searchTerm()) {
      const term = this.searchTerm().toLowerCase();
      filtered = filtered.filter(tradition => 
        tradition.name.toLowerCase().includes(term) ||
        tradition.description.toLowerCase().includes(term)
      );
    }
    
    if (this.selectedFrequencies().length > 0) {
      filtered = filtered.filter(tradition => 
        this.selectedFrequencies().includes(tradition.frequency)
      );
    }
    
    // Filter by view mode
    switch (this.viewMode()) {
      case 'active':
        return filtered.filter(tradition => tradition.isActive);
      case 'inactive':
        return filtered.filter(tradition => !tradition.isActive);
      default:
        return filtered;
    }
  });

  traditionFrequencies: { value: TraditionFrequency, label: string, icon: string, color: string }[] = [
    { value: 'daily', label: 'Daily', icon: 'sunny', color: 'warning' },
    { value: 'weekly', label: 'Weekly', icon: 'calendar', color: 'primary' },
    { value: 'monthly', label: 'Monthly', icon: 'calendar', color: 'secondary' },
    { value: 'yearly', label: 'Yearly', icon: 'calendar', color: 'success' },
    { value: 'seasonal', label: 'Seasonal', icon: 'leaf', color: 'tertiary' },
    { value: 'holiday', label: 'Holiday', icon: 'gift', color: 'danger' },
    { value: 'special', label: 'Special', icon: 'star', color: 'warning' }
  ];

  constructor() {
    addIcons({ 
      add, refresh, calendar, flame, heart, gift, restaurant, musical_notes,
      play, pause, checkmark_circle, time, people, star
    });
  }

  ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    
    try {
      await this.loadTraditions();
      await this.loadActiveTraditions();
    } catch (error) {
      console.error('Error loading traditions:', error);
      this.showToast('Failed to load traditions', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  async loadTraditions(refresh = false) {
    if (refresh) {
      this.currentPage.set(1);
      this.hasMoreData.set(true);
      this.traditions.set([]);
    }

    if (!this.hasMoreData()) return;

    try {
      const filters: TraditionFilters = {
        search: this.searchTerm() || undefined,
        frequency: this.selectedFrequencies().length > 0 ? this.selectedFrequencies() : undefined,
        sortBy: 'last_celebrated_at',
        sortDirection: 'desc'
      };

      const response = await this.traditionService.getTraditions(
        this.familySlug,
        this.currentPage(),
        filters
      ).toPromise();

      if (response) {
        if (refresh) {
          this.traditions.set(response.data);
        } else {
          this.traditions.update(current => [...current, ...response.data]);
        }
        
        this.hasMoreData.set(response.currentPage < response.lastPage);
        this.currentPage.update(page => page + 1);
      }
    } catch (error) {
      console.error('Error loading traditions:', error);
    }
  }

  async loadActiveTraditions() {
    try {
      const active = await this.traditionService.getActiveTraditions(this.familySlug).toPromise();
      this.activeTraditions.set(active || []);
    } catch (error) {
      console.error('Error loading active traditions:', error);
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

  async celebrateTradition(tradition: FamilyTradition) {
    const alert = await this.alertCtrl.create({
      header: 'Celebrate Tradition',
      message: `Mark "${tradition.name}" as celebrated today?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Celebrate!',
          handler: async () => {
            try {
              const updatedTradition = await this.traditionService.celebrateTradition(
                this.familySlug, 
                tradition.id.toString()
              ).toPromise();
              
              this.updateTraditionInArray(tradition.id, updatedTradition!);
              this.showToast(`🎉 ${tradition.name} celebrated!`, 'success');
            } catch (error) {
              console.error('Error celebrating tradition:', error);
              this.showToast('Failed to celebrate tradition', 'danger');
            }
          }
        }
      ]
    });
    
    await alert.present();
  }

  async toggleTraditionStatus(tradition: FamilyTradition) {
    try {
      if (tradition.isActive) {
        await this.traditionService.deactivateTradition(this.familySlug, tradition.id.toString()).toPromise();
        this.showToast(`${tradition.name} deactivated`, 'warning');
      } else {
        await this.traditionService.activateTradition(this.familySlug, tradition.id.toString()).toPromise();
        this.showToast(`${tradition.name} activated!`, 'success');
      }
      
      this.updateTraditionInArray(tradition.id, { isActive: !tradition.isActive });
    } catch (error) {
      console.error('Error toggling tradition status:', error);
      this.showToast('Failed to update tradition', 'danger');
    }
  }

  openCreateTradition() {
    this.router.navigate(['/family', this.familySlug, 'traditions', 'create']);
  }

  openTraditionDetail(tradition: FamilyTradition) {
    this.router.navigate(['/family', this.familySlug, 'traditions', tradition.id]);
  }

  getFrequencyIcon(frequency: TraditionFrequency): string {
    return this.traditionFrequencies.find(f => f.value === frequency)?.icon || 'calendar';
  }

  getFrequencyColor(frequency: TraditionFrequency): string {
    return this.traditionFrequencies.find(f => f.value === frequency)?.color || 'primary';
  }

  getDaysSinceLastCelebration(tradition: FamilyTradition): number {
    return this.traditionService.getDaysSinceLastCelebration(tradition);
  }

  needsCelebration(tradition: FamilyTradition): boolean {
    return this.traditionService.needsCelebration(tradition);
  }

  getReminder(tradition: FamilyTradition): string {
    return this.traditionService.generateReminder(tradition);
  }

  getTraditionStreak(tradition: FamilyTradition): number {
    return this.traditionService.getTraditionStreak(tradition);
  }

  formatLastCelebrated(tradition: FamilyTradition): string {
    if (!tradition.lastCelebratedAt) return 'Never celebrated';
    
    const days = this.getDaysSinceLastCelebration(tradition);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days <= 7) return `${days} days ago`;
    if (days <= 30) return `${Math.ceil(days / 7)} weeks ago`;
    if (days <= 365) return `${Math.ceil(days / 30)} months ago`;
    return `${Math.ceil(days / 365)} years ago`;
  }

  private updateTraditionInArray(traditionId: number, updates: Partial<FamilyTradition>) {
    this.traditions.update(traditions => 
      traditions.map(tradition => 
        tradition.id === traditionId ? { ...tradition, ...updates } : tradition
      )
    );
    
    this.activeTraditions.update(active => 
      active.map(tradition => 
        tradition.id === traditionId ? { ...tradition, ...updates } : tradition
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