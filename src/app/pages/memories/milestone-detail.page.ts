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
  add, send, close, trophy, ribbon, checkmark, time
} from 'ionicons/icons';
import { MilestoneService } from '../../core/services/memories/milestone.service';
import { 
  MilestoneResponse, MilestoneComment, CreateMilestoneCommentRequest 
} from '../../models/memories/memory.models';

@Component({
  selector: 'app-milestone-detail',
  templateUrl: './milestone-detail.page.html',
  styleUrls: ['./milestone-detail.page.scss'],
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
export class MilestoneDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private milestoneService = inject(MilestoneService);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);

  familySlug = '';
  milestoneId = '';
  
  milestone = signal<MilestoneResponse | null>(null);
  comments = signal<MilestoneComment[]>([]);
  loading = signal(true);
  commentsLoading = signal(false);
  
  // Comment form
  newComment = signal('');
  replyToComment = signal<MilestoneComment | null>(null);
  
  // Media viewer
  currentMediaIndex = signal(0);
  showMediaViewer = signal(false);

  // Progress computation
  progressPercentage = computed(() => {
    const ms = this.milestone();
    if (!ms || !ms.targetValue) return 0;
    return Math.min((ms.currentValue / ms.targetValue) * 100, 100);
  });

  constructor() {
    addIcons({ 
      heart, heartOutline, chatbubble, share, star, starOutline,
      calendar, person, location, tag, eye, bookmark, edit, trash,
      add, send, close, trophy, ribbon, checkmark, time
    });
  }

  ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.milestoneId = this.route.snapshot.paramMap.get('milestoneId') || '';
    this.loadMilestone();
    this.loadComments();
  }

  async loadMilestone() {
    this.loading.set(true);
    
    try {
      const milestone = await this.milestoneService.getMilestone(this.familySlug, this.milestoneId).toPromise();
      if (milestone) {
        this.milestone.set(milestone);
        
        // Increment view count
        await this.milestoneService.incrementViews?.(this.familySlug, this.milestoneId).toPromise();
      }
    } catch (error) {
      console.error('Error loading milestone:', error);
      this.showToast('Failed to load milestone', 'danger');
      this.router.navigate(['/family', this.familySlug, 'memories', 'milestones']);
    } finally {
      this.loading.set(false);
    }
  }

  async loadComments() {
    this.commentsLoading.set(true);
    
    try {
      const response = await this.milestoneService.getComments(this.familySlug, this.milestoneId).toPromise();
      if (response) {
        this.comments.set(response.data);
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      this.commentsLoading.set(false);
    }
  }

  async toggleLike() {
    const milestone = this.milestone();
    if (!milestone) return;

    try {
      const result = await this.milestoneService.toggleLike(
        this.familySlug,
        this.milestoneId,
        milestone.isLikedByCurrentUser || false
      ).toPromise();

      if (result) {
        this.milestone.update(m => m ? {
          ...m,
          isLikedByCurrentUser: result.liked,
          likesCount: result.likesCount
        } : null);
        
        this.showToast(result.liked ? 'Milestone liked!' : 'Like removed', 'success');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      this.showToast('Failed to update like', 'danger');
    }
  }

  async updateProgress(newValue: number) {
    const milestone = this.milestone();
    if (!milestone || !milestone.permissions.canEdit) return;

    try {
      const updated = await this.milestoneService.updateProgress(
        this.familySlug,
        this.milestoneId,
        newValue
      ).toPromise();
      
      if (updated) {
        this.milestone.update(m => m ? {
          ...m,
          currentValue: updated.currentValue,
          isCompleted: updated.isCompleted,
          completedAt: updated.completedAt
        } : null);
        
        this.showToast('Progress updated!', 'success');
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      this.showToast('Failed to update progress', 'danger');
    }
  }

  async markComplete() {
    const milestone = this.milestone();
    if (!milestone || !milestone.permissions.canEdit || milestone.isCompleted) return;

    try {
      await this.updateProgress(milestone.targetValue || milestone.currentValue);
    } catch (error) {
      console.error('Error marking complete:', error);
      this.showToast('Failed to mark as complete', 'danger');
    }
  }

  async shareMilestone() {
    const milestone = this.milestone();
    if (!milestone) return;

    const shareUrl = this.milestoneService.getShareUrl(this.familySlug, this.milestoneId);
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: milestone.title,
          text: milestone.description || 'Check out this family milestone!',
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
      const commentData: CreateMilestoneCommentRequest = {
        content,
        parentId: this.replyToComment()?.id
      };

      const comment = await this.milestoneService.addComment(
        this.familySlug,
        this.milestoneId,
        commentData
      ).toPromise();

      if (comment) {
        this.comments.update(comments => [...comments, comment]);
        this.milestone.update(m => m ? {
          ...m,
          commentsCount: m.commentsCount + 1
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

  replyToCommentAction(comment: MilestoneComment) {
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
    const milestone = this.milestone();
    if (!milestone?.media) return;
    
    const currentIndex = this.currentMediaIndex();
    const nextIndex = (currentIndex + 1) % milestone.media.length;
    this.currentMediaIndex.set(nextIndex);
  }

  previousMedia() {
    const milestone = this.milestone();
    if (!milestone?.media) return;
    
    const currentIndex = this.currentMediaIndex();
    const prevIndex = currentIndex === 0 ? milestone.media.length - 1 : currentIndex - 1;
    this.currentMediaIndex.set(prevIndex);
  }

  editMilestone() {
    this.router.navigate(['/family', this.familySlug, 'memories', 'milestones', this.milestoneId, 'edit']);
  }

  async deleteMilestone() {
    const milestone = this.milestone();
    if (!milestone || !milestone.permissions.canDelete) return;

    // Show confirmation dialog
    const confirmed = await this.showConfirm(
      'Delete Milestone',
      'Are you sure you want to delete this milestone? This cannot be undone.',
      'Delete',
      'Cancel'
    );

    if (!confirmed) return;

    try {
      await this.milestoneService.deleteMilestone(this.familySlug, this.milestoneId).toPromise();
      this.showToast('Milestone deleted', 'success');
      this.router.navigate(['/family', this.familySlug, 'memories', 'milestones']);
    } catch (error) {
      console.error('Error deleting milestone:', error);
      this.showToast('Failed to delete milestone', 'danger');
    }
  }

  getMilestoneIcon(category: string): string {
    switch (category?.toLowerCase()) {
      case 'achievement': return 'trophy';
      case 'celebration': return 'star';
      case 'growth': return 'trending-up';
      case 'education': return 'school';
      case 'career': return 'briefcase';
      case 'health': return 'fitness';
      case 'travel': return 'airplane';
      case 'relationship': return 'heart';
      default: return 'flag';
    }
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'planned': return 'medium';
      case 'on_hold': return 'tertiary';
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

  getTimeAgo(date: string): string {
    const now = new Date();
    const milestoneDate = new Date(date);
    const diffInDays = Math.floor((now.getTime() - milestoneDate.getTime()) / (1000 * 60 * 60 * 24));
    
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