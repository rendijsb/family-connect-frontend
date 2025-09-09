import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonIcon, IonImg, IonText, IonChip, IonItem, IonLabel, IonList,
  IonTextarea, IonInput, IonCard, IonCardContent, IonCardHeader, 
  IonCardTitle, IonProgressBar, IonCheckbox, IonGrid, IonRow, IonCol,
  IonActionSheet, IonAlert, IonToast, IonModal, IonFab, IonFabButton
} from '@ionic/angular/standalone';
import { ModalController, ActionSheetController, AlertController, ToastController } from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { addIcons } from 'ionicons/icons';
import { 
  close, cloudUpload, camera, images, add, trash, checkmark,
  person, pricetag, location, calendar, informationCircle
} from 'ionicons/icons';

export interface PhotoUploadData {
  albumId: string;
  familySlug: string;
}

export interface UploadFile {
  id: string;
  file: File | Blob;
  preview: string;
  name: string;
  size: number;
  type: string;
  description: string;
  tags: string[];
  location: string;
  uploadProgress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

@Component({
  selector: 'app-photo-upload',
  templateUrl: './photo-upload.modal.html',
  styleUrls: ['./photo-upload.modal.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonIcon, IonImg, IonText, IonChip, IonItem, IonLabel, IonList,
    IonTextarea, IonInput, IonCard, IonCardContent, IonCardHeader, 
    IonCardTitle, IonProgressBar, IonCheckbox, IonGrid, IonRow, IonCol,
    IonActionSheet, IonAlert, IonToast, IonModal, IonFab, IonFabButton
  ]
})
export class PhotoUploadModal implements OnInit {
  @Input() data!: PhotoUploadData;

  private modalCtrl = inject(ModalController);
  private actionSheetCtrl = inject(ActionSheetController);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  files: UploadFile[] = [];
  isUploading = false;
  uploadProgress = 0;
  maxFiles = 50;
  maxFileSize = 10 * 1024 * 1024; // 10MB
  allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4'];

  // Bulk settings
  bulkDescription = '';
  bulkTags = '';
  bulkLocation = '';
  applyBulkSettings = false;

  constructor() {
    addIcons({ 
      close, cloudUpload, camera, images, add, trash, checkmark,
      person, pricetag, location, calendar, informationCircle
    });
  }

  ngOnInit() {
    console.log('Photo upload modal initialized for album:', this.data?.albumId);
  }

  async presentSourceActionSheet() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Add Photos',
      buttons: [
        {
          text: 'Take Photo',
          icon: 'camera',
          handler: () => this.takePhoto()
        },
        {
          text: 'Choose from Gallery',
          icon: 'images',
          handler: () => this.selectFromGallery()
        },
        {
          text: 'Select Files',
          icon: 'folder',
          handler: () => this.selectFiles()
        },
        {
          text: 'Cancel',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  async takePhoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (image.dataUrl) {
        await this.addImageFromDataUrl(image.dataUrl, 'camera-photo.jpg');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      this.showErrorToast('Failed to take photo');
    }
  }

  async selectFromGallery() {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });

