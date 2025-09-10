import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonGrid, IonRow, IonCol,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon,
  IonFab, IonFabButton, IonButton, IonChip, IonText, IonSearchbar,
  IonSegment, IonSegmentButton, IonLabel, IonItem, IonList,
  IonSkeletonText, IonRefresher, IonRefresherContent, IonInfiniteScroll,
  IonInfiniteScrollContent, IonBackButton, IonButtons, IonBadge,
  IonAvatar, IonNote, IonProgressBar, IonAlert, IonModal
} from '@ionic/angular/standalone';
import { AlertController, ToastController, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  add, star, trophy, school, home, heart, gift, airplane,
  calendar, person, time, eye, ribbon, medal, sparkles
} from 'ionicons/icons';
import { MilestoneService } from '../../core/services/memories/milestone.service';
import { 
  FamilyMilestone, MilestoneFilters, MilestoneType 
} from '../../models/memories/memory.models';

@Component({
  selector: 'app-milestones',
  templateUrl: './milestones.page.html',
  styleUrls: ['./milestones.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonGrid, IonRow, IonCol,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon,
    IonFab, IonFabButton, IonButton, IonChip, IonText, IonSearchbar,
    IonSegment, IonSegmentButton, IonLabel, IonItem, IonList,
    IonSkeletonText, IonRefresher, IonRefresherContent, IonInfiniteScroll,
    IonInfiniteScrollContent, IonBackButton, IonButtons, IonBadge,
    IonAvatar, IonNote, IonProgressBar, IonAlert, IonModal
  ]
})
export class MilestonesPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private milestoneService = inject(MilestoneService);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);

  familySlug = '';
  viewMode = signal<'all' | 'upcoming' | 'achieved'>('all');
  loading = signal(true);
  
  milestones = signal<FamilyMilestone[]>([]);
  upcomingMilestones = signal<FamilyMilestone[]>([]);
  
  // Pagination
  currentPage = signal(1);
  hasMoreData = signal(true);
  
  // Filters
  searchTerm = signal('');
  selectedTypes = signal<MilestoneType[]>([]);
  
  // Computed
  filteredMilestones = computed(() => {
    let filtered = this.milestones();
    
    if (this.searchTerm()) {
      const term = this.searchTerm().toLowerCase();
      filtered = filtered.filter(milestone => 
        milestone.title.toLowerCase().includes(term) ||
        milestone.description?.toLowerCase().includes(term)
      );
    }
    
    if (this.selectedTypes().length > 0) {
      filtered = filtered.filter(milestone => 
        this.selectedTypes().includes(milestone.type)
      );
    }
    
    // Filter by view mode
    const now = new Date();
    switch (this.viewMode()) {
      case 'upcoming':
        return filtered.filter(milestone => new Date(milestone.milestoneDate) >= now);
      case 'achieved':
        return filtered.filter(milestone => new Date(milestone.milestoneDate) < now);
      default:
        return filtered;
    }
  });

  milestoneTypes: { value: MilestoneType, label: string, icon: string, color: string }[] = [
    { value: 'birth', label: 'Birth', icon: 'heart', color: 'success' },
    { value: 'first_steps', label: 'First Steps', icon: 'walk', color: 'primary' },
    { value: 'first_words', label: 'First Words', icon: 'chatbubble', color: 'secondary' },
    { value: 'first_day_school', label: 'First Day School', icon: 'school', color: 'warning' },
    { value: 'graduation', label: 'Graduation', icon: 'school', color: 'success' },
    { value: 'first_job', label: 'First Job', icon: 'briefcase', color: 'primary' },
    { value: 'engagement', label: 'Engagement', icon: 'heart', color: 'danger' },
    { value: 'wedding', label: 'Wedding', icon: 'heart', color: 'danger' },
    { value: 'new_home', label: 'New Home', icon: 'home', color: 'medium' },
    { value: 'retirement', label: 'Retirement', icon: 'time', color: 'tertiary' },
    { value: 'achievement', label: 'Achievement', icon: 'trophy', color: 'warning' },
    { value: 'award', label: 'Award', icon: 'medal', color: 'warning' }
  ];

  constructor() {
    addIcons({ 
      add, star, trophy, school, home, heart, gift, airplane,
      calendar, person, time, eye, ribbon, medal, sparkles
    });
  }

  ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.loadData();
  }

  async loadData() {
    this.loading.set(true);
    
    try {
      await this.loadMilestones();
      await this.loadUpcomingMilestones();
    } catch (error) {
      console.error('Error loading milestones:', error);
      this.showToast('Failed to load milestones', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  async loadMilestones(refresh = false) {
    if (refresh) {
      this.currentPage.set(1);
      this.hasMoreData.set(true);
      this.milestones.set([]);
    }

    if (!this.hasMoreData()) return;

    try {
      const filters: MilestoneFilters = {
        type: this.selectedTypes().length > 0 ? this.selectedTypes() : undefined,
        sortBy: 'milestone_date',
        sortDirection: 'desc'
      };

      const response = await this.milestoneService.getMilestones(
        this.familySlug,
        this.currentPage(),
        filters
      ).toPromise();

      if (response) {
        if (refresh) {
          this.milestones.set(response.data);
        } else {
          this.milestones.update(current => [...current, ...response.data]);
        }
        
        this.hasMoreData.set(response.currentPage < response.lastPage);
        this.currentPage.update(page => page + 1);
      }
    } catch (error) {
      console.error('Error loading milestones:', error);
    }
  }

  async loadUpcomingMilestones() {
    try {
      const upcoming = await this.milestoneService.getUpcomingMilestones(this.familySlug, 90).toPromise();
      this.upcomingMilestones.set(upcoming || []);
    } catch (error) {
      console.error('Error loading upcoming milestones:', error);
    }
  }

  async onRefresh(event: any) {
    await this.loadData();
    event.target.complete();
  }

  async onLoadMore(event: any) {
    await this.loadMilestones();
    event.target.complete();
  }

  onSearchChange(event: any) {
    this.searchTerm.set(event.detail.value);
  }

  onViewModeChange(event: any) {
    this.viewMode.set(event.detail.value);
  }

  openCreateMilestone() {
    this.router.navigate(['/family', this.familySlug, 'milestones', 'create']);
  }

  openMilestoneDetail(milestone: FamilyMilestone) {
    this.router.navigate(['/family', this.familySlug, 'milestones', milestone.id]);
  }

  getMilestoneIcon(type: MilestoneType): string {
    return this.milestoneTypes.find(t => t.value === type)?.icon || 'star';
  }

  getMilestoneColor(type: MilestoneType): string {
    return this.milestoneTypes.find(t => t.value === type)?.color || 'primary';
  }

  getDaysUntilMilestone(date: string): number {
    return this.milestoneService.getDaysUntilMilestone(date);
  }

  isUpcoming(milestone: FamilyMilestone): boolean {
    return new Date(milestone.milestoneDate) >= new Date();
  }

  getTimeDisplay(milestone: FamilyMilestone): string {
    const days = this.getDaysUntilMilestone(milestone.milestoneDate);
    
    if (days > 0) {
      if (days === 1) return 'Tomorrow';
      if (days <= 7) return `In ${days} days`;
      if (days <= 30) return `In ${Math.ceil(days / 7)} weeks`;
      return `In ${Math.ceil(days / 30)} months`;
    } else if (days === 0) {
      return 'Today';
    } else {
      const absDays = Math.abs(days);
      if (absDays === 1) return 'Yesterday';
      if (absDays <= 7) return `${absDays} days ago`;
      if (absDays <= 30) return `${Math.ceil(absDays / 7)} weeks ago`;
      if (absDays <= 365) return `${Math.ceil(absDays / 30)} months ago`;
      return `${Math.ceil(absDays / 365)} years ago`;
    }
  }

  getBadge(milestone: FamilyMilestone): any {
    return this.milestoneService.generateMilestoneBadge(milestone);
  }

  async shareMilestone(milestone: FamilyMilestone) {
    const shareText = this.milestoneService.formatMilestoneForShare(milestone);
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: milestone.title,
          text: shareText
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      await navigator.clipboard.writeText(shareText);
      this.showToast('Milestone details copied to clipboard!', 'success');
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
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