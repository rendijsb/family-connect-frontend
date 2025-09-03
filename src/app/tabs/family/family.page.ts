import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent,
  IonButton, IonIcon, IonButtons, IonRefresher, IonRefresherContent,
  IonFab, IonFabButton, IonFabList, IonSkeletonText, IonAvatar
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  homeOutline, peopleOutline, addOutline, notificationsOutline,
  ellipsisVerticalOutline, ellipsisHorizontalOutline, eyeOutline,
  chatbubbleOutline, settingsOutline, timeOutline, globeOutline,
  lockClosedOutline, keyOutline, copyOutline, shareOutline,
  trashOutline, createOutline, exitOutline, personAddOutline,
  refreshOutline, closeOutline
} from 'ionicons/icons';

import { FamilyService } from '../../core/services/family/family.service';
import { AuthService } from '../../core/services/auth/auth.service';
import {
  Family,
  FamilyRoleEnum,
  FamilyPrivacyEnum,
  getFamilyRoleName
} from '../../models/families/family.models';
import {ToastService} from '../../shared/services/toast.service';
import {ModalController} from '@ionic/angular';
import {NotificationBadgeComponent} from '../../shared/components/notification-badge/notification-badge.component';

@Component({
  selector: 'app-family',
  templateUrl: './family.page.html',
  styleUrls: ['./family.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonCard, IonCardContent,
    IonButton, IonIcon, IonButtons, IonRefresher, IonRefresherContent,
    IonFab, IonFabButton, IonFabList, IonSkeletonText, IonAvatar, NotificationBadgeComponent
  ]
})
export class FamilyPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly router = inject(Router);
  private readonly familyService = inject(FamilyService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly modalController = inject(ModalController);

  // Signals for reactive state management
  readonly families = signal<Family[]>([]);
  readonly isLoading = signal<boolean>(false);

  constructor() {
    this.addIcons();
  }

  ngOnInit() {
    this.loadFamilies();
    this.subscribeToFamilies();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private addIcons() {
    addIcons({
      homeOutline, peopleOutline, addOutline, notificationsOutline,
      ellipsisVerticalOutline, ellipsisHorizontalOutline, eyeOutline,
      chatbubbleOutline, settingsOutline, timeOutline, globeOutline,
      lockClosedOutline, keyOutline, copyOutline, shareOutline,
      trashOutline, createOutline, exitOutline, personAddOutline,
      refreshOutline, closeOutline
    });
  }

  private subscribeToFamilies() {
    this.familyService.families$
      .pipe(takeUntil(this.destroy$))
      .subscribe(families => {
        this.families.set(families);
      });
  }

  private loadFamilies() {
    this.isLoading.set(true);
    this.familyService.getMyFamilies()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        error: (error) => {
          this.toastService.showToast('Failed to load families. Please try again.', 'danger');
        }
      });
  }

  // Event Handlers
  doRefresh(event: any) {
    this.familyService.getMyFamilies()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        complete: () => event.target.complete(),
        error: () => {
          event.target.complete();
          this.toastService.showToast('Failed to refresh families.', 'danger');
        }
      });
  }

  async createFamily() {
    await this.router.navigate(['/family/create']);
  }

  async joinFamily() {
    const joinCode = await this.toastService.showJoinCodeInput();
    if (joinCode) {
      this.handleJoinFamily(joinCode);
    }
  }

  private async handleJoinFamily(joinCode: string) {
    const loading = await this.toastService.showLoading('Joining family...');

    this.familyService.joinFamilyByCode({ joinCode })
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async (response) => {
          await this.toastService.showToast('Successfully joined family!', 'success');
          await this.router.navigate(['/family', response.data.slug]);
        },
        error: async (error) => {
          console.error('Join family error:', error);
          if (error.status === 404) {
            await this.toastService.showToast('Invalid join code. Please check and try again.', 'danger');
          } else if (error.status === 409) {
            await this.toastService.showToast('You are already a member of this family.', 'warning');
          } else {
            await this.toastService.showToast('Failed to join family. Please try again.', 'danger');
          }
        }
      });
  }

  async openFamily(family: Family, event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    if (!family.slug) {
      await this.toastService.showToast('Invalid family data', 'danger');
      return;
    }

    if (!family.currentUserRole) {
      await this.toastService.showToast('You do not have access to this family', 'danger');
      return;
    }

    try {
      await this.router.navigate(['/family', family.slug]);
    } catch (error) {
      await this.toastService.showToast('Failed to open family page', 'danger');
    }
  }

  async openFamilyChat(family: Family, event: Event) {
    event.stopPropagation();
    await this.router.navigate(['/family', family.slug, 'chat']);
  }

  async openFamilySettings(family: Family, event: Event) {
    event.stopPropagation();
    await this.router.navigate(['/family', family.slug, 'settings']);
  }

  async presentFamilyOptions() {
    await this.toastService.showActionSheet('Family Options', [
      {
        text: 'Create New Family',
        icon: 'home-outline',
        handler: () => this.createFamily()
      },
      {
        text: 'Join Family',
        icon: 'people-outline',
        handler: () => this.joinFamily()
      },
      {
        text: 'View Invitations',
        icon: 'mail-outline',
        handler: () => this.viewInvitations()
      },
      {
        text: 'Refresh',
        icon: 'refresh-outline',
        handler: () => this.loadFamilies()
      }
    ]);
  }

  async presentFamilyActionSheet(family: Family, event: Event) {
    event.stopPropagation();

    const buttons: any[] = [
      {
        text: 'View Family',
        icon: 'eye-outline',
        handler: () => this.openFamily(family)
      },
      {
        text: 'Chat',
        icon: 'chatbubble-outline',
        handler: () => this.openFamilyChat(family, event)
      }
    ];

    if (this.canManageFamily(family)) {
      buttons.push(
        {
          text: 'Settings',
          icon: 'settings-outline',
          handler: () => this.openFamilySettings(family, event)
        },
        {
          text: 'Invite Members',
          icon: 'person-add-outline',
          handler: () => this.inviteToFamily(family)
        }
      );

      if (family.joinCode) {
        buttons.push({
          text: 'Share Join Code',
          icon: 'share-outline',
          handler: () => this.shareJoinCode(family)
        });
      }
    }

    if (family.currentUserRole === FamilyRoleEnum.OWNER) {
      buttons.push({
        text: 'Delete Family',
        icon: 'trash-outline',
        role: 'destructive',
        handler: () => this.confirmDeleteFamily(family)
      });
    } else {
      buttons.push({
        text: 'Leave Family',
        icon: 'exit-outline',
        role: 'destructive',
        handler: () => this.confirmLeaveFamily(family)
      });
    }

    await this.toastService.showActionSheet(family.name, buttons);
  }

  // Family Actions
  async copyJoinCode(joinCode: string, event: Event) {
    event.stopPropagation();
    await this.toastService.copyToClipboard(joinCode, 'Join code copied to clipboard!');
  }

  async shareJoinCode(family: Family) {
    if (family.joinCode) {
      await this.toastService.shareWithFallback(
        {
          title: `Join ${family.name}`,
          text: `You're invited to join the "${family.name}" family on Family Connect! Use join code: ${family.joinCode}`
        },
        family.joinCode,
        'Join code copied to clipboard!'
      );
    }
  }

  async inviteToFamily(family: Family) {
    const canInviteModerators = family.currentUserRole === FamilyRoleEnum.OWNER;

    const inviteData = await this.toastService.showInviteMemberModal(
      family.name,
      canInviteModerators
    );

    if (inviteData) {
      await this.handleInviteMember(family, inviteData.email, inviteData.role);
    }
  }

  private async handleInviteMember(family: Family, email: string, role: FamilyRoleEnum) {
    const loading = await this.toastService.showLoading('Sending invitation...');

    this.familyService.inviteFamilyMember(family.slug, email, role)
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          await this.toastService.showToast('Invitation sent successfully!', 'success');
        },
        error: async (error) => {
          console.error('Invite member error:', error);
          if (error.status === 409) {
            await this.toastService.showToast('This person is already a family member.', 'warning');
          } else if (error.status === 422) {
            await this.toastService.showToast('Invalid email address.', 'danger');
          } else {
            await this.toastService.showToast('Failed to send invitation. Please try again.', 'danger');
          }
        }
      });
  }

  async viewInvitations() {
    await this.router.navigate(['/invitations']);
  }

  async confirmLeaveFamily(family: Family) {
    const confirmed = await this.toastService.showDestructiveConfirmation(
      'Leave Family',
      `Are you sure you want to leave "${family.name}"? You'll need a new invitation to rejoin.`,
      'Leave',
      'Cancel'
    );

    if (confirmed) {
      this.handleLeaveFamily(family);
    }
  }

  private async handleLeaveFamily(family: Family) {
    const loading = await this.toastService.showLoading('Leaving family...');

    this.familyService.leaveFamily(family.slug)
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          await this.toastService.showToast('You have left the family.', 'success');
        },
        error: async (error) => {
          console.error('Leave family error:', error);
          await this.toastService.showToast('Failed to leave family. Please try again.', 'danger');
        }
      });
  }

  async confirmDeleteFamily(family: Family) {
    const confirmed = await this.toastService.showDeleteConfirmation(family.name, 'Family');
    if (confirmed) {
      this.handleDeleteFamily(family);
    }
  }

  private async handleDeleteFamily(family: Family) {
    const loading = await this.toastService.showLoading('Deleting family...');

    this.familyService.deleteFamily(family.slug)
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          await this.toastService.showToast('Family deleted successfully.', 'success');
        },
        error: async (error) => {
          console.error('Delete family error:', error);
          await this.toastService.showToast('Failed to delete family. Please try again.', 'danger');
        }
      });
  }

  // Utility Methods
  trackByFamilyId(index: number, family: Family): number {
    return family.id;
  }

  getFamilyRoleName(role: FamilyRoleEnum): string {
    return getFamilyRoleName(role);
  }

  getPrivacyLabel(privacy: FamilyPrivacyEnum): string {
    switch (privacy) {
      case FamilyPrivacyEnum.PUBLIC: return 'Public';
      case FamilyPrivacyEnum.PRIVATE: return 'Private';
      case FamilyPrivacyEnum.INVITE_ONLY: return 'Invite Only';
      default: return 'Unknown';
    }
  }

  getTimeAgo(dateString?: string): string {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInHours / 24;

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInDays < 7) return `${Math.floor(diffInDays)}d ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
    return `${Math.floor(diffInDays / 30)}mo ago`;
  }

  canManageFamily(family: Family): boolean {
    return this.familyService.canManageFamily(family);
  }

  getPrivacyIcon(privacy: FamilyPrivacyEnum): string {
    switch (privacy) {
      case FamilyPrivacyEnum.PUBLIC: return 'globe-outline';
      case FamilyPrivacyEnum.PRIVATE: return 'lock-closed-outline';
      case FamilyPrivacyEnum.INVITE_ONLY: return 'key-outline';
      default: return 'help-outline';
    }
  }
}
