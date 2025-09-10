import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonBackButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonIcon, IonChip, IonText, IonItem, IonList, IonAvatar, IonLabel,
  IonNote, IonTextarea, IonModal, IonFab, IonFabButton, IonImg,
  IonGrid, IonRow, IonCol, IonSegment, IonSegmentButton, IonBadge
} from '@ionic/angular/standalone';
import { ToastController, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  heart, heartOutline, chatbubble, share, star, starOutline,
  calendar, person, location, tag, eye, bookmark, edit, trash,
  add, send, close, image, videocam, musicalNotes
} from 'ionicons/icons';
import { MemoryService } from '../../core/services/memories/memory.service';
import { 
  MemoryResponse, MemoryComment, CreateMemoryCommentRequest 
} from '../../models/memories/memory.models';

@Component({
  selector: 'app-memory-detail',
  templateUrl: './memory-detail.page.html',
  styleUrls: ['./memory-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonBackButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonIcon, IonChip, IonText, IonItem, IonList, IonAvatar, IonLabel,
    IonNote, IonTextarea, IonModal, IonFab, IonFabButton, IonImg,
    IonGrid, IonRow, IonCol, IonSegment, IonSegmentButton, IonBadge
  ]
})
export class MemoryDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private memoryService = inject(MemoryService);
  private toastCtrl = inject(ToastController);
  private modalCtrl = inject(ModalController);

  familySlug = '';
  memoryId = '';
  
  memory = signal<MemoryResponse | null>(null);
  comments = signal<MemoryComment[]>([]);
  loading = signal(true);
  commentsLoading = signal(false);
  
  // Comment form
  newComment = signal('');
  replyToComment = signal<MemoryComment | null>(null);
  
  // Media viewer
  currentMediaIndex = signal(0);
  showMediaViewer = signal(false);

  constructor() {
    addIcons({ 
      heart, heartOutline, chatbubble, share, star, starOutline,
      calendar, person, location, tag, eye, bookmark, edit, trash,
      add, send, close, image, videocam, musicalNotes
    });
  }

  ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.memoryId = this.route.snapshot.paramMap.get('memoryId') || '';
    this.loadMemory();
    this.loadComments();
  }

  async loadMemory() {
    this.loading.set(true);
    
    try {
      const memory = await this.memoryService.getMemory(this.familySlug, this.memoryId).toPromise();
      if (memory) {
        this.memory.set(memory);
        
        // Increment view count
        await this.memoryService.incrementViews?.(this.familySlug, this.memoryId).toPromise();
      }
    } catch (error) {
      console.error('Error loading memory:', error);
      this.showToast('Failed to load memory', 'danger');
      this.router.navigate(['/family', this.familySlug, 'memories']);
    } finally {
      this.loading.set(false);
    }
  }

  async loadComments() {
    this.commentsLoading.set(true);
    
    try {
      const response = await this.memoryService.getComments(this.familySlug, this.memoryId).toPromise();
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
    const memory = this.memory();
    if (!memory) return;

    try {
      const result = await this.memoryService.toggleLike(
        this.familySlug,
        this.memoryId,
        memory.isLikedByCurrentUser || false
      ).toPromise();

      if (result) {
        this.memory.update(m => m ? {
          ...m,
          isLikedByCurrentUser: result.liked,
          likesCount: result.likesCount
        } : null);
        
        this.showToast(result.liked ? 'Memory liked!' : 'Like removed', 'success');
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      this.showToast('Failed to update like', 'danger');
    }
  }

  async toggleFeature() {
    const memory = this.memory();
    if (!memory || !memory.permissions.canEdit) return;

    try {
      if (memory.isFeatured) {
        await this.memoryService.unfeatureMemory(this.familySlug, this.memoryId).toPromise();
      } else {
        await this.memoryService.featureMemory(this.familySlug, this.memoryId).toPromise();
      }
      
      this.memory.update(m => m ? {
        ...m,
        isFeatured: !m.isFeatured
      } : null);
      
      this.showToast(
        memory.isFeatured ? 'Memory unfeatured' : 'Memory featured!',
        'success'
      );
    } catch (error) {
      console.error('Error toggling feature:', error);
      this.showToast('Failed to update feature status', 'danger');
    }
  }

  async shareMemory() {
    const memory = this.memory();
    if (!memory) return;

    const shareUrl = this.memoryService.getShareUrl(this.familySlug, this.memoryId);
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: memory.title,
          text: memory.description || 'Check out this family memory!',
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
      const commentData: CreateMemoryCommentRequest = {
        content,
        parentId: this.replyToComment()?.id
      };

      const comment = await this.memoryService.addComment(
        this.familySlug,
        this.memoryId,
        commentData
      ).toPromise();

      if (comment) {
        this.comments.update(comments => [...comments, comment]);
        this.memory.update(m => m ? {
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

  replyToCommentAction(comment: MemoryComment) {
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
    const memory = this.memory();
    if (!memory?.media) return;
    
    const currentIndex = this.currentMediaIndex();
    const nextIndex = (currentIndex + 1) % memory.media.length;
    this.currentMediaIndex.set(nextIndex);
  }

  previousMedia() {
    const memory = this.memory();
    if (!memory?.media) return;
    
    const currentIndex = this.currentMediaIndex();
    const prevIndex = currentIndex === 0 ? memory.media.length - 1 : currentIndex - 1;
    this.currentMediaIndex.set(prevIndex);
  }

  editMemory() {
    this.router.navigate(['/family', this.familySlug, 'memories', this.memoryId, 'edit']);
  }

  async deleteMemory() {
    const memory = this.memory();
    if (!memory || !memory.permissions.canDelete) return;

    // Show confirmation dialog
    const confirmed = await this.showConfirm(
      'Delete Memory',
      'Are you sure you want to delete this memory? This cannot be undone.',
      'Delete',
      'Cancel'
    );

    if (!confirmed) return;

    try {
      await this.memoryService.deleteMemory(this.familySlug, this.memoryId).toPromise();
      this.showToast('Memory deleted', 'success');
      this.router.navigate(['/family', this.familySlug, 'memories']);
    } catch (error) {
      console.error('Error deleting memory:', error);
      this.showToast('Failed to delete memory', 'danger');
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
    const memoryDate = new Date(date);
    const diffInDays = Math.floor((now.getTime() - memoryDate.getTime()) / (1000 * 60 * 60 * 24));
    
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