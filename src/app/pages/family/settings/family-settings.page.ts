import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonButtons,
  IonIcon,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonList,
  IonItemDivider,
  IonBackButton,
  IonAlert,
  IonActionSheet,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  settingsOutline,
  saveOutline,
  trashOutline,
  lockClosedOutline,
  globeOutline,
  keyOutline,
  peopleOutline,
  timeOutline,
  languageOutline,
  notificationsOutline,
  warningOutline,
  informationCircleOutline,
  checkmarkCircleOutline,
} from 'ionicons/icons';

import { FamilyService } from '../../../core/services/family/family.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  Family,
  FamilyRoleEnum,
  FamilyPrivacyEnum,
} from '../../../models/families/family.models';

@Component({
  selector: 'app-family-settings',
  templateUrl: './family-settings.page.html',
  styleUrls: ['./family-settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonButtons,
    IonIcon,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonList,
    IonItemDivider,
    IonBackButton,
    IonRefresher,
    IonRefresherContent,
  ],
})
export class FamilySettingsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly familyService = inject(FamilyService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  // Signals for reactive state management
  readonly family = signal<Family | null>(null);
  readonly joinCode = signal<string | null>(null);
  readonly isLoading = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);
  readonly familySlug = signal<string>('');

  // Form groups
  familyForm!: FormGroup;
  securityForm!: FormGroup;
  notificationForm!: FormGroup;

  // Enums for templates
  readonly FamilyPrivacyEnum = FamilyPrivacyEnum;
  readonly FamilyRoleEnum = FamilyRoleEnum;

  // Options
  readonly timezones = [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'Eastern Time' },
    { value: 'America/Chicago', label: 'Central Time' },
    { value: 'America/Denver', label: 'Mountain Time' },
    { value: 'America/Los_Angeles', label: 'Pacific Time' },
    { value: 'Europe/London', label: 'GMT' },
    { value: 'Europe/Paris', label: 'Central European Time' },
    { value: 'Asia/Tokyo', label: 'Japan Standard Time' },
    { value: 'Australia/Sydney', label: 'Australian Eastern Time' },
  ];

  readonly languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ja', label: 'Japanese' },
    { value: 'zh', label: 'Chinese' },
  ];

  constructor() {
    this.addIcons();
    this.initializeForms();
  }

  ngOnInit() {
    this.familySlug.set(this.route.snapshot.paramMap.get('slug') || '');
    this.loadFamily();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private addIcons() {
    addIcons({
      arrowBackOutline,
      settingsOutline,
      saveOutline,
      trashOutline,
      lockClosedOutline,
      globeOutline,
      keyOutline,
      peopleOutline,
      timeOutline,
      languageOutline,
      notificationsOutline,
      warningOutline,
      informationCircleOutline,
      checkmarkCircleOutline,
    });
  }

  private initializeForms() {
    this.familyForm = this.formBuilder.group({
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(50),
        ],
      ],
      description: ['', [Validators.maxLength(500)]],
      privacy: [FamilyPrivacyEnum.PRIVATE, [Validators.required]],
      timezone: ['UTC', [Validators.required]],
      language: ['en', [Validators.required]],
      maxMembers: [
        20,
        [Validators.required, Validators.min(2), Validators.max(100)],
      ],
    });

    this.securityForm = this.formBuilder.group({
      joinCodeEnabled: [true],
      autoApproveInvitations: [false],
      requireApprovalForJoining: [true],
    });

    this.notificationForm = this.formBuilder.group({
      emailNotifications: [true],
      pushNotifications: [true],
      activityDigest: [true],
      memberJoined: [true],
      newMessage: [true],
      eventReminders: [true],
    });
  }

  private loadFamily() {
    this.isLoading.set(true);

    this.familyService
      .getFamilyBySlug(this.familySlug())
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (response) => {
          this.family.set(response.data);
          this.joinCode.set(response.data.joinCode || null);
          this.populateForms(response.data);
        },
        error: async (error) => {
          console.error('Load family error:', error);
          if (error.status === 404) {
            await this.toastService.showToast('Family not found.', 'danger');
          } else if (error.status === 403) {
            await this.toastService.showToast(
              'You do not have access to family settings.',
              'danger'
            );
          } else {
            await this.toastService.showToast(
              'Failed to load family settings.',
              'danger'
            );
          }
          await this.router.navigate(['/tabs/family']);
        },
      });
  }

  private populateForms(family: Family) {
    this.familyForm.patchValue({
      name: family.name,
      description: family.description || '',
      privacy: family.privacy,
      timezone: family.timezone || 'UTC',
      language: family.language || 'en',
      maxMembers: family.maxMembers || 20,
    });

    // Populate security settings from family.settings
    if (family.settings) {
      this.securityForm.patchValue({
        joinCodeEnabled: family.settings.joinCodeEnabled !== false,
        autoApproveInvitations: family.settings.autoApproveInvitations === true,
        requireApprovalForJoining:
          family.settings.requireApprovalForJoining !== false,
      });

      this.notificationForm.patchValue({
        emailNotifications: family.settings.emailNotifications !== false,
        pushNotifications: family.settings.pushNotifications !== false,
        activityDigest: family.settings.activityDigest !== false,
        memberJoined: family.settings.memberJoined !== false,
        newMessage: family.settings.newMessage !== false,
        eventReminders: family.settings.eventReminders !== false,
      });
    }
  }

  async saveBasicSettings() {
    if (this.familyForm.invalid) {
      await this.toastService.showToast(
        'Please fix the form errors before saving.',
        'warning'
      );
      return;
    }

    this.isSaving.set(true);
    const formData = this.familyForm.value;

    this.familyService
      .updateFamily(this.familySlug(), {
        name: formData.name,
        description: formData.description,
        privacy: formData.privacy,
        timezone: formData.timezone,
        language: formData.language,
        maxMembers: formData.maxMembers,
      })
      .pipe(
        finalize(() => this.isSaving.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async (response) => {
          this.family.set(response.data);
          await this.toastService.showToast(
            'Family settings updated successfully!',
            'success'
          );
        },
        error: async (error) => {
          console.error('Update family error:', error);
          await this.toastService.showToast(
            'Failed to update family settings.',
            'danger'
          );
        },
      });
  }

  async saveSecuritySettings() {
    this.isSaving.set(true);
    const family = this.family();
    const securityData = this.securityForm.value;

    const updatedSettings = {
      ...family?.settings,
      joinCodeEnabled: securityData.joinCodeEnabled,
      autoApproveInvitations: securityData.autoApproveInvitations,
      requireApprovalForJoining: securityData.requireApprovalForJoining,
    };

    this.familyService
      .updateFamily(this.familySlug(), {
        settings: updatedSettings,
      })
      .pipe(
        finalize(() => this.isSaving.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async (response) => {
          this.family.set(response.data);
          await this.toastService.showToast(
            'Security settings updated successfully!',
            'success'
          );
        },
        error: async (error) => {
          console.error('Update security settings error:', error);
          await this.toastService.showToast(
            'Failed to update security settings.',
            'danger'
          );
        },
      });
  }

  async saveNotificationSettings() {
    this.isSaving.set(true);
    const family = this.family();
    const notificationData = this.notificationForm.value;

    const updatedSettings = {
      ...family?.settings,
      emailNotifications: notificationData.emailNotifications,
      pushNotifications: notificationData.pushNotifications,
      activityDigest: notificationData.activityDigest,
      memberJoined: notificationData.memberJoined,
      newMessage: notificationData.newMessage,
      eventReminders: notificationData.eventReminders,
    };

    this.familyService
      .updateFamily(this.familySlug(), {
        settings: updatedSettings,
      })
      .pipe(
        finalize(() => this.isSaving.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async (response) => {
          this.family.set(response.data);
          await this.toastService.showToast(
            'Notification settings updated successfully!',
            'success'
          );
        },
        error: async (error) => {
          console.error('Update notification settings error:', error);
          await this.toastService.showToast(
            'Failed to update notification settings.',
            'danger'
          );
        },
      });
  }

  async generateNewJoinCode() {
    const family = this.family();
    if (!family) return;

    const confirmed = await this.toastService.showDestructiveConfirmation(
      'Generate New Join Code',
      'This will invalidate the current join code. Are you sure?'
    );

    if (confirmed) {
      const loading = await this.toastService.showLoading(
        'Generating new join code...'
      );

      this.familyService
        .generateJoinCode(family.slug)
        .pipe(
          finalize(() => loading.dismiss()),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: async (response) => {
            this.joinCode.set(response.data.joinCode);
            await this.toastService.showToast(
              'New join code generated successfully!',
              'success'
            );
          },
          error: async (error) => {
            console.error('Generate join code error:', error);
            await this.toastService.showToast(
              'Failed to generate new join code.',
              'danger'
            );
          },
        });
    }
  }

  async deleteFamily() {
    const family = this.family();
    if (!family) return;

    const confirmed = await this.toastService.showDeleteConfirmation(
      family.name,
      'Family'
    );
    if (confirmed) {
      const loading = await this.toastService.showLoading('Deleting family...');

      this.familyService
        .deleteFamily(family.slug)
        .pipe(
          finalize(() => loading.dismiss()),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: async () => {
            await this.toastService.showToast(
              'Family deleted successfully.',
              'success'
            );
            await this.router.navigate(['/tabs/family']);
          },
          error: async (error) => {
            console.error('Delete family error:', error);
            await this.toastService.showToast(
              'Failed to delete family.',
              'danger'
            );
          },
        });
    }
  }

  doRefresh(event: any) {
    this.familyService
      .getFamilyBySlug(this.familySlug())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.family.set(response.data);
          this.populateForms(response.data);
          event.target.complete();
        },
        error: () => {
          event.target.complete();
          this.toastService.showToast(
            'Failed to refresh family settings.',
            'danger'
          );
        },
      });
  }

  goBack() {
    this.router.navigate(['/family', this.familySlug()]);
  }

  canDeleteFamily(): boolean {
    const family = this.family();
    const currentUser = this.authService.user();
    return !!family && !!currentUser && family.ownerId === currentUser.id;
  }

  getPrivacyLabel(privacy: FamilyPrivacyEnum): string {
    switch (privacy) {
      case FamilyPrivacyEnum.PUBLIC:
        return 'Public';
      case FamilyPrivacyEnum.PRIVATE:
        return 'Private';
      case FamilyPrivacyEnum.INVITE_ONLY:
        return 'Invite Only';
      default:
        return 'Unknown';
    }
  }

  getPrivacyDescription(privacy: FamilyPrivacyEnum): string {
    switch (privacy) {
      case FamilyPrivacyEnum.PUBLIC:
        return 'Anyone can find and join this family';
      case FamilyPrivacyEnum.PRIVATE:
        return 'Only people with the join code can join';
      case FamilyPrivacyEnum.INVITE_ONLY:
        return 'Only invited members can join';
      default:
        return '';
    }
  }
}