      if (image.dataUrl) {
        await this.addImageFromDataUrl(image.dataUrl, 'gallery-photo.jpg');
      }
    } catch (error) {
      console.error('Error selecting from gallery:', error);
      this.showErrorToast('Failed to select photo from gallery');
    }
  }

  selectFiles() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = this.allowedTypes.join(',');
    
    input.onchange = (event: any) => {
      const files = Array.from(event.target.files) as File[];
      this.processSelectedFiles(files);
    };
    
    input.click();
  }

  async addImageFromDataUrl(dataUrl: string, filename: string) {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      const file = new File([blob], filename, { type: blob.type });
      await this.processSelectedFiles([file]);
    } catch (error) {
      console.error('Error processing image:', error);
      this.showErrorToast('Failed to process image');
    }
  }

  async processSelectedFiles(files: File[]) {
    const validFiles: UploadFile[] = [];
    
    for (const file of files) {
      // Validate file
      if (!this.validateFile(file)) {
        continue;
      }
      
      // Check if we haven't exceeded max files
      if (this.files.length + validFiles.length >= this.maxFiles) {
        this.showErrorToast(`Maximum ${this.maxFiles} files allowed`);
        break;
      }
      
      // Create preview
      const preview = await this.createPreview(file);
      
      const uploadFile: UploadFile = {
        id: this.generateId(),
        file,
        preview,
        name: file.name,
        size: file.size,
        type: file.type,
        description: this.bulkDescription,
        tags: this.bulkTags ? this.bulkTags.split(',').map(t => t.trim()) : [],
        location: this.bulkLocation,
        uploadProgress: 0,
        status: 'pending'
      };
      
      validFiles.push(uploadFile);
    }
    
    this.files.push(...validFiles);
  }

  validateFile(file: File): boolean {
    if (!this.allowedTypes.includes(file.type)) {
      this.showErrorToast(`File type ${file.type} not supported`);
      return false;
    }
    
    if (file.size > this.maxFileSize) {
      this.showErrorToast(`File ${file.name} exceeds maximum size of ${this.formatFileSize(this.maxFileSize)}`);
      return false;
    }
    
    return true;
  }

  async createPreview(file: File): Promise<string> {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        // For videos, you might want to generate a thumbnail
        resolve('/assets/video-placeholder.png');
      }
    });
  }

  removeFile(fileId: string) {
    this.files = this.files.filter(f => f.id !== fileId);
  }

  updateFileDescription(fileId: string, description: string) {
    const file = this.files.find(f => f.id === fileId);
    if (file) {
      file.description = description;
    }
  }

  updateFileTags(fileId: string, tags: string) {
    const file = this.files.find(f => f.id === fileId);
    if (file) {
      file.tags = tags.split(',').map(t => t.trim()).filter(t => t);
    }
  }

  updateFileLocation(fileId: string, location: string) {
    const file = this.files.find(f => f.id === fileId);
    if (file) {
      file.location = location;
    }
  }

  applyBulkSettingsToAll() {
    if (!this.applyBulkSettings) return;
    
    this.files.forEach(file => {
      if (this.bulkDescription) file.description = this.bulkDescription;
      if (this.bulkTags) file.tags = this.bulkTags.split(',').map(t => t.trim());
      if (this.bulkLocation) file.location = this.bulkLocation;
    });
  }

  async startUpload() {
    if (this.files.length === 0) {
      this.showErrorToast('No files selected');
      return;
    }
    
    this.applyBulkSettingsToAll();
    this.isUploading = true;
    
    const totalFiles = this.files.length;
    let completedFiles = 0;
    
    // Upload files one by one (or implement concurrent uploads)
    for (const file of this.files) {
      if (file.status === 'pending') {
        try {
          file.status = 'uploading';
          await this.uploadFile(file);
          file.status = 'completed';
          file.uploadProgress = 100;
          completedFiles++;
        } catch (error) {
          file.status = 'error';
          file.errorMessage = 'Upload failed';
          console.error('Upload error:', error);
        }
        
        this.uploadProgress = (completedFiles / totalFiles) * 100;
      }
    }
    
    this.isUploading = false;
    
    const successfulUploads = this.files.filter(f => f.status === 'completed').length;
    const failedUploads = this.files.filter(f => f.status === 'error').length;
    
    if (successfulUploads > 0) {
      this.showSuccessToast(`${successfulUploads} photos uploaded successfully`);
      if (failedUploads === 0) {
        // Close modal if all uploads successful
        setTimeout(() => this.dismiss(), 1500);
      }
    }
    
    if (failedUploads > 0) {
      this.showErrorToast(`${failedUploads} uploads failed`);
    }
  }

  async uploadFile(uploadFile: UploadFile): Promise<void> {
    return new Promise((resolve, reject) => {
      // Simulate upload progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 20;
        uploadFile.uploadProgress = Math.min(progress, 95);
        
        if (progress >= 95) {
          clearInterval(interval);
          
          // TODO: Replace with actual upload API call
          setTimeout(() => {
            uploadFile.uploadProgress = 100;
            resolve();
          }, 500);
        }
      }, 200);
      
      // TODO: Implement actual file upload
      // const formData = new FormData();
      // formData.append('file', uploadFile.file);
      // formData.append('description', uploadFile.description);
      // formData.append('tags', JSON.stringify(uploadFile.tags));
      // formData.append('location', uploadFile.location);
      // 
      // this.photoService.uploadPhoto(this.data.albumId, formData)
      //   .subscribe({
      //     next: (event) => {
      //       if (event.type === HttpEventType.UploadProgress) {
      //         uploadFile.uploadProgress = Math.round(100 * event.loaded / event.total);
      //       } else if (event.type === HttpEventType.Response) {
      //         resolve();
      //       }
      //     },
      //     error: (error) => reject(error)
      //   });
    });
  }

  retryFailedUploads() {
    const failedFiles = this.files.filter(f => f.status === 'error');
    failedFiles.forEach(f => {
      f.status = 'pending';
      f.uploadProgress = 0;
      f.errorMessage = undefined;
    });
    
    if (failedFiles.length > 0) {
      this.startUpload();
    }
  }

  clearCompleted() {
    this.files = this.files.filter(f => f.status !== 'completed');
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

  async showSuccessToast(message: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'top',
      color: 'success'
    });
    await toast.present();
  }

  dismiss() {
    // Check if there are pending uploads
    const pendingUploads = this.files.filter(f => f.status === 'uploading').length;
    
    if (pendingUploads > 0) {
      this.presentCancelConfirmation();
    } else {
      this.modalCtrl.dismiss();
    }
  }

  async presentCancelConfirmation() {
    const alert = await this.alertCtrl.create({
      header: 'Cancel Upload?',
      message: 'There are uploads in progress. Are you sure you want to cancel?',
      buttons: [
        { text: 'Continue Uploading', role: 'cancel' },
        { 
          text: 'Cancel Upload', 
          role: 'destructive',
          handler: () => this.modalCtrl.dismiss()
        }
      ]
    });

    await alert.present();
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

  generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  trackByFileId(index: number, file: UploadFile): string {
    return file.id;
  }
}