import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonBackButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonIcon, IonChip, IonText, IonItem, IonList, IonAvatar, IonLabel,
  IonNote, IonTextarea, IonModal, IonFab, IonFabButton, IonImg,
  IonGrid, IonRow, IonCol, IonProgressBar, IonBadge, IonSpinner
} from '@ionic/angular/standalone';
import { ToastController, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  heart, heartOutline, chatbubble, share, star, starOutline,
  calendar, person, location, tag, eye, bookmark, edit, trash,
  add, send, close, archive, lockClosed, lockOpen, time,
  gift, alertCircle
} from 'ionicons/icons';
import { TimeCapsuleService } from '../../core/services/memories/time-capsule.service';
import { 
  TimeCapsuleResponse, TimeCapsuleComment, CreateTimeCapsuleCommentRequest,
  TimeCapsuleContribution, CreateTimeCapsuleContributionRequest 
} from '../../models/memories/memory.models';

@Component({
  selector: 'app-time-capsule-detail',
  templateUrl: './time-capsule-detail.page.html',
  styleUrls: ['./time-capsule-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonBackButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonIcon, IonChip, IonText, IonItem, IonList, IonAvatar, IonLabel,
    IonNote, IonTextarea, IonModal, IonFab, IonFabButton, IonImg,
    IonGrid, IonRow, IonCol, IonProgressBar, IonBadge, IonSpinner
  ]
})
export class TimeCapsuleDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private timeCapsuleService = inject(TimeCapsuleService);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);

  familySlug = '';
  capsuleId = '';
  
  timeCapsule = signal<TimeCapsuleResponse | null>(null);
  comments = signal<TimeCapsuleComment[]>([]);
  contributions = signal<TimeCapsuleContribution[]>([]);
  loading = signal(true);
  commentsLoading = signal(false);
  contributionsLoading = signal(false);
  
  // Comment form
  newComment = signal('');
  replyToComment = signal<TimeCapsuleComment | null>(null);
  
  // Contribution form
  newContribution = signal('');
  showContributionForm = signal(false);
  
  // Media viewer
  currentMediaIndex = signal(0);
  showMediaViewer = signal(false);

  // Tab selection
  selectedTab = signal<'overview' | 'contributions' | 'comments'>('overview');

  // Time calculations
  daysUntilOpen = computed(() => {
    const capsule = this.timeCapsule();
    if (!capsule?.openDate) return null;
    
    const now = new Date();
    const openDate = new Date(capsule.openDate);
    const diffTime = openDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  });

  isReadyToOpen = computed(() => {
    const days = this.daysUntilOpen();
    return days !== null && days <= 0;
  });

  progressPercentage = computed(() => {
    const capsule = this.timeCapsule();
    if (!capsule?.createDate || !capsule?.openDate) return 0;
    
    const now = new Date();
    const createDate = new Date(capsule.createDate);
    const openDate = new Date(capsule.openDate);
    
    const totalTime = openDate.getTime() - createDate.getTime();
    const elapsedTime = now.getTime() - createDate.getTime();
    
    return Math.min((elapsedTime / totalTime) * 100, 100);
  });

  constructor() {
    addIcons({ 
      heart, heartOutline, chatbubble, share, star, starOutline,
      calendar, person, location, tag, eye, bookmark, edit, trash,
      add, send, close, archive, lockClosed, lockOpen, time,
      gift, alertCircle
    });
  }

  ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.capsuleId = this.route.snapshot.paramMap.get('capsuleId') || '';
    this.loadTimeCapsule();
    this.loadComments();
    this.loadContributions();
  }

  async loadTimeCapsule() {
    this.loading.set(true);
    
    try {
      const capsule = await this.timeCapsuleService.getTimeCapsule(this.familySlug, this.capsuleId).toPromise();
      if (capsule) {
        this.timeCapsule.set(capsule);
        
        // Increment view count
        await this.timeCapsuleService.incrementViews?.(this.familySlug, this.capsuleId).toPromise();
      }
    } catch (error) {
      console.error('Error loading time capsule:', error);
      this.showToast('Failed to load time capsule', 'danger');
      this.router.navigate(['/family', this.familySlug, 'memories', 'time-capsules']);
    } finally {
      this.loading.set(false);
    }
  }

  async loadComments() {
    this.commentsLoading.set(true);
    
    try {
      const response = await this.timeCapsuleService.getComments(this.familySlug, this.capsuleId).toPromise();
      if (response) {
        this.comments.set(response.data);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      this.commentsLoading.set(false);
    }
  }

  async loadContributions() {
    this.contributionsLoading.set(true);
    
    try {
      const response = await this.timeCapsuleService.getContributions(this.familySlug, this.capsuleId).toPromise();
      if (response) {
        this.contributions.set(response.data);
      }
    } catch (error) {
      console.error('Error loading contributions:', error);
    } finally {
      this.contributionsLoading.set(false);
    }
  }

  async toggleLike() {
    const capsule = this.timeCapsule();
    if (!capsule) return;

    try {
      const result = await this.timeCapsuleService.toggleLike(
        this.familySlug,
        this.capsuleId,
        capsule.isLikedByCurrentUser || false
      ).toPromise();

      if (result) {
        this.timeCapsule.update(tc => tc ? {
          ...tc,
          isLikedByCurrentUser: result.liked,
          likesCount: result.likesCount
        } : null);
        
        this.showToast(result.liked ? 'Time capsule liked!' : 'Like removed', 'success');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      this.showToast('Failed to update like', 'danger');
    }
  }

  async openTimeCapsule() {
    const capsule = this.timeCapsule();
    if (!capsule || !this.isReadyToOpen() || capsule.isOpened) return;

    // Show confirmation dialog
    const confirmed = await this.showConfirm(
      'Open Time Capsule',
      'Are you ready to open this time capsule? Once opened, all contents will be revealed to family members.',
      'Open Capsule',
      'Wait Longer'
    );

    if (!confirmed) return;

    try {
      const opened = await this.timeCapsuleService.openTimeCapsule(
        this.familySlug,
        this.capsuleId
      ).toPromise();
      
      if (opened) {
        this.timeCapsule.update(tc => tc ? {
          ...tc,
          isOpened: true,
          openedAt: opened.openedAt
        } : null);
        
        // Reload contributions to show newly revealed content
        await this.loadContributions();
        
        this.showToast('Time capsule opened! 🎉', 'success');
        this.selectedTab.set('contributions');
      }
    } catch (error) {
      console.error('Error opening time capsule:', error);
      this.showToast('Failed to open time capsule', 'danger');
    }
  }

  async addContribution() {
    const content = this.newContribution().trim();
    if (!content) return;

    const capsule = this.timeCapsule();
    if (!capsule || capsule.isOpened || !capsule.permissions.canContribute) return;

    try {
      const contributionData: CreateTimeCapsuleContributionRequest = {
        type: 'text',
        content,
        message: content
      };

      const contribution = await this.timeCapsuleService.addContribution(
        this.familySlug,
        this.capsuleId,
        contributionData
      ).toPromise();

      if (contribution) {
        this.contributions.update(contribs => [...contribs, contribution]);
        this.timeCapsule.update(tc => tc ? {
          ...tc,
          contributionsCount: tc.contributionsCount + 1
        } : null);
        
        this.newContribution.set('');
        this.showContributionForm.set(false);
        this.showToast('Contribution added to time capsule!', 'success');
      }
    } catch (error) {
      console.error('Error adding contribution:', error);
      this.showToast('Failed to add contribution', 'danger');
    }
  }

  async shareTimeCapsule() {
    const capsule = this.timeCapsule();
    if (!capsule) return;

    const shareUrl = this.timeCapsuleService.getShareUrl(this.familySlug, this.capsuleId);
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: capsule.title,
          text: capsule.description || 'Check out this family time capsule!',
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
      const commentData: CreateTimeCapsuleCommentRequest = {
        content,
        parentId: this.replyToComment()?.id
      };

      const comment = await this.timeCapsuleService.addComment(
        this.familySlug,
        this.capsuleId,
        commentData
      ).toPromise();

      if (comment) {
        this.comments.update(comments => [...comments, comment]);
        this.timeCapsule.update(tc => tc ? {
          ...tc,
          commentsCount: tc.commentsCount + 1
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

  replyToCommentAction(comment: TimeCapsuleComment) {
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
    const capsule = this.timeCapsule();
    if (!capsule?.media) return;
    
    const currentIndex = this.currentMediaIndex();
    const nextIndex = (currentIndex + 1) % capsule.media.length;
    this.currentMediaIndex.set(nextIndex);
  }

  previousMedia() {
    const capsule = this.timeCapsule();
    if (!capsule?.media) return;
    
    const currentIndex = this.currentMediaIndex();
    const prevIndex = currentIndex === 0 ? capsule.media.length - 1 : currentIndex - 1;
    this.currentMediaIndex.set(prevIndex);
  }

  selectTab(tab: 'overview' | 'contributions' | 'comments') {
    this.selectedTab.set(tab);
  }

  toggleContributionForm() {
    this.showContributionForm.update(show => !show);
    if (!this.showContributionForm()) {
      this.newContribution.set('');
    }
  }

  editTimeCapsule() {
    this.router.navigate(['/family', this.familySlug, 'memories', 'time-capsules', this.capsuleId, 'edit']);
  }

  async deleteTimeCapsule() {
    const capsule = this.timeCapsule();
    if (!capsule || !capsule.permissions.canDelete) return;

    // Show confirmation dialog
    const confirmed = await this.showConfirm(
      'Delete Time Capsule',
      'Are you sure you want to delete this time capsule? This cannot be undone.',
      'Delete',
      'Cancel'
    );

    if (!confirmed) return;

    try {
      await this.timeCapsuleService.deleteTimeCapsule(this.familySlug, this.capsuleId).toPromise();
      this.showToast('Time capsule deleted', 'success');
      this.router.navigate(['/family', this.familySlug, 'memories', 'time-capsules']);
    } catch (error) {
      console.error('Error deleting time capsule:', error);
      this.showToast('Failed to delete time capsule', 'danger');
    }
  }

  getStatusIcon(): string {
    const capsule = this.timeCapsule();
    if (!capsule) return 'archive';
    
    if (capsule.isOpened) return 'lock-open';
    if (this.isReadyToOpen()) return 'gift';
    return 'lock-closed';
  }

  getStatusColor(): string {
    const capsule = this.timeCapsule();
    if (!capsule) return 'medium';
    
    if (capsule.isOpened) return 'success';
    if (this.isReadyToOpen()) return 'warning';
    return 'tertiary';
  }

  getStatusText(): string {
    const capsule = this.timeCapsule();
    if (!capsule) return 'Unknown';
    
    if (capsule.isOpened) return 'Opened';
    if (this.isReadyToOpen()) return 'Ready to Open';
    
    const days = this.daysUntilOpen();
    if (days === null) return 'Sealed';
    if (days > 365) return `${Math.floor(days / 365)} years to go`;
    if (days > 30) return `${Math.floor(days / 30)} months to go`;
    return `${days} days to go`;
  }

  getContributionIcon(type: string): string {
    switch (type?.toLowerCase()) {
      case 'text': return 'document-text';
      case 'image': return 'image';
      case 'video': return 'videocam';
      case 'audio': return 'musical-notes';
      case 'letter': return 'mail';
      case 'prediction': return 'crystal-ball';
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
    const capsuleDate = new Date(date);
    const diffInDays = Math.floor((now.getTime() - capsuleDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
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