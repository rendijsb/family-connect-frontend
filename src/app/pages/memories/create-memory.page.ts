import { Component, OnInit, inject, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { 
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonBackButton, IonItem, IonLabel, IonInput, IonTextarea, IonSelect,
  IonSelectOption, IonChip, IonIcon, IonCard, IonCardContent, IonCardHeader,
  IonCardTitle, IonList, IonCheckbox, IonDatetime, IonModal, IonImg,
  IonThumbnail, IonGrid, IonRow, IonCol, IonFab, IonFabButton, IonNote,
  IonSegment, IonSegmentButton, IonAvatar, IonToggle
} from '@ionic/angular/standalone';
import { ToastController, LoadingController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  save, camera, images, videocam, document, location, person,
  add, close, checkmark, calendar, star, starOutline, eye, eyeOff,
  people, tag, map
} from 'ionicons/icons';
import { MemoryService } from '../../core/services/memories/memory.service';
import { FamilyService } from '../../core/services/family/family.service';
import {
  CreateMemoryRequest,
  MemoryType,
  MemoryVisibility,
  MemoryLocation,
  MemoryMedia
} from '../../models/memories/memory.models';

@Component({
  selector: 'app-create-memory',
  templateUrl: './create-memory.page.html',
  styleUrls: ['./create-memory.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonBackButton, IonItem, IonLabel, IonInput, IonTextarea, IonSelect,
    IonSelectOption, IonChip, IonIcon, IonCard, IonCardContent, IonCardHeader,
    IonCardTitle, IonList, IonCheckbox, IonDatetime, IonModal, IonImg,
    IonThumbnail, IonGrid, IonRow, IonCol, IonFab, IonFabButton, IonNote,
    IonSegment, IonSegmentButton, IonAvatar, IonToggle
  ]
})
export class CreateMemoryPage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private memoryService = inject(MemoryService);
  private familyService = inject(FamilyService);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);

  @ViewChild(IonModal) participantsModal!: IonModal;
  @ViewChild(IonModal) locationModal!: IonModal;

  familySlug = '';
  memoryForm: FormGroup;
  
  loading = signal(false);
  currentStep = signal(1);
  totalSteps = 4;
  
  // Media
  selectedFiles = signal<File[]>([]);
  mediaPreviews = signal<{file: File, preview: string, type: string}[]>([]);
  
  // Family members
  familyMembers = signal<any[]>([]);
  selectedParticipants = signal<number[]>([]);
  
  // Location
  selectedLocation = signal<MemoryLocation | null>(null);
  
  // Tags
  availableTags = signal<string[]>([]);
  selectedTags = signal<string[]>([]);
  newTag = signal('');

  // Memory types
  memoryTypes: { value: MemoryType, label: string, icon: string, description: string }[] = [
    { value: 'general', label: 'General Memory', icon: 'bookmark', description: 'A regular family moment' },
    { value: 'milestone', label: 'Milestone', icon: 'star', description: 'An important achievement or event' },
    { value: 'birthday', label: 'Birthday', icon: 'gift', description: 'Birthday celebration' },
    { value: 'vacation', label: 'Vacation', icon: 'airplane', description: 'Travel and vacation memories' },
    { value: 'holiday', label: 'Holiday', icon: 'calendar', description: 'Holiday celebrations' },
    { value: 'achievement', label: 'Achievement', icon: 'trophy', description: 'Personal or family accomplishment' },
    { value: 'first_time', label: 'First Time', icon: 'sparkles', description: 'A first-time experience' },
    { value: 'funny_moment', label: 'Funny Moment', icon: 'happy', description: 'Humorous family moment' },
    { value: 'anniversary', label: 'Anniversary', icon: 'heart', description: 'Wedding or relationship anniversary' },
    { value: 'tradition', label: 'Tradition', icon: 'refresh', description: 'Family tradition or ritual' },
    { value: 'story', label: 'Story', icon: 'book', description: 'A family story or anecdote' },
    { value: 'life_lesson', label: 'Life Lesson', icon: 'school', description: 'Teaching moment or wisdom shared' }
  ];

  constructor() {
    addIcons({ 
      save, camera, images, videocam, document, location, person,
      add, close, checkmark, calendar, star, starOutline, eye, eyeOff,
      people, tag, map
    });

    this.memoryForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', Validators.maxLength(2000)],
      type: ['general', Validators.required],
      memoryDate: [new Date().toISOString(), Validators.required],
      visibility: ['family', Validators.required],
      visibleTo: [[]],
      isFeatured: [false]
    });
  }

  ngOnInit() {
    this.familySlug = this.route.snapshot.paramMap.get('slug') || '';
    this.loadFamilyMembers();
    this.loadAvailableTags();
  }

  async loadFamilyMembers() {
    try {
      const family = await this.familyService.getFamilyBySlug(this.familySlug).toPromise();
      // Assuming family has members
      this.familyMembers.set(family?.members || []);
    } catch (error) {
      console.error('Error loading family members:', error);
    }
  }

  async loadAvailableTags() {
    // In a real implementation, this would load popular tags from the API
    this.availableTags.set([
      'fun', 'love', 'celebration', 'adventure', 'learning', 'growth',
      'together', 'memories', 'special', 'funny', 'sweet', 'proud'
    ]);
  }

  // Navigation methods
  nextStep() {
    if (this.currentStep() < this.totalSteps) {
      this.currentStep.update(step => step + 1);
    }
  }

  previousStep() {
    if (this.currentStep() > 1) {
      this.currentStep.update(step => step - 1);
    }
  }

  goToStep(step: number) {
    this.currentStep.set(step);
  }

  // Media handling
  async onFileSelect(event: any) {
    const files = Array.from(event.target.files) as File[];
    
    for (const file of files) {
      if (this.isValidFile(file)) {
        this.selectedFiles.update(current => [...current, file]);
        
        // Create preview
        const preview = await this.createPreview(file);
        this.mediaPreviews.update(current => [...current, {
          file,
          preview,
          type: this.getFileType(file)
        }]);
      }
    }
  }

  removeFile(index: number) {
    this.selectedFiles.update(current => current.filter((_, i) => i !== index));
    this.mediaPreviews.update(current => current.filter((_, i) => i !== index));
  }

  private isValidFile(file: File): boolean {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/', 'video/', 'audio/'];
    
    if (file.size > maxSize) {
      this.showToast('File size must be less than 10MB', 'danger');
      return false;
    }
    
    if (!allowedTypes.some(type => file.type.startsWith(type))) {
      this.showToast('Only images, videos, and audio files are allowed', 'danger');
      return false;
    }
    
    return true;
  }

  private async createPreview(file: File): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  }

  private getFileType(file: File): string {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  }

  // Participants handling
  openParticipantsModal() {
    this.participantsModal.present();
  }

  toggleParticipant(memberId: number) {
    this.selectedParticipants.update(current => {
      const index = current.indexOf(memberId);
      if (index > -1) {
        return current.filter(id => id !== memberId);
      } else {
        return [...current, memberId];
      }
    });
  }

  // Location handling
  openLocationModal() {
    this.locationModal.present();
  }

  setLocation(location: MemoryLocation) {
    this.selectedLocation.set(location);
    this.locationModal.dismiss();
  }

  clearLocation() {
    this.selectedLocation.set(null);
  }

  // Tags handling
  addTag(tag: string) {
    if (tag && !this.selectedTags().includes(tag)) {
      this.selectedTags.update(current => [...current, tag]);
    }
  }

  removeTag(tag: string) {
    this.selectedTags.update(current => current.filter(t => t !== tag));
  }

  addNewTag() {
    const tag = this.newTag().trim();
    if (tag) {
      this.addTag(tag);
      this.newTag.set('');
    }
  }

  // Visibility handling
  onVisibilityChange() {
    const visibility = this.memoryForm.get('visibility')?.value;
    if (visibility !== 'specific_members') {
      this.memoryForm.patchValue({ visibleTo: [] });
    }
  }

  // Form submission
  async saveMemory() {
    if (this.memoryForm.invalid) {
      this.showToast('Please fill in all required fields', 'danger');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Creating memory...'
    });
    await loading.present();

    try {
      const formValue = this.memoryForm.value;
      
      const memoryData: CreateMemoryRequest = {
        title: formValue.title,
        description: formValue.description,
        type: formValue.type,
        memoryDate: new Date(formValue.memoryDate).toISOString().split('T')[0],
        visibility: formValue.visibility,
        participants: this.selectedParticipants(),
        media: this.selectedFiles(),
        location: this.selectedLocation(),
        tags: this.selectedTags(),
        visibleTo: formValue.visibility === 'specific_members' ? formValue.visibleTo : undefined,
        isFeatured: formValue.isFeatured
      };

      const memory = await this.memoryService.createMemory(this.familySlug, memoryData).toPromise();
      
      this.showToast('Memory created successfully!', 'success');
      this.router.navigate(['/family', this.familySlug, 'memories', memory?.id]);
      
    } catch (error) {
      console.error('Error creating memory:', error);
      this.showToast('Failed to create memory. Please try again.', 'danger');
    } finally {
      loading.dismiss();
    }
  }

  async saveDraft() {
    // Save as draft functionality
    // This would store the form data locally for later completion
    const formData = {
      ...this.memoryForm.value,
      participants: this.selectedParticipants(),
      location: this.selectedLocation(),
      tags: this.selectedTags(),
      media: this.mediaPreviews()
    };
    
    localStorage.setItem(`memory_draft_${this.familySlug}`, JSON.stringify(formData));
    this.showToast('Draft saved', 'success');
  }

  // Validation helpers
  isStepValid(step: number): boolean {
    switch (step) {
      case 1:
        return this.memoryForm.get('title')?.valid && 
               this.memoryForm.get('type')?.valid && 
               this.memoryForm.get('memoryDate')?.valid;
      case 2:
        return true; // Media is optional
      case 3:
        return true; // Details are optional
      case 4:
        return this.memoryForm.get('visibility')?.valid;
      default:
        return false;
    }
  }

  canProceed(): boolean {
    return this.isStepValid(this.currentStep());
  }

  getStepTitle(step: number): string {
    const titles = ['Basic Info', 'Add Media', 'Details', 'Privacy & Share'];
    return titles[step - 1];
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
}