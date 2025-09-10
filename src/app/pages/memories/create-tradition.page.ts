import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonBackButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonIcon, IonChip, IonText, IonItem, IonList, IonLabel, IonInput,
  IonTextarea, IonSelect, IonSelectOption, IonDatetime, IonCheckbox,
  IonToggle, IonSpinner, IonGrid, IonRow, IonCol, IonFab, IonFabButton,
  IonAccordion, IonAccordionGroup
} from '@ionic/angular/standalone';
import { ToastController, ActionSheetController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  refresh, gift, people, calendar, person, tag, image, videocam,
  add, close, save, camera, folder, checkmark, remove, settings
} from 'ionicons/icons';
import { TraditionService } from '../../core/services/memories/tradition.service';
import { 
  CreateTraditionRequest, TraditionCategory, TraditionStatus, TraditionFrequency 
} from '../../models/memories/memory.models';

@Component({
  selector: 'app-create-tradition',
  templateUrl: './create-tradition.page.html',
  styleUrls: ['./create-tradition.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonBackButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonIcon, IonChip, IonText, IonItem, IonList, IonLabel, IonInput,
    IonTextarea, IonSelect, IonSelectOption, IonDatetime, IonCheckbox,
    IonToggle, IonSpinner, IonGrid, IonRow, IonCol, IonFab, IonFabButton,
    IonAccordion, IonAccordionGroup
  ]
})
export class CreateTraditionPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private traditionService = inject(TraditionService);
  private toastCtrl = inject(ToastController);
  private actionSheetCtrl = inject(ActionSheetController);

  familySlug = '';
  traditionId = '';
  isEditing = false;
  
  traditionForm!: FormGroup;
  loading = signal(false);
  submitting = signal(false);
  
  // Form sections
  selectedParticipants = signal<string[]>([]);
  selectedTags = signal<string[]>([]);
  uploadedMedia = signal<any[]>([]);
  newTag = signal('');
  
  // Categories and options
  categories: { value: TraditionCategory; label: string; icon: string }[] = [
    { value: 'holiday', label: 'Holiday', icon: 'gift' },
    { value: 'celebration', label: 'Celebration', icon: 'star' },
    { value: 'ritual', label: 'Ritual', icon: 'refresh-circle' },
    { value: 'gathering', label: 'Family Gathering', icon: 'people' },
    { value: 'cultural', label: 'Cultural', icon: 'library' },
    { value: 'religious', label: 'Religious', icon: 'book' },
    { value: 'seasonal', label: 'Seasonal', icon: 'leaf' },
    { value: 'anniversary', label: 'Anniversary', icon: 'heart' },
    { value: 'other', label: 'Other', icon: 'bookmark' }
  ];

  statusOptions: { value: TraditionStatus; label: string; color: string }[] = [
    { value: 'active', label: 'Active', color: 'success' },
    { value: 'paused', label: 'Paused', color: 'warning' },
    { value: 'inactive', label: 'Inactive', color: 'medium' }
  ];

  frequencyOptions: { value: TraditionFrequency; label: string; description: string }[] = [
    { value: 'yearly', label: 'Yearly', description: 'Once per year' },
    { value: 'monthly', label: 'Monthly', description: 'Once per month' },
    { value: 'weekly', label: 'Weekly', description: 'Once per week' },
    { value: 'custom', label: 'Custom', description: 'Custom schedule' }
  ];

  constructor() {
    addIcons({ 
      refresh, gift, people, calendar, person, tag, image, videocam,
      add, close, save, camera, folder, checkmark, remove, settings
    });
  }

  ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.traditionId = this.route.snapshot.paramMap.get('traditionId') || '';
    this.isEditing = !!this.traditionId;
    
    this.initializeForm();
    
    if (this.isEditing) {
      this.loadTradition();
    }
  }

  private initializeForm() {
    this.traditionForm = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      description: ['', [Validators.maxLength(1000)]],
      category: ['celebration', [Validators.required]],
      status: ['active', [Validators.required]],
      frequency: ['yearly', [Validators.required]],
      startDate: [new Date().toISOString(), [Validators.required]],
      nextOccurrence: [''],
      location: [''],
      instructions: ['', [Validators.maxLength(2000)]],
      significance: ['', [Validators.maxLength(1000)]],
      isPrivate: [false],
      allowComments: [true],
      requiresPreparation: [false],
      preparationTime: [0],
      preparationNotes: ['']
    });
  }

  private async loadTradition() {
    this.loading.set(true);
    
    try {
      const tradition = await this.traditionService.getTradition(this.familySlug, this.traditionId).toPromise();
      if (tradition) {
        this.traditionForm.patchValue({
          title: tradition.title,
          description: tradition.description,
          category: tradition.category,
          status: tradition.status,
          frequency: tradition.frequency,
          startDate: tradition.startDate,
          nextOccurrence: tradition.nextOccurrence,
          location: tradition.location,
          instructions: tradition.instructions,
          significance: tradition.significance,
          isPrivate: tradition.visibility === 'private',
          allowComments: tradition.allowComments,
          requiresPreparation: tradition.requiresPreparation,
          preparationTime: tradition.preparationTime,
          preparationNotes: tradition.preparationNotes
        });

        this.selectedParticipants.set(tradition.participants?.map(p => p.id) || []);
        this.selectedTags.set(tradition.tags?.map(t => t.name) || []);
        this.uploadedMedia.set(tradition.media || []);
      }
    } catch (error) {
      console.error('Error loading tradition:', error);
      this.showToast('Failed to load tradition', 'danger');
      this.router.navigate(['/family', this.familySlug, 'memories', 'traditions']);
    } finally {
      this.loading.set(false);
    }
  }

  async submitForm() {
    if (this.traditionForm.invalid) {
      this.markFormGroupTouched(this.traditionForm);
      this.showToast('Please fill in all required fields', 'warning');
      return;
    }

    this.submitting.set(true);

    try {
      const formValue = this.traditionForm.value;
      const traditionData: CreateTraditionRequest = {
        title: formValue.title,
        description: formValue.description,
        category: formValue.category,
        status: formValue.status,
        frequency: formValue.frequency,
        startDate: formValue.startDate,
        nextOccurrence: formValue.nextOccurrence,
        location: formValue.location,
        instructions: formValue.instructions,
        significance: formValue.significance,
        visibility: formValue.isPrivate ? 'private' : 'family',
        allowComments: formValue.allowComments,
        requiresPreparation: formValue.requiresPreparation,
        preparationTime: formValue.preparationTime,
        preparationNotes: formValue.preparationNotes,
        participantIds: this.selectedParticipants(),
        tags: this.selectedTags(),
        media: this.uploadedMedia()
      };

      let result;
      if (this.isEditing) {
        result = await this.traditionService.updateTradition(this.familySlug, this.traditionId, traditionData).toPromise();
      } else {
        result = await this.traditionService.createTradition(this.familySlug, traditionData).toPromise();
      }

      if (result) {
        this.showToast(
          this.isEditing ? 'Tradition updated successfully!' : 'Tradition created successfully!',
          'success'
        );
        this.router.navigate(['/family', this.familySlug, 'memories', 'traditions', result.id]);
      }
    } catch (error) {
      console.error('Error saving tradition:', error);
      this.showToast(
        this.isEditing ? 'Failed to update tradition' : 'Failed to create tradition',
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

  calculateNextOccurrence() {
    const frequency = this.traditionForm.get('frequency')?.value;
    const startDate = this.traditionForm.get('startDate')?.value;
    
    if (!frequency || !startDate) return;

    const start = new Date(startDate);
    const now = new Date();
    let next = new Date(start);

    switch (frequency) {
      case 'yearly':
        next.setFullYear(now.getFullYear());
        if (next < now) next.setFullYear(now.getFullYear() + 1);
        break;
      case 'monthly':
        next.setMonth(now.getMonth());
        next.setFullYear(now.getFullYear());
        if (next < now) next.setMonth(now.getMonth() + 1);
        break;
      case 'weekly':
        const daysDiff = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const weeksPassed = Math.floor(daysDiff / 7);
        next = new Date(start.getTime() + ((weeksPassed + 1) * 7 * 24 * 60 * 60 * 1000));
        break;
    }

    this.traditionForm.patchValue({
      nextOccurrence: next.toISOString()
    });
  }

  getCategoryIcon(category: string): string {
    const cat = this.categories.find(c => c.value === category);
    return cat?.icon || 'bookmark';
  }

  getStatusColor(status: string): string {
    const statusOption = this.statusOptions.find(s => s.value === status);
    return statusOption?.color || 'medium';
  }

  getFrequencyDescription(frequency: string): string {
    const freq = this.frequencyOptions.find(f => f.value === frequency);
    return freq?.description || '';
  }

  goBack() {
    if (this.isEditing) {
      this.router.navigate(['/family', this.familySlug, 'memories', 'traditions', this.traditionId]);
    } else {
      this.router.navigate(['/family', this.familySlug, 'memories', 'traditions']);
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
    const field = this.traditionForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.traditionForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return `${fieldName} is required`;
      if (field.errors['minlength']) return `${fieldName} is too short`;
      if (field.errors['maxlength']) return `${fieldName} is too long`;
    }
    return '';
  }
}