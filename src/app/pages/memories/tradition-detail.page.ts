import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonBackButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonIcon, IonChip, IonText, IonItem, IonList, IonAvatar, IonLabel,
  IonNote, IonTextarea, IonModal, IonFab, IonFabButton, IonImg,
  IonGrid, IonRow, IonCol, IonBadge, IonSpinner
} from '@ionic/angular/standalone';
import { ToastController, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  heart, heartOutline, chatbubble, share, star, starOutline,
  calendar, person, location, tag, eye, bookmark, edit, trash,
  add, send, close, refresh, repeat, time, calendarOutline
} from 'ionicons/icons';
import { TraditionService } from '../../core/services/memories/tradition.service';
import { 
  TraditionResponse, TraditionComment, CreateTraditionCommentRequest,
  TraditionOccurrence 
} from '../../models/memories/memory.models';

@Component({
  selector: 'app-tradition-detail',
  templateUrl: './tradition-detail.page.html',
  styleUrls: ['./tradition-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonBackButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonIcon, IonChip, IonText, IonItem, IonList, IonAvatar, IonLabel,
    IonNote, IonTextarea, IonModal, IonFab, IonFabButton, IonImg,
    IonGrid, IonRow, IonCol, IonBadge, IonSpinner
  ]
})
export class TraditionDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private traditionService = inject(TraditionService);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);

  familySlug = '';
  traditionId = '';
  
  tradition = signal<TraditionResponse | null>(null);
  comments = signal<TraditionComment[]>([]);
  occurrences = signal<TraditionOccurrence[]>([]);
  loading = signal(true);
  commentsLoading = signal(false);
  occurrencesLoading = signal(false);
  
  // Comment form
  newComment = signal('');
  replyToComment = signal<TraditionComment | null>(null);
  
  // Media viewer
  currentMediaIndex = signal(0);
  showMediaViewer = signal(false);

  // Tab selection
  selectedTab = signal<'overview' | 'occurrences' | 'comments'>('overview');

  // Next occurrence computation
  nextOccurrence = computed(() => {
    const occs = this.occurrences();
    const now = new Date();
    return occs
      .filter(occ => new Date(occ.scheduledDate) > now)
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())[0];
  });

  constructor() {
    addIcons({ 
      heart, heartOutline, chatbubble, share, star, starOutline,
      calendar, person, location, tag, eye, bookmark, edit, trash,
      add, send, close, refresh, repeat, time, calendarOutline
    });
  }

  ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.traditionId = this.route.snapshot.paramMap.get('traditionId') || '';
    this.loadTradition();
    this.loadComments();
    this.loadOccurrences();
  }

  async loadTradition() {
    this.loading.set(true);
    
    try {
      const tradition = await this.traditionService.getTradition(this.familySlug, this.traditionId).toPromise();
      if (tradition) {
        this.tradition.set(tradition);
        
        // Increment view count
        await this.traditionService.incrementViews?.(this.familySlug, this.traditionId).toPromise();
      }
    } catch (error) {
      console.error('Error loading tradition:', error);
      this.showToast('Failed to load tradition', 'danger');
      this.router.navigate(['/family', this.familySlug, 'memories', 'traditions']);
    } finally {
      this.loading.set(false);
    }
  }

  async loadComments() {
    this.commentsLoading.set(true);
    
    try {
      const response = await this.traditionService.getComments(this.familySlug, this.traditionId).toPromise();
      if (response) {
        this.comments.set(response.data);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      this.commentsLoading.set(false);
    }
  }

  async loadOccurrences() {
    this.occurrencesLoading.set(true);
    
    try {
      const response = await this.traditionService.getOccurrences(this.familySlug, this.traditionId).toPromise();
      if (response) {
        this.occurrences.set(response.data);
      }
    } catch (error) {
      console.error('Error loading occurrences:', error);
    } finally {
      this.occurrencesLoading.set(false);
    }
  }

  async toggleLike() {
    const tradition = this.tradition();
    if (!tradition) return;

    try {
      const result = await this.traditionService.toggleLike(
        this.familySlug,
        this.traditionId,
        tradition.isLikedByCurrentUser || false
      ).toPromise();

      if (result) {
        this.tradition.update(t => t ? {
          ...t,
          isLikedByCurrentUser: result.liked,
          likesCount: result.likesCount
        } : null);
        
        this.showToast(result.liked ? 'Tradition liked!' : 'Like removed', 'success');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      this.showToast('Failed to update like', 'danger');
    }
  }

  async recordOccurrence() {
    const tradition = this.tradition();
    if (!tradition || !tradition.permissions.canEdit) return;

    try {
      const occurrence = await this.traditionService.recordOccurrence(
        this.familySlug,
        this.traditionId,
        { notes: '', media: [] }
      ).toPromise();
      
      if (occurrence) {
        this.occurrences.update(occs => [occurrence, ...occs]);
        this.tradition.update(t => t ? {
          ...t,
          totalOccurrences: t.totalOccurrences + 1,
          lastOccurrence: occurrence.actualDate
        } : null);
        
        this.showToast('Occurrence recorded!', 'success');
      }
    } catch (error) {
      console.error('Error recording occurrence:', error);
      this.showToast('Failed to record occurrence', 'danger');
    }
  }

  async shareTradition() {
    const tradition = this.tradition();
    if (!tradition) return;

    const shareUrl = this.traditionService.getShareUrl(this.familySlug, this.traditionId);
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: tradition.title,
          text: tradition.description || 'Check out this family tradition!',
          url: shareUrl
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      this.showToast('Share link copied to clipboard!', 'success');
    }
  }

  async addComment() {
    const content = this.newComment().trim();
    if (!content) return;

    try {
      const commentData: CreateTraditionCommentRequest = {
        content,
        parentId: this.replyToComment()?.id
      };

      const comment = await this.traditionService.addComment(
        this.familySlug,
        this.traditionId,
        commentData
      ).toPromise();

      if (comment) {
        this.comments.update(comments => [...comments, comment]);
        this.tradition.update(t => t ? {
          ...t,
          commentsCount: t.commentsCount + 1
        } : null);
        
        this.newComment.set('');
        this.replyToComment.set(null);
        this.showToast('Comment added!', 'success');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      this.showToast('Failed to add comment', 'danger');
    }
  }

  replyToCommentAction(comment: TraditionComment) {
    this.replyToComment.set(comment);
  }

  cancelReply() {
    this.replyToComment.set(null);
  }

  openMediaViewer(index: number) {
    this.currentMediaIndex.set(index);
    this.showMediaViewer.set(true);
  }

  closeMediaViewer() {
    this.showMediaViewer.set(false);
  }

  nextMedia() {
    const tradition = this.tradition();
    if (!tradition?.media) return;
    
    const currentIndex = this.currentMediaIndex();
    const nextIndex = (currentIndex + 1) % tradition.media.length;
    this.currentMediaIndex.set(nextIndex);
  }

  previousMedia() {
    const tradition = this.tradition();
    if (!tradition?.media) return;
    
    const currentIndex = this.currentMediaIndex();
    const prevIndex = currentIndex === 0 ? tradition.media.length - 1 : currentIndex - 1;
    this.currentMediaIndex.set(prevIndex);
  }

  selectTab(tab: 'overview' | 'occurrences' | 'comments') {
    this.selectedTab.set(tab);
  }

  editTradition() {
    this.router.navigate(['/family', this.familySlug, 'memories', 'traditions', this.traditionId, 'edit']);
  }

  async deleteTradition() {
    const tradition = this.tradition();
    if (!tradition || !tradition.permissions.canDelete) return;

    // Show confirmation dialog
    const confirmed = await this.showConfirm(
      'Delete Tradition',
      'Are you sure you want to delete this tradition? This cannot be undone.',
      'Delete',
      'Cancel'
    );

    if (!confirmed) return;

    try {
      await this.traditionService.deleteTradition(this.familySlug, this.traditionId).toPromise();
      this.showToast('Tradition deleted', 'success');
      this.router.navigate(['/family', this.familySlug, 'memories', 'traditions']);
    } catch (error) {
      console.error('Error deleting tradition:', error);
      this.showToast('Failed to delete tradition', 'danger');
    }
  }

  getTraditionIcon(category: string): string {
    switch (category?.toLowerCase()) {
      case 'holiday': return 'gift';
      case 'celebration': return 'star';
      case 'ritual': return 'refresh-circle';
      case 'gathering': return 'people';
      case 'cultural': return 'library';
      case 'religious': return 'book';
      case 'seasonal': return 'leaf';
      case 'anniversary': return 'heart';
      default: return 'repeat';
    }
  }

  getFrequencyLabel(frequency: string): string {
    switch (frequency?.toLowerCase()) {
      case 'yearly': return 'Every year';
      case 'monthly': return 'Every month';
      case 'weekly': return 'Every week';
      case 'custom': return 'Custom schedule';
      default: return frequency;
    }
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active': return 'success';
      case 'paused': return 'warning';
      case 'inactive': return 'medium';
      default: return 'medium';
    }
  }

  getOccurrenceStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed': return 'success';
      case 'scheduled': return 'tertiary';
      case 'missed': return 'danger';
      default: return 'medium';
    }
  }

  getMediaIcon(type: string): string {
    switch (type) {
      case 'image': return 'image';
      case 'video': return 'videocam';
      case 'audio': return 'musical-notes';
      default: return 'document';
    }
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString();
  }

  formatDateTime(date: string): string {
    return new Date(date).toLocaleString();
  }

  getTimeAgo(date: string): string {
    const now = new Date();
    const traditionDate = new Date(date);
    const diffInDays = Math.floor((now.getTime() - traditionDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  }

  getDaysUntil(date: string): number {
    const now = new Date();
    const targetDate = new Date(date);
    return Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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

  private async showConfirm(header: string, message: string, confirmText: string, cancelText: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.toastCtrl.create({
        header,
        message,
        buttons: [
          { text: cancelText, role: 'cancel', handler: () => resolve(false) },
          { text: confirmText, handler: () => resolve(true) }
        ]
      });
      await alert.present();
    });
  }
}