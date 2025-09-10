import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonBackButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonIcon, IonChip, IonText, IonItem, IonList, IonLabel, IonInput,
  IonTextarea, IonSelect, IonSelectOption, IonDatetime, IonCheckbox,
  IonRange, IonSpinner, IonGrid, IonRow, IonCol, IonFab, IonFabButton
} from '@ionic/angular/standalone';
import { ToastController, ActionSheetController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  trophy, star, calendar, person, tag, image, videocam,
  add, close, save, camera, folder, checkmark, remove
} from 'ionicons/icons';
import { MilestoneService } from '../../core/services/memories/milestone.service';
import { 
  CreateMilestoneRequest, MilestoneCategory, MilestoneStatus 
} from '../../models/memories/memory.models';

@Component({
  selector: 'app-create-milestone',
  templateUrl: './create-milestone.page.html',
  styleUrls: ['./create-milestone.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonBackButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonIcon, IonChip, IonText, IonItem, IonList, IonLabel, IonInput,
    IonTextarea, IonSelect, IonSelectOption, IonDatetime, IonCheckbox,
    IonRange, IonSpinner, IonGrid, IonRow, IonCol, IonFab, IonFabButton
  ]
})
export class CreateMilestonePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private milestoneService = inject(MilestoneService);
  private toastCtrl = inject(ToastController);
  private actionSheetCtrl = inject(ActionSheetController);

  familySlug = '';
  milestoneId = '';
  isEditing = false;
  
  milestoneForm!: FormGroup;
  loading = signal(false);
  submitting = signal(false);
  
  // Form sections
  selectedParticipants = signal<string[]>([]);
  selectedTags = signal<string[]>([]);
  uploadedMedia = signal<any[]>([]);
  newTag = signal('');
  
  // Categories and status options
  categories: { value: MilestoneCategory; label: string; icon: string }[] = [
    { value: 'achievement', label: 'Achievement', icon: 'trophy' },
    { value: 'celebration', label: 'Celebration', icon: 'star' },
    { value: 'growth', label: 'Personal Growth', icon: 'trending-up' },
    { value: 'education', label: 'Education', icon: 'school' },
    { value: 'career', label: 'Career', icon: 'briefcase' },
    { value: 'health', label: 'Health & Fitness', icon: 'fitness' },
    { value: 'travel', label: 'Travel', icon: 'airplane' },
    { value: 'relationship', label: 'Relationship', icon: 'heart' },
    { value: 'other', label: 'Other', icon: 'bookmark' }
  ];

  statusOptions: { value: MilestoneStatus; label: string; color: string }[] = [
    { value: 'planned', label: 'Planned', color: 'medium' },
    { value: 'in_progress', label: 'In Progress', color: 'warning' },
    { value: 'completed', label: 'Completed', color: 'success' },
    { value: 'on_hold', label: 'On Hold', color: 'tertiary' }
  ];

  constructor() {
    addIcons({ 
      trophy, star, calendar, person, tag, image, videocam,
      add, close, save, camera, folder, checkmark, remove
    });
  }

  ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.milestoneId = this.route.snapshot.paramMap.get('milestoneId') || '';
    this.isEditing = !!this.milestoneId;
    
    this.initializeForm();
    
    if (this.isEditing) {
      this.loadMilestone();
    }
  }

  private initializeForm() {
    this.milestoneForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(1000)]],
      category: ['achievement', [Validators.required]],
      status: ['planned', [Validators.required]],
      date: [new Date().toISOString(), [Validators.required]],
      targetValue: [null],
      currentValue: [0, [Validators.min(0)]],
      unit: [''],
      location: [''],
      isPrivate: [false],
      allowComments: [true]
    });
  }

  private async loadMilestone() {
    this.loading.set(true);
    
    try {
      const milestone = await this.milestoneService.getMilestone(this.familySlug, this.milestoneId).toPromise();
      if (milestone) {
        this.milestoneForm.patchValue({
          title: milestone.title,
          description: milestone.description,
          category: milestone.category,
          status: milestone.status,
          date: milestone.date,
          targetValue: milestone.targetValue,
          currentValue: milestone.currentValue,
          unit: milestone.unit,
          location: milestone.location,
          isPrivate: milestone.visibility === 'private',
          allowComments: milestone.allowComments
        });

        this.selectedParticipants.set(milestone.participants?.map(p => p.id) || []);
        this.selectedTags.set(milestone.tags?.map(t => t.name) || []);
        this.uploadedMedia.set(milestone.media || []);
      }
    } catch (error) {
      console.error('Error loading milestone:', error);
      this.showToast('Failed to load milestone', 'danger');
      this.router.navigate(['/family', this.familySlug, 'memories', 'milestones']);
    } finally {
      this.loading.set(false);
    }
  }

  async submitForm() {
    if (this.milestoneForm.invalid) {
      this.markFormGroupTouched(this.milestoneForm);
      this.showToast('Please fill in all required fields', 'warning');
      return;
    }

    this.submitting.set(true);

    try {
      const formValue = this.milestoneForm.value;
      const milestoneData: CreateMilestoneRequest = {
        title: formValue.title,
        description: formValue.description,
        category: formValue.category,
        status: formValue.status,
        date: formValue.date,
        targetValue: formValue.targetValue,
        currentValue: formValue.currentValue,
        unit: formValue.unit,
        location: formValue.location,
        visibility: formValue.isPrivate ? 'private' : 'family',
        allowComments: formValue.allowComments,
        participantIds: this.selectedParticipants(),
        tags: this.selectedTags(),
        media: this.uploadedMedia()
      };

      let result;
      if (this.isEditing) {
        result = await this.milestoneService.updateMilestone(this.familySlug, this.milestoneId, milestoneData).toPromise();
      } else {
        result = await this.milestoneService.createMilestone(this.familySlug, milestoneData).toPromise();
      }

      if (result) {
        this.showToast(
          this.isEditing ? 'Milestone updated successfully!' : 'Milestone created successfully!',
          'success'
        );
        this.router.navigate(['/family', this.familySlug, 'memories', 'milestones', result.id]);
      }
    } catch (error) {
      console.error('Error saving milestone:', error);
      this.showToast(
        this.isEditing ? 'Failed to update milestone' : 'Failed to create milestone',
        'danger'
      );
    } finally {
      this.submitting.set(false);
    }
  }

  addTag() {
    const tag = this.newTag().trim();
    if (tag && !this.selectedTags().includes(tag)) {
      this.selectedTags.update(tags => [...tags, tag]);
      this.newTag.set('');
    }
  }

  removeTag(tag: string) {
    this.selectedTags.update(tags => tags.filter(t => t !== tag));
  }

  async presentMediaOptions() {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Add Media',
      buttons: [
        {
          text: 'Take Photo',
          icon: 'camera',
          handler: () => this.takePhoto()
        },
        {
          text: 'Choose from Gallery',
          icon: 'image',
          handler: () => this.selectFromGallery()
        },
        {
          text: 'Record Video',
          icon: 'videocam',
          handler: () => this.recordVideo()
        },
        {
          text: 'Cancel',
          role: 'cancel',
          icon: 'close'
        }
      ]
    });

    await actionSheet.present();
  }

  private async takePhoto() {
    // Implementation would use Capacitor Camera plugin
    console.log('Take photo');
    // For now, just show a placeholder
    this.showToast('Photo capture not implemented yet', 'warning');
  }

  private async selectFromGallery() {
    // Implementation would use file input or Capacitor
    console.log('Select from gallery');
    this.showToast('Gallery selection not implemented yet', 'warning');
  }

  private async recordVideo() {
    // Implementation would use Capacitor Camera plugin for video
    console.log('Record video');
    this.showToast('Video recording not implemented yet', 'warning');
  }

  removeMedia(index: number) {
    this.uploadedMedia.update(media => media.filter((_, i) => i !== index));
  }

  getCategoryIcon(category: string): string {
    const cat = this.categories.find(c => c.value === category);
    return cat?.icon || 'bookmark';
  }

  getStatusColor(status: string): string {
    const statusOption = this.statusOptions.find(s => s.value === status);
    return statusOption?.color || 'medium';
  }

  goBack() {
    if (this.isEditing) {
      this.router.navigate(['/family', this.familySlug, 'memories', 'milestones', this.milestoneId]);
    } else {
      this.router.navigate(['/family', this.familySlug, 'memories', 'milestones']);
    }
  }

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(field => {
      const control = formGroup.get(field);
      control?.markAsTouched({ onlySelf: true });
    });
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

  // Form validation helpers
  isFieldInvalid(fieldName: string): boolean {
    const field = this.milestoneForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.milestoneForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['minlength']) return `${fieldName} is too short`;
      if (field.errors['maxlength']) return `${fieldName} is too long`;
      if (field.errors['min']) return `${fieldName} must be positive`;
    }
    return '';
  }
}