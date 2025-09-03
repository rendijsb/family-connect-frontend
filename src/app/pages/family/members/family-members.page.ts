import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, finalize, combineLatest } from 'rxjs';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonIcon, IonSearchbar, IonRefresher, IonRefresherContent, IonCard,
  IonCardContent, IonAvatar, IonBadge, IonItem, IonLabel, IonSelect,
  IonSelectOption, IonFab, IonFabButton, IonSkeletonText, IonChip
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline, searchOutline, personAddOutline, filterOutline,
  ellipsisVerticalOutline, chatbubbleOutline, createOutline, personRemoveOutline,
  shieldCheckmarkOutline, peopleOutline, callOutline, mailOutline
} from 'ionicons/icons';

import { FamilyService } from '../../../core/services/family/family.service';
import { FamilyMemberService } from '../../../core/services/family-member/family-member.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  Family,
  FamilyMember,
  FamilyRoleEnum,
  getFamilyRoleName
} from '../../../models/families/family.models';
import {
  RelationshipTypeEnum,
  getRelationshipLabel
} from '../../../models/families/invitation.models';

interface MemberFilter {
  role?: FamilyRoleEnum;
  relationship?: RelationshipTypeEnum;
  searchTerm?: string;
}

@Component({
  selector: 'app-family-members',
  templateUrl: './family-members.page.html',
  styleUrls: ['./family-members.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonIcon, IonSearchbar, IonRefresher, IonRefresherContent, IonCard,
    IonCardContent, IonAvatar, IonBadge, IonItem, IonLabel, IonSelect,
    IonSelectOption, IonFab, IonFabButton, IonSkeletonText, IonChip
  ]
})
export class FamilyMembersPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly familyService = inject(FamilyService);
  private readonly memberService = inject(FamilyMemberService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  readonly family = signal<Family | null>(null);
  readonly members = signal<FamilyMember[]>([]);
  readonly filteredMembers = signal<FamilyMember[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly familySlug = signal<string>('');
  readonly searchTerm = signal<string>('');
  readonly selectedFilter = signal<MemberFilter>({});

  readonly FamilyRoleEnum = FamilyRoleEnum;
  readonly RelationshipTypeEnum = RelationshipTypeEnum;

  constructor() {
    this.addIcons();
  }

  ngOnInit() {
    const slug = this.route.snapshot.paramMap.get('slug') || '';
    this.familySlug.set(slug);
    if (slug) {
      this.loadFamilyAndMembers();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private addIcons() {
    addIcons({
      arrowBackOutline, searchOutline, personAddOutline, filterOutline,
      ellipsisVerticalOutline, chatbubbleOutline, createOutline, personRemoveOutline,
      shieldCheckmarkOutline, peopleOutline, callOutline, mailOutline
    });
  }

  private loadFamilyAndMembers() {
    this.isLoading.set(true);

    combineLatest([
      this.familyService.getFamilyBySlug(this.familySlug()),
      this.memberService.getFamilyMembers(this.familySlug())
    ]).pipe(
      finalize(() => this.isLoading.set(false)),
      takeUntil(this.destroy$)
    ).subscribe({
      next: ([familyResponse, membersResponse]) => {
        this.family.set(familyResponse.data);
        this.members.set(membersResponse.data);
        this.applyFilters();
      },
      error: async (error) => {
        console.error('Load error:', error);
        await this.toastService.showToast('Failed to load family members.', 'danger');
        await this.router.navigate(['/family', this.familySlug()]);
      }
    });
  }

  private applyFilters() {
    let filtered = [...this.members()];
    const filter = this.selectedFilter();
    const search = this.searchTerm().toLowerCase();

    if (search) {
      filtered = filtered.filter(member =>
        member.user?.name?.toLowerCase().includes(search) ||
        member.nickname?.toLowerCase().includes(search) ||
        member.relationship?.toLowerCase().includes(search)
      );
    }

    if (filter.role !== undefined) {
      filtered = filtered.filter(member => member.role === filter.role);
    }

    if (filter.relationship !== undefined) {
      filtered = filtered.filter(member => member.relationship === filter.relationship);
    }

    this.filteredMembers.set(filtered);
  }

  // Event Handlers
  async goBack() {
    await this.router.navigate(['/family', this.familySlug()]);
  }

  doRefresh(event: any) {
    this.loadFamilyAndMembers();
    setTimeout(() => event.target.complete(), 1000);
  }

  onSearchChange(event: any) {
    this.searchTerm.set(event.detail.value || '');
    this.applyFilters();
  }

  onFilterChange() {
    this.applyFilters();
  }

  async presentMemberActions(member: FamilyMember) {
    if (!this.canManageMember(member)) return;

    const buttons: any[] = [
      {
        text: 'Send Message',
        icon: 'chatbubble-outline',
        handler: () => this.chatWithMember(member)
      },
      {
        text: 'Call Member',
        icon: 'call-outline',
        handler: () => this.callMember(member)
      },
      {
        text: 'Set Relationship',
        icon: 'people-outline',
        handler: () => this.setMemberRelationship(member)
      }
    ];

    if (this.canEditMember(member)) {
      buttons.push(
        {
          text: 'Edit Details',
          icon: 'create-outline',
          handler: () => this.editMember(member)
        },
        {
          text: 'Change Role',
          icon: 'shield-checkmark-outline',
          handler: () => this.changeMemberRole(member)
        }
      );
    }

    if (this.canRemoveMember(member)) {
      buttons.push({
        text: 'Remove Member',
        icon: 'person-remove-outline',
        role: 'destructive',
        handler: () => this.confirmRemoveMember(member)
      });
    }

    await this.toastService.showActionSheet(
      member.user?.name || 'Member',
      buttons
    );
  }

  async editMemberNickname(member: FamilyMember) {
    const nickname = await this.toastService.showEditNicknameDialog(member.nickname);

    if (nickname !== null) {
      // You'll need to implement this in your FamilyMemberService
      await this.toastService.showToast('Nickname update feature will be available soon!', 'warning');
    }
  }

  async inviteMember() {
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
    const loading = await this.toastService.showLoading('Sending invitation...');

    this.memberService.inviteMember(this.familySlug(), {
      email,
      role: role as number // Cast to number for API compatibility
    })
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          await this.toastService.showToast('Invitation sent successfully!', 'success');
        },
        error: async (error) => {
          const message = error.status === 409
            ? 'This person is already a family member.'
            : 'Failed to send invitation. Please try again.';
          await this.toastService.showToast(message, 'danger');
        }
      });
  }

  async setMemberRelationship(member: FamilyMember) {
    const relationshipData = await this.toastService.showRelationshipModal();

    if (relationshipData) {
      await this.handleSetRelationship(member, relationshipData);
    }
  }

  private async handleSetRelationship(member: FamilyMember, relationshipData: any) {
    const loading = await this.toastService.showLoading('Updating relationship...');

    // You'll need to implement this in your FamilyMemberService
    // this.memberService.setMemberRelationship(this.familySlug(), member.id, {
    //   relatedMemberId: currentUser.id, // You'll need to determine this
    //   relationshipType: relationshipData.relationshipType,
    //   isGuardian: relationshipData.isGuardian
    // }).pipe(
    //   finalize(() => loading.dismiss()),
    //   takeUntil(this.destroy$)
    // ).subscribe({
    //   next: async () => {
    //     await this.toastService.showToast('Relationship updated successfully!', 'success');
    //   },
    //   error: async (error) => {
    //     console.error('Set relationship error:', error);
    //     await this.toastService.showToast('Failed to update relationship.', 'danger');
    //   }
    // });

    loading.dismiss();
    await this.toastService.showToast('Relationship feature will be available soon!', 'warning');
  }

  async chatWithMember(member: FamilyMember) {
    await this.router.navigate(['/chat', 'direct', member.userId]);
  }

  async callMember(member: FamilyMember) {
    if (member.user?.phone) {
      window.open(`tel:${member.user.phone}`, '_system');
    } else {
      await this.toastService.showToast('Phone number not available', 'warning');
    }
  }

  async editMember(member: FamilyMember) {
    const buttons: any[] = [
      {
        text: 'Edit Nickname',
        icon: 'create-outline',
        handler: () => this.editMemberNickname(member)
      },
      {
        text: 'Set Relationship',
        icon: 'people-outline',
        handler: () => this.setMemberRelationship(member)
      }
    ];

    await this.toastService.showActionSheet(
      `Edit ${member.user?.name}`,
      buttons
    );
  }

  async changeMemberRole(member: FamilyMember) {
    const newRole = await this.showRoleSelection(member.role);
    if (newRole !== null && newRole !== member.role) {
      await this.handleRoleChange(member, newRole);
    }
  }

  private async showRoleSelection(currentRole: FamilyRoleEnum): Promise<number | null> {
    return new Promise(async (resolve) => {
      const alert = await document.createElement('ion-alert');
      alert.header = 'Change Member Role';
      alert.message = 'Select the new role for this member.';

      alert.inputs = [
        {
          name: 'role',
          type: 'radio',
          label: 'Family Member',
          value: FamilyRoleEnum.MEMBER,
          checked: currentRole === FamilyRoleEnum.MEMBER
        },
        {
          name: 'role',
          type: 'radio',
          label: 'Family Moderator',
          value: FamilyRoleEnum.MODERATOR,
          checked: currentRole === FamilyRoleEnum.MODERATOR
        }
      ];

      alert.buttons = [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => resolve(null)
        },
        {
          text: 'Update',
          role: 'confirm',
          handler: (data) => resolve(data.role)
        }
      ];

      document.body.appendChild(alert);
      await alert.present();
    });
  }

  private async handleRoleChange(member: FamilyMember, newRole: number) {
    const loading = await this.toastService.showLoading('Updating member role...');

    this.memberService.updateMemberRole(this.familySlug(), member.id, { role: newRole })
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          await this.toastService.showToast('Member role updated successfully!', 'success');
          this.loadFamilyAndMembers();
        },
        error: async () => {
          await this.toastService.showToast('Failed to update member role.', 'danger');
        }
      });
  }

  async confirmRemoveMember(member: FamilyMember) {
    const confirmed = await this.toastService.showDestructiveConfirmation(
      'Remove Member',
      `Are you sure you want to remove ${member.user?.name} from the family?`,
      'Remove',
      'Cancel'
    );

    if (confirmed) {
      await this.handleRemoveMember(member);
    }
  }

  private async handleRemoveMember(member: FamilyMember) {
    const loading = await this.toastService.showLoading('Removing member...');

    this.memberService.removeMember(this.familySlug(), member.id)
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          await this.toastService.showToast('Member removed successfully.', 'success');
          this.loadFamilyAndMembers();
        },
        error: async () => {
          await this.toastService.showToast('Failed to remove member.', 'danger');
        }
      });
  }

  // Utility Methods
  trackByMemberId(index: number, member: FamilyMember): number {
    return member.id;
  }

  getFamilyRoleName(role: FamilyRoleEnum): string {
    return getFamilyRoleName(role);
  }

  getRelationshipLabel(type?: string): string {
    if (!type) return '';
    return getRelationshipLabel(type as RelationshipTypeEnum);
  }

  getRoleBadgeClass(role: FamilyRoleEnum): string {
    switch (role) {
      case FamilyRoleEnum.OWNER: return 'owner';
      case FamilyRoleEnum.MODERATOR: return 'moderator';
      case FamilyRoleEnum.MEMBER: return 'member';
      case FamilyRoleEnum.CHILD: return 'child';
      default: return 'member';
    }
  }

  isCurrentUser(member: FamilyMember): boolean {
    const currentUser = this.authService.user();
    return currentUser?.id === member.userId;
  }

  canManageMembers(): boolean {
    const family = this.family();
    return family ? this.familyService.canManageMembers(family) : false;
  }

  canManageMember(member: FamilyMember): boolean {
    const family = this.family();
    if (!family || !this.canManageMembers()) return false;

    const currentRole = family.currentUserRole;
    if (currentRole === FamilyRoleEnum.OWNER) {
      return member.role !== FamilyRoleEnum.OWNER || this.isCurrentUser(member);
    }

    if (currentRole === FamilyRoleEnum.MODERATOR) {
      return member.role === FamilyRoleEnum.MEMBER || member.role === FamilyRoleEnum.CHILD;
    }

    return false;
  }

  canEditMember(member: FamilyMember): boolean {
    return this.canManageMember(member);
  }

  canRemoveMember(member: FamilyMember): boolean {
    return this.canManageMember(member) && !this.isCurrentUser(member);
  }

  getMemberStatusColor(member: FamilyMember): string {
    if (!member.lastSeenAt) return '#6b7280';

    const lastSeen = new Date(member.lastSeenAt);
    const now = new Date();
    const diffInHours = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return '#22c55e';
    if (diffInHours < 24) return '#f59e0b';
    return '#6b7280';
  }

  getMemberStatusText(member: FamilyMember): string {
    if (!member.lastSeenAt) return 'Never active';

    const lastSeen = new Date(member.lastSeenAt);
    const now = new Date();
    const diffInHours = (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return 'Active now';
    if (diffInHours < 24) return `Active ${Math.floor(diffInHours)}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `Active ${diffInDays}d ago`;
  }
}
