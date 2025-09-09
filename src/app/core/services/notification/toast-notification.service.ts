import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { PhotoRealtimeService } from '../photos/photo-realtime.service';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ToastNotificationService {
  private toastCtrl = inject(ToastController);
  private photoRealtimeService = inject(PhotoRealtimeService);
  private subscriptions: Subscription[] = [];
  private isInitialized = false;

  initialize() {
    if (this.isInitialized) return;
    
    // Check if toast notifications are enabled
    if (!environment.photos?.enableToastNotifications) {
      console.log('Toast notifications disabled in environment');
      return;
    }

    // Listen for photo upload events
    const photoUploadSub = this.photoRealtimeService.photoUploaded$.subscribe(event => {
      if (event) {
        this.showPhotoUploadToast(event);
      }
    });
    this.subscriptions.push(photoUploadSub);

    // Listen for photo like events
    const photoLikeSub = this.photoRealtimeService.photoLiked$.subscribe(event => {
      if (event) {
        this.showPhotoLikeToast(event);
      }
    });
    this.subscriptions.push(photoLikeSub);

    // Listen for photo comment events
    const photoCommentSub = this.photoRealtimeService.photoCommented$.subscribe(event => {
      if (event) {
        this.showPhotoCommentToast(event);
      }
    });
    this.subscriptions.push(photoCommentSub);

    // Listen for album events
    const albumCreatedSub = this.photoRealtimeService.albumCreated$.subscribe(event => {
      if (event) {
        this.showAlbumCreatedToast(event);
      }
    });
    this.subscriptions.push(albumCreatedSub);

    const albumUpdatedSub = this.photoRealtimeService.albumUpdated$.subscribe(event => {
      if (event) {
        this.showAlbumUpdatedToast(event);
      }
    });
    this.subscriptions.push(albumUpdatedSub);

    this.isInitialized = true;
  }

  destroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    this.isInitialized = false;
  }

  private async showPhotoUploadToast(event: any) {
    const toast = await this.toastCtrl.create({
      message: `${event.uploader.name} uploaded a new photo`,
      duration: environment.photos?.notificationDuration || 3000,
      position: 'top',
      color: 'primary',
      buttons: [
        {
          text: 'View',
          role: 'cancel',
          handler: () => {
            // Navigate to album or photo
            console.log('Navigate to photo:', event.photo.id);
          }
        }
      ]
    });
    await toast.present();
  }

  private async showPhotoLikeToast(event: any) {
    if (event.liked) {
      const toast = await this.toastCtrl.create({
        message: `${event.user.name} liked your photo`,
        duration: 2000,
        position: 'top',
        color: 'success',
        icon: 'heart'
      });
      await toast.present();
    }
  }

  private async showPhotoCommentToast(event: any) {
    const toast = await this.toastCtrl.create({
      message: `${event.user.name} commented on your photo`,
      duration: 3000,
      position: 'top',
      color: 'primary',
      icon: 'chatbubble',
      buttons: [
        {
          text: 'View',
          role: 'cancel',
          handler: () => {
            // Navigate to photo comments
            console.log('Navigate to photo comments:', event.photoId);
          }
        }
      ]
    });
    await toast.present();
  }

  private async showAlbumCreatedToast(event: any) {
    const toast = await this.toastCtrl.create({
      message: `${event.creator.name} created album "${event.album.name}"`,
      duration: 3000,
      position: 'top',
      color: 'primary',
      icon: 'folder',
      buttons: [
        {
          text: 'View',
          role: 'cancel',
          handler: () => {
            // Navigate to album
            console.log('Navigate to album:', event.album.id);
          }
        }
      ]
    });
    await toast.present();
  }

  private async showAlbumUpdatedToast(event: any) {
    const changes = Object.keys(event.changes);
    if (changes.includes('name')) {
      const toast = await this.toastCtrl.create({
        message: `${event.user.name} renamed album to "${event.album.name}"`,
        duration: 2000,
        position: 'top',
        color: 'medium'
      });
      await toast.present();
    }
  }

  // Generic toast methods for other notifications
  async showSuccess(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      position: 'top',
      color: 'success'
    });
    await toast.present();
  }

  async showError(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 4000,
      position: 'top',
      color: 'danger'
    });
    await toast.present();
  }

  async showInfo(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color: 'primary'
    });
    await toast.present();
  }
}