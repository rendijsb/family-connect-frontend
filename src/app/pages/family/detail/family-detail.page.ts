import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonIcon, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonAvatar,
  IonSegment, IonSegmentButton, IonLabel, IonRefresher, IonRefresherContent,
  IonFab, IonFabButton, IonFabList, IonSkeletonText
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline, homeOutline, peopleOutline, pulseOutline, chatbubbleOutline,
  cameraOutline, calendarOutline, locationOutline, heartOutline, personAddOutline,
  notificationsOutline, ellipsisVerticalOutline, ellipsisHorizontalOutline,
  copyOutline, shareOutline, refreshOutline, addOutline, timeOutline,
  globeOutline, lockClosedOutline, keyOutline, settingsOutline, exitOutline,
  trashOutline, createOutline, closeOutline, personOutline, personRemoveOutline,
  radioButtonOnOutline, radioButtonOffOutline
} from 'ionicons/icons';

import { FamilyService } from '../../../core/services/family/family.service';
import { FamilyMemberService } from '../../../core/services/family-member/family-member.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import {
  Family,
  FamilyMember,
  FamilyRoleEnum,
  FamilyPrivacyEnum,
  getFamilyRoleName,
} from '../../../models/families/family.models';
import { ToastService } from '../../../shared/services/toast.service';
import { ModalController } from '@ionic/angular';

interface FamilyActivity {
  id: number;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  user: string;
  userAvatar: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-family-detail',
  templateUrl: './family-detail.page.html',
  styleUrls: ['./family-detail.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonIcon, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonAvatar,
    IonSegment, IonSegmentButton, IonLabel, IonRefresher, IonRefresherContent,
    IonFab, IonFabButton, IonFabList, IonSkeletonText
  ]
})
export class FamilyDetailPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly familyService = inject(FamilyService);
  private readonly familyMemberService = inject(FamilyMemberService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly modalController = inject(ModalController);

  // Signals for reactive state management
  readonly family = signal<Family | null>(null);
  readonly selectedSegment = signal<string>('overview');
  readonly isLoading = signal<boolean>(false);
  readonly familySlug = signal<string>('');

  // Mock data - in real app this would come from API
  readonly recentActivities: FamilyActivity[] = [
    {
      id: 1,
      type: 'member_joined',
      title: 'New Member Joined',
      description: 'Emma Johnson joined the family',
      timestamp: '2 hours ago',
      user: 'Emma Johnson',
      userAvatar: '/assets/avatars/emma.jpg',
      icon: 'person-add-outline',
      color: '#22c55e',
    },
    {
      id: 2,
      type: 'photo_shared',
      title: 'Photos Shared',
      description: 'Michael shared 5 new photos from vacation',
      timestamp: '5 hours ago',
      user: 'Michael Johnson',
      userAvatar: '/assets/avatars/michael.jpg',
      icon: 'camera-outline',
      color: '#3b82f6',
    },
    {
      id: 3,
      type: 'event_created',
      title: 'Event Created',
      description: 'Family BBQ scheduled for this weekend',
      timestamp: '1 day ago',
      user: 'John Johnson',
      userAvatar: '/assets/avatars/john.jpg',
      icon: 'calendar-outline',
      color: '#f59e0b',
    },
  ];

  constructor() {
    this.addIcons();
  }

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    this.familySlug.set(slug);
    if (slug) {
      this.loadFamily();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private addIcons() {
    addIcons({
      arrowBackOutline, homeOutline, peopleOutline, pulseOutline, chatbubbleOutline,
      cameraOutline, calendarOutline, locationOutline, heartOutline, personAddOutline,
      notificationsOutline, ellipsisVerticalOutline, ellipsisHorizontalOutline,
      copyOutline, shareOutline, refreshOutline, addOutline, timeOutline,
      globeOutline, lockClosedOutline, keyOutline, settingsOutline, exitOutline,
      trashOutline, createOutline, closeOutline, personOutline, personRemoveOutline,
      radioButtonOnOutline, radioButtonOffOutline
    });
  }

  private async loadFamily() {
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
        },
        error: async (error) => {
          console.error('Load family error:', error);
          if (error.status === 404) {
            await this.toastService.showToast('Family not found.', 'danger');
          } else if (error.status === 403) {
            await this.toastService.showToast(
              'You do not have access to this family.',
              'danger'
            );
          } else {
            await this.toastService.showToast(
              'Failed to load family details.',
              'danger'
            );
          }
          await this.router.navigate(['/tabs/family']);
        },
      });
  }

  // Event Handlers
  async goBack() {
    await this.router.navigate(['/tabs/family']);
  }

  doRefresh(event: any) {
    if (this.familySlug()) {
      this.familyService
        .getFamilyBySlug(this.familySlug())
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.family.set(response.data);
            event.target.complete();
          },
          error: () => {
            event.target.complete();
            this.toastService.showToast(
              'Failed to refresh family data.',
              'danger'
            );
          },
        });
    } else {
      event.target.complete();
    }
  }

  segmentChanged(event: any) {
    this.selectedSegment.set(event.detail.value);
  }

  // Quick Actions
  async openFamilyChat() {
    await this.router.navigate(['/family', this.familySlug(), 'chat']);
  }

  async openFamilyPhotos() {
    await this.router.navigate(['/family', this.familySlug(), 'photos']);
  }

  async openFamilyEvents() {
    await this.router.navigate(['/family', this.familySlug(), 'events']);
  }

  async openFamilyLocations() {
    await this.router.navigate(['/family', this.familySlug(), 'locations']);
  }

  async openFamilyMemories() {
    await this.router.navigate(['/family', this.familySlug(), 'memories']);
  }

  async inviteMembers() {
    const family = this.family();
    if (!family) return;

    const canInviteModerators = family.currentUserRole === FamilyRoleEnum.OWNER;

    const inviteData = await this.toastService.showInviteMemberModal(
      family.name,
      canInviteModerators
    );

    if (inviteData) {
      await this.handleInviteMember(inviteData.email, inviteData.role);
    }
  }

  private async handleInviteMember(email: string, role: FamilyRoleEnum) {
    const family = this.family();
    if (!family) return;

    const loading = await this.toastService.showLoading(
      'Sending invitation...'
    );

    this.familyService
      .inviteFamilyMember(family.slug, email, role)
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          await this.toastService.showToast(
            'Invitation sent successfully!',
            'success'
          );
        },
        error: async (error) => {
          console.error('Invite member error:', error);
          if (error.status === 409) {
            await this.toastService.showToast(
              'This person is already a family member.',
              'warning'
            );
          } else if (error.status === 422) {
            await this.toastService.showToast(
              'Invalid email address.',
              'danger'
            );
          } else {
            await this.toastService.showToast(
              'Failed to send invitation. Please try again.',
              'danger'
            );
          }
        },
      });
  }

  async setMemberRelationship(member: FamilyMember) {
    const relationshipData = await this.toastService.showRelationshipModal();

    if (relationshipData) {
      await this.handleSetRelationship(member, relationshipData);
    }
  }

  private async handleSetRelationship(
    member: FamilyMember,
    relationshipData: any
  ) {
    const family = this.family();
    const currentUser = this.authService.user();
    if (!family || !currentUser) return;

    const loading = await this.toastService.showLoading(
      'Updating relationship...'
    );

    this.familyMemberService
      .setMemberRelationship(family.slug, member.id, {
        relatedMemberId: currentUser.id,
        relationshipType: relationshipData.relationshipType,
        isGuardian: relationshipData.isGuardian || false,
      })
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          await this.toastService.showToast(
            'Relationship updated successfully!',
            'success'
          );
        },
        error: async (error) => {
          console.error('Set relationship error:', error);
          await this.toastService.showToast(
            'Failed to update relationship.',
            'danger'
          );
        },
      });
  }

  async chatWithMember(member: FamilyMember) {
    // Navigate to direct chat with member
    await this.router.navigate(['/chat', 'direct', member.userId]);
  }

  // Join Code Actions
  async copyJoinCode() {
    const family = this.family();
    if (family?.joinCode) {
      await this.toastService.copyToClipboard(
        family.joinCode,
        'Join code copied to clipboard!'
      );
    }
  }

  async shareJoinCode() {
    const family = this.family();
    if (family?.joinCode) {
      await this.toastService.shareWithFallback(
        {
          title: `Join ${family.name}`,
          text: `You're invited to join the "${family.name}" family on Family Connect! Use join code: ${family.joinCode}`,
        },
        family.joinCode,
        'Join code copied to clipboard!'
      );
    }
  }

  async regenerateJoinCode() {
    const family = this.family();
    if (!family) return;

    const confirmed = await this.toastService.showConfirmation(
      'Generate New Join Code',
      'This will invalidate the current join code. Are you sure?',
      'Generate',
      'Cancel'
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
          next: async () => {
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

  // Action Sheets
  async presentFamilyOptions() {
    const family = this.family();
    if (!family) return;

    const buttons: any[] = [
      {
        text: 'Family Chat',
        icon: 'chatbubble-outline',
        handler: () => this.openFamilyChat(),
      },
      {
        text: 'Share Family',
        icon: 'share-outline',
        handler: () => this.shareFamily(),
      },
    ];

    if (this.canManageFamily()) {
      buttons.push(
        {
          text: 'Family Settings',
          icon: 'settings-outline',
          handler: () => this.openFamilySettings(),
        },
        {
          text: 'Invite Members',
          icon: 'person-add-outline',
          handler: () => this.inviteMembers(),
        }
      );
    }

    if (this.isOwner()) {
      buttons.push({
        text: 'Delete Family',
        icon: 'trash-outline',
        role: 'destructive',
        handler: () => this.confirmDeleteFamily(),
      });
    } else {
      buttons.push({
        text: 'Leave Family',
        icon: 'exit-outline',
        role: 'destructive',
        handler: () => this.confirmLeaveFamily(),
      });
    }

    await this.toastService.showActionSheet('Family Options', buttons);
  }

  async presentMemberActions(member: FamilyMember) {
    if (!this.canManageMember(member)) return;

    const buttons: any[] = [
      {
        text: 'Send Message',
        icon: 'chatbubble-outline',
        handler: () => this.chatWithMember(member),
      },
      {
        text: 'Call Member',
        icon: 'call-outline',
        handler: () => this.callMember(member),
      },
      {
        text: 'Set Relationship',
        icon: 'people-outline',
        handler: () => this.setMemberRelationship(member),
      },
    ];

    if (this.canEditMember(member)) {
      buttons.push(
        {
          text: 'Edit Details',
          icon: 'create-outline',
          handler: () => this.editMember(member),
        },
        {
          text: 'Change Role',
          icon: 'shield-checkmark-outline',
          handler: () => this.changeMemberRole(member),
        }
      );
    }

    if (this.canRemoveMember(member)) {
      buttons.push({
        text: 'Remove Member',
        icon: 'person-remove-outline',
        role: 'destructive',
        handler: () => this.confirmRemoveMember(member),
      });
    }

    await this.toastService.showActionSheet(
      member.user?.name || 'Member',
      buttons
    );
  }

  private canEditMember(member: FamilyMember): boolean {
    return this.canManageMember(member);
  }

  private canRemoveMember(member: FamilyMember): boolean {
    return this.canManageMember(member) && !this.isCurrentUser(member);
  }

  private async callMember(member: FamilyMember) {
    if (member.user?.phone) {
      window.open(`tel:${member.user.phone}`, '_system');
    } else {
      await this.toastService.showToast(
        'Phone number not available',
        'warning'
      );
    }
  }

  private async changeMemberRole(member: FamilyMember) {
    const newRole = await this.toastService.showRoleSelectionDialog(
      member.role
    );
    if (newRole !== null && newRole !== member.role) {
      const family = this.family();
      if (!family) return;

      const loading = await this.toastService.showLoading(
        'Updating member role...'
      );

      this.familyMemberService
        .updateMemberRole(family.slug, member.id, {
          role: newRole,
        })
        .pipe(
          finalize(() => loading.dismiss()),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: async () => {
            await this.toastService.showToast(
              'Member role updated successfully!',
              'success'
            );
            // Reload family to reflect changes
            this.loadFamily();
          },
          error: async (error) => {
            console.error('Update member role error:', error);
            await this.toastService.showToast(
              'Failed to update member role.',
              'danger'
            );
          },
        });
    }
  }

  // Family Management
  async openFamilySettings() {
    await this.router.navigate(['/family', this.familySlug(), 'settings']);
  }

  async shareFamily() {
    const family = this.family();
    if (family) {
      await this.toastService.shareWithFallback(
        {
          title: family.name,
          text: `Check out the "${family.name}" family on Family Connect!`,
        },
        family.slug,
        'Family link copied to clipboard!'
      );
    }
  }

  async confirmLeaveFamily() {
    const family = this.family();
    if (!family) return;

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

    this.familyService
      .leaveFamily(family.slug)
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          await this.toastService.showToast(
            'You have left the family.',
            'success'
          );
          await this.router.navigate(['/tabs/family']);
        },
        error: async (error) => {
          console.error('Leave family error:', error);
          await this.toastService.showToast(
            'Failed to leave family. Please try again.',
            'danger'
          );
        },
      });
  }

  async confirmDeleteFamily() {
    const family = this.family();
    if (!family) return;

    const confirmed = await this.toastService.showDeleteConfirmation(
      family.name,
      'Family'
    );
    if (confirmed) {
      this.handleDeleteFamily(family);
    }
  }

  private async handleDeleteFamily(family: Family) {
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
            'Failed to delete family. Please try again.',
            'danger'
          );
        },
      });
  }

  // Member Management
  async viewMemberProfile(member: FamilyMember) {
    await this.router.navigate(['/profile', member.userId]);
  }

  async editMember(member: FamilyMember) {
    const memberData = await this.toastService.showEditMemberModal(member);

    if (memberData) {
      const family = this.family();
      if (!family) return;

      const loading = await this.toastService.showLoading('Updating member...');

      this.familyMemberService
        .updateMember(family.slug, member.id, memberData)
        .pipe(
          finalize(() => loading.dismiss()),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: async () => {
            await this.toastService.showToast(
              'Member updated successfully!',
              'success'
            );
            // Reload family to reflect changes
            this.loadFamily();
          },
          error: async (error) => {
            console.error('Update member error:', error);
            await this.toastService.showToast(
              'Failed to update member.',
              'danger'
            );
          },
        });
    }
  }

  async confirmRemoveMember(member: FamilyMember) {
    const confirmed = await this.toastService.showDestructiveConfirmation(
      'Remove Member',
      `Are you sure you want to remove ${member.user?.name} from the family?`,
      'Remove',
      'Cancel'
    );

    if (confirmed) {
      this.handleRemoveMember(member);
    }
  }

  private async handleRemoveMember(member: FamilyMember) {
    const family = this.family();
    if (!family) return;

    const loading = await this.toastService.showLoading('Removing member...');

    this.familyService
      .removeFamilyMember(family.slug, member.id)
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          await this.toastService.showToast(
            'Member removed successfully.',
            'success'
          );
          // Reload family to refresh members list
          this.loadFamily();
        },
        error: async (error) => {
          console.error('Remove member error:', error);
          await this.toastService.showToast(
            'Failed to remove member. Please try again.',
            'danger'
          );
        },
      });
  }

  // Utility Methods
  trackByMemberId(index: number, member: FamilyMember): number {
    return member.id;
  }

  trackByActivityId(index: number, activity: FamilyActivity): number {
    return activity.id;
  }

  getFamilyRoleName(role: FamilyRoleEnum): string {
    return getFamilyRoleName(role);
  }

  getRoleInitial(role: FamilyRoleEnum): string {
    switch (role) {
      case FamilyRoleEnum.OWNER:
        return 'O';
      case FamilyRoleEnum.MODERATOR:
        return 'M';
      case FamilyRoleEnum.MEMBER:
        return 'F';
      case FamilyRoleEnum.CHILD:
        return 'C';
      default:
        return '?';
    }
  }

  getRoleBadgeClass(role: FamilyRoleEnum): string {
    switch (role) {
      case FamilyRoleEnum.OWNER:
        return 'owner';
      case FamilyRoleEnum.MODERATOR:
        return 'moderator';
      case FamilyRoleEnum.MEMBER:
        return 'member';
      case FamilyRoleEnum.CHILD:
        return 'child';
      default:
        return 'member';
    }
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

  getPrivacyIcon(privacy: FamilyPrivacyEnum): string {
    switch (privacy) {
      case FamilyPrivacyEnum.PUBLIC:
        return 'globe-outline';
      case FamilyPrivacyEnum.PRIVATE:
        return 'lock-closed-outline';
      case FamilyPrivacyEnum.INVITE_ONLY:
        return 'key-outline';
      default:
        return 'help-outline';
    }
  }

  getTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

    if (diffInDays < 1) return 'today';
    if (diffInDays < 7) return `${Math.floor(diffInDays)} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
  }

  isCurrentUser(member: FamilyMember): boolean {
    const currentUser = this.authService.user();
    return currentUser?.id === member.userId;
  }

  canManageFamily(): boolean {
    const family = this.family();
    return family ? this.familyService.canManageFamily(family) : false;
  }

  canInviteMembers(): boolean {
    const family = this.family();
    return family ? this.familyService.canInviteMembers(family) : false;
  }

  canManageMembers(): boolean {
    const family = this.family();
    return family ? this.familyService.canManageMembers(family) : false;
  }

  canManageMember(member: FamilyMember): boolean {
    const family = this.family();
    if (!family || !this.canManageMembers()) return false;

    // Owners can manage everyone except other owners
    // Moderators can manage members and children but not owners or other moderators
    const currentRole = family.currentUserRole;
    if (currentRole === FamilyRoleEnum.OWNER) {
      return member.role !== FamilyRoleEnum.OWNER || this.isCurrentUser(member);
    }

    if (currentRole === FamilyRoleEnum.MODERATOR) {
      return (
        member.role === FamilyRoleEnum.MEMBER ||
        member.role === FamilyRoleEnum.CHILD
      );
    }

    return false;
  }

  isOwner(): boolean {
    const family = this.family();
    return family ? this.familyService.isOwner(family) : false;
  }

  getMemberStatusIcon(member: FamilyMember): string {
    if (member.lastSeenAt) {
      const lastSeen = new Date(member.lastSeenAt);
      const now = new Date();
      const diffInHours =
        (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 1) return 'radio-button-on-outline';
      if (diffInHours < 24) return 'time-outline';
      return 'radio-button-off-outline';
    }
    return 'radio-button-off-outline';
  }

  getMemberStatusColor(member: FamilyMember): string {
    if (member.lastSeenAt) {
      const lastSeen = new Date(member.lastSeenAt);
      const now = new Date();
      const diffInHours =
        (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 1) return '#22c55e';
      if (diffInHours < 24) return '#f59e0b';
      return '#6b7280';
    }
    return '#6b7280';
  }

  getMemberStatusText(member: FamilyMember): string {
    if (member.lastSeenAt) {
      const lastSeen = new Date(member.lastSeenAt);
      const now = new Date();
      const diffInHours =
        (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 1) return 'Active now';
      if (diffInHours < 24) return `Active ${Math.floor(diffInHours)}h ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      return `Active ${diffInDays}d ago`;
    }
    return 'Never active';
  }
}
