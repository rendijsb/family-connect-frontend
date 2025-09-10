import { Component, OnInit, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonIcon, IonItem, IonLabel, IonInput, IonTextarea, IonList,
  IonSelect, IonSelectOption, IonCheckbox, IonText, IonGrid,
  IonRow, IonCol, IonCard, IonCardContent, IonCardHeader, IonCardTitle
} from '@ionic/angular/standalone';
import { ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { close, checkmark, lockClosed, globe, home, people } from 'ionicons/icons';
import { PhotoAlbumService } from '../../../core/services/photos/photo-album.service';
import { CreateAlbumRequest, AlbumPrivacy } from '../../../models/photos/photo.models';

@Component({
  selector: 'app-create-album',
  templateUrl: './create-album.modal.html',
  styleUrls: ['./create-album.modal.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonIcon, IonItem, IonLabel, IonInput, IonTextarea, IonList,
    IonSelect, IonSelectOption, IonCheckbox, IonText, IonGrid,
    IonRow, IonCol, IonCard, IonCardContent, IonCardHeader, IonCardTitle
  ]
})
export class CreateAlbumModal implements OnInit {
  @Input() familySlug!: string;
  @Input() familyMembers: any[] = [];

  private modalCtrl = inject(ModalController);
  private fb = inject(FormBuilder);
  private albumService = inject(PhotoAlbumService);

  albumForm!: FormGroup;
  creating = false;
  
  privacyOptions = [
    { value: 'family', label: 'Family Members', description: 'Visible to all family members', icon: 'home' },
    { value: 'specific_members', label: 'Specific Members', description: 'Choose who can see this album', icon: 'people' },
    { value: 'public', label: 'Public', description: 'Anyone with the link can view', icon: 'globe' },
    { value: 'private', label: 'Private', description: 'Only visible to you', icon: 'lock-closed' }
  ];

  constructor() {
    addIcons({ close, checkmark, lockClosed, globe, home, people });
  }

  ngOnInit() {
    this.initForm();
  }

  private initForm() {
    this.albumForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(500)]],
      privacy: ['family' as AlbumPrivacy, [Validators.required]],
      allowedMembers: [[]],
      allowDownload: [true],
      allowComments: [true]
    });

    // Watch privacy changes to show/hide member selection
    this.albumForm.get('privacy')?.valueChanges.subscribe(privacy => {
      if (privacy !== 'specific_members') {
        this.albumForm.get('allowedMembers')?.setValue([]);
      }
    });
  }

  get isSpecificMembers() {
    return this.albumForm.get('privacy')?.value === 'specific_members';
  }

  get selectedMembersCount() {
    const allowedMembers = this.albumForm.get('allowedMembers')?.value || [];
    return allowedMembers.length;
  }

  toggleMemberSelection(memberId: number) {
    const allowedMembers = this.albumForm.get('allowedMembers')?.value || [];
    const index = allowedMembers.indexOf(memberId);
    
    if (index === -1) {
      allowedMembers.push(memberId);
    } else {
      allowedMembers.splice(index, 1);
    }
    
    this.albumForm.get('allowedMembers')?.setValue(allowedMembers);
  }

  isMemberSelected(memberId: number): boolean {
    const allowedMembers = this.albumForm.get('allowedMembers')?.value || [];
    return allowedMembers.includes(memberId);
  }

  async createAlbum() {
    if (this.albumForm.invalid || this.creating) {
      return;
    }

    this.creating = true;

    try {
      const formValue = this.albumForm.value;
      const albumData: CreateAlbumRequest = {
        name: formValue.name.trim(),
        description: formValue.description?.trim() || undefined,
        privacy: formValue.privacy,
        allowDownload: formValue.allowDownload,
        allowComments: formValue.allowComments
      };

      if (formValue.privacy === 'specific_members' && formValue.allowedMembers?.length > 0) {
        albumData.allowedMembers = formValue.allowedMembers;
      }

      const newAlbum = await this.albumService.createAlbum(this.familySlug, albumData).toPromise();
      
      this.modalCtrl.dismiss({
        created: true,
        album: newAlbum
      });
    } catch (error) {
      console.error('Error creating album:', error);
      // TODO: Show error toast
    } finally {
      this.creating = false;
    }
  }

  dismiss() {
    this.modalCtrl.dismiss({
      created: false
    });
  }

  getPrivacyIcon(privacy: string): string {
    const option = this.privacyOptions.find(opt => opt.value === privacy);
    return option?.icon || 'home';
  }

  getPrivacyDescription(privacy: string): string {
    const option = this.privacyOptions.find(opt => opt.value === privacy);
    return option?.description || '';
  }
}