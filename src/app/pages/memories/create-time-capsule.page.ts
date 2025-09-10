import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonBackButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonIcon, IonChip, IonText, IonItem, IonList, IonLabel, IonInput,
  IonTextarea, IonSelect, IonSelectOption, IonDatetime, IonCheckbox,
  IonToggle, IonSpinner, IonGrid, IonRow, IonCol, IonFab, IonFabButton,
  IonAccordion, IonAccordionGroup, IonNote, IonProgressBar
} from '@ionic/angular/standalone';
import { ToastController, ActionSheetController, AlertController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  archive, lockClosed, time, gift, calendar, person, tag, image, videocam,
  add, close, save, camera, folder, checkmark, remove, warning, informationCircle
} from 'ionicons/icons';
import { TimeCapsuleService } from '../../core/services/memories/time-capsule.service';
import { 
  CreateTimeCapsuleRequest
} from '../../models/memories/memory.models';

@Component({
  selector: 'app-create-time-capsule',
  templateUrl: './create-time-capsule.page.html',
  styleUrls: ['./create-time-capsule.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonBackButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonIcon, IonChip, IonText, IonItem, IonList, IonLabel, IonInput,
    IonTextarea, IonSelect, IonSelectOption, IonDatetime, IonCheckbox,
    IonToggle, IonSpinner, IonGrid, IonRow, IonCol, IonFab, IonFabButton,
    IonAccordion, IonAccordionGroup, IonNote, IonProgressBar
  ]
})
export class CreateTimeCapsulePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private timeCapsuleService = inject(TimeCapsuleService);
  private toastCtrl = inject(ToastController);
  private actionSheetCtrl = inject(ActionSheetController);
  private alertCtrl = inject(AlertController);

  familySlug = '';
  capsuleId = '';
  isEditing = false;
  
  capsuleForm!: FormGroup;
  loading = signal(false);
  submitting = signal(false);
  
  // Form sections
  selectedContributors = signal<string[]>([]);
  selectedTags = signal<string[]>([]);
  uploadedMedia = signal<any[]>([]);
  newTag = signal('');
  
  // Initial contributions
  initialContributions = signal<any[]>([]);
  newContribution = signal('');
  selectedContributionType = signal<'text' | 'image' | 'video' | 'audio' | 'letter' | 'prediction'>('text');

  // Time calculations
  daysUntilOpen = computed(() => {
    const openDate = this.capsuleForm?.get('openDate')?.value;
    if (!openDate) return null;
    
    const now = new Date();
    const target = new Date(openDate);
    const diffTime = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  });

  yearsUntilOpen = computed(() => {
    const days = this.daysUntilOpen();
    return days ? Math.round(days / 365 * 10) / 10 : 0;
  });

  contributionTypes = [
    { value: 'text', label: 'Text Message', icon: 'document-text' },
    { value: 'letter', label: 'Letter', icon: 'mail' },
    { value: 'prediction', label: 'Future Prediction', icon: 'crystal-ball' },
    { value: 'image', label: 'Photo', icon: 'image' },
    { value: 'video', label: 'Video', icon: 'videocam' },
    { value: 'audio', label: 'Voice Message', icon: 'musical-notes' }
  ];

  constructor() {
    addIcons({ 
      archive, lockClosed, time, gift, calendar, person, tag, image, videocam,
      add, close, save, camera, folder, checkmark, remove, warning, informationCircle
    });
  }

  ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.capsuleId = this.route.snapshot.paramMap.get('capsuleId') || '';
    this.isEditing = !!this.capsuleId;
    
    this.initializeForm();
    
    if (this.isEditing) {
      this.loadTimeCapsule();
    }
  }

  private initializeForm() {
    // Default to 1 year from now
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    this.capsuleForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(1000)]],
      openDate: [oneYearFromNow.toISOString(), [Validators.required, this.futureDateValidator]],
      message: ['', [Validators.maxLength(2000)]],
      location: [''],
      isPrivate: [false],
      allowComments: [true],
      allowContributions: [true],
      contributionDeadline: [''],
      maxContributions: [null],
      reminderFrequency: ['monthly']
    });
  }

  private futureDateValidator(control: any) {
    const selectedDate = new Date(control.value);
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time for fair comparison
    
    if (selectedDate <= now) {
      return { futureDate: true };
    }
    return null;
  }

  private async loadTimeCapsule() {
    this.loading.set(true);
    
    try {
      const capsule = await this.timeCapsuleService.getTimeCapsule(this.familySlug, this.capsuleId).toPromise();
      if (capsule) {
        // Only allow editing if not opened
        if (capsule.isOpened) {
          this.showToast('Cannot edit opened time capsule', 'warning');
          this.router.navigate(['/family', this.familySlug, 'memories', 'time-capsules', this.capsuleId]);
          return;
        }

        this.capsuleForm.patchValue({
          title: capsule.title,
          description: capsule.description,
          openDate: capsule.openDate,
          message: capsule.message,
          location: capsule.location,
          isPrivate: capsule.visibility === 'private',
          allowComments: capsule.allowComments,
          allowContributions: capsule.allowContributions,
          contributionDeadline: capsule.contributionDeadline,
          maxContributions: capsule.maxContributions,
          reminderFrequency: capsule.reminderFrequency
        });

        this.selectedContributors.set(capsule.contributors?.map(c => c.id) || []);
        this.selectedTags.set(capsule.tags?.map(t => t.name) || []);
        this.uploadedMedia.set(capsule.media || []);
      }
    } catch (error) {
      console.error('Error loading time capsule:', error);
      this.showToast('Failed to load time capsule', 'danger');
      this.router.navigate(['/family', this.familySlug, 'memories', 'time-capsules']);
    } finally {
      this.loading.set(false);
    }
  }

  async submitForm() {
    if (this.capsuleForm.invalid) {
      this.markFormGroupTouched(this.capsuleForm);
      this.showToast('Please fill in all required fields', 'warning');
      return;
    }

    // Show confirmation for long-term capsules
    const years = this.yearsUntilOpen();
    if (years && years > 5) {
      const confirmed = await this.showConfirmation(
        'Long-term Time Capsule',
        `This time capsule will be sealed for ${years} years. Are you sure about the opening date?`,
        'Confirm',
        'Review'
      );
      if (!confirmed) return;
    }

    this.submitting.set(true);

    try {
      const formValue = this.capsuleForm.value;
      const capsuleData: CreateTimeCapsuleRequest = {
        title: formValue.title,
        description: formValue.description,
        openDate: formValue.openDate,
        message: formValue.message,
        location: formValue.location,
        visibility: formValue.isPrivate ? 'private' : 'family',
        allowComments: formValue.allowComments,
        allowContributions: formValue.allowContributions,
        contributionDeadline: formValue.contributionDeadline,
        maxContributions: formValue.maxContributions,
        reminderFrequency: formValue.reminderFrequency,
        contributorIds: this.selectedContributors(),
        tags: this.selectedTags(),
        media: this.uploadedMedia(),
        initialContributions: this.initialContributions()
      };

      let result;
      if (this.isEditing) {
        result = await this.timeCapsuleService.updateTimeCapsule(this.familySlug, this.capsuleId, capsuleData).toPromise();
      } else {
        result = await this.timeCapsuleService.createTimeCapsule(this.familySlug, capsuleData).toPromise();
      }

      if (result) {
        this.showToast(
          this.isEditing ? 'Time capsule updated successfully!' : 'Time capsule created successfully!',
          'success'
        );
        this.router.navigate(['/family', this.familySlug, 'memories', 'time-capsules', result.id]);
      }
    } catch (error) {
      console.error('Error saving time capsule:', error);
      this.showToast(
        this.isEditing ? 'Failed to update time capsule' : 'Failed to create time capsule',
        'danger'
      );
    } finally {
      this.submitting.set(false);
    }
  }

  addInitialContribution() {
    const content = this.newContribution().trim();
    const type = this.selectedContributionType();
    
    if (!content) return;

    const contribution = {
      type,
      content,
      message: content,
      createdAt: new Date().toISOString()
    };

    this.initialContributions.update(contributions => [...contributions, contribution]);
    this.newContribution.set('');
  }

  removeInitialContribution(index: number) {
    this.initialContributions.update(contributions => contributions.filter((_, i) => i !== index));
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

  setQuickDate(years: number) {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + years);
    
    this.capsuleForm.patchValue({
      openDate: futureDate.toISOString()
    });
  }

  getContributionTypeIcon(type: string): string {
    const contribType = this.contributionTypes.find(t => t.value === type);
    return contribType?.icon || 'document-text';
  }

  getContributionTypeLabel(type: string): string {
    const contribType = this.contributionTypes.find(t => t.value === type);
    return contribType?.label || type;
  }

  getTimeUntilOpenText(): string {
    const days = this.daysUntilOpen();
    const years = this.yearsUntilOpen();
    
    if (!days) return 'Select opening date';
    if (days === 0) return 'Opens today';
    if (days === 1) return 'Opens tomorrow';
    if (days < 30) return `Opens in ${days} days`;
    if (days < 365) return `Opens in ${Math.round(days / 30)} months`;
    return `Opens in ${years} years`;
  }

  goBack() {
    if (this.isEditing) {
      this.router.navigate(['/family', this.familySlug, 'memories', 'time-capsules', this.capsuleId]);
    } else {
      this.router.navigate(['/family', this.familySlug, 'memories', 'time-capsules']);
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

  private async showConfirmation(header: string, message: string, confirmText: string, cancelText: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header,
        message,
        buttons: [
          {
            text: cancelText,
            role: 'cancel',
            handler: () => resolve(false)
          },
          {
            text: confirmText,
            handler: () => resolve(true)
          }
        ]
      });
      await alert.present();
    });
  }

  // Form validation helpers
  isFieldInvalid(fieldName: string): boolean {
    const field = this.capsuleForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.capsuleForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['minlength']) return `${fieldName} is too short`;
      if (field.errors['maxlength']) return `${fieldName} is too long`;
      if (field.errors['futureDate']) return `${fieldName} must be in the future`;
    }
    return '';
  }
}