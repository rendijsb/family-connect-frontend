import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonIcon, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonRefresher, IonRefresherContent, IonBadge, IonSkeletonText
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline, checkmarkOutline, closeOutline, timeOutline,
  homeOutline, peopleOutline, mailOutline, personOutline,
  calendarOutline, alertCircleOutline
} from 'ionicons/icons';

import { FamilyMemberService } from '../../core/services/family-member/family-member.service';
import { ToastService } from '../../shared/services/toast.service';
import {
  FamilyInvitation,
  InvitationStatusEnum,
  getInvitationStatusLabel,
  getInvitationStatusColor
} from '../../models/families/invitation.models';
import { getFamilyRoleName, FamilyRoleEnum } from '../../models/families/family.models';

@Component({
  selector: 'app-pending-invitations',
  templateUrl: './pending-invitations.page.html',
  styleUrls: ['./pending-invitations.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonIcon, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
    IonRefresher, IonRefresherContent, IonBadge, IonSkeletonText
  ]
})
export class PendingInvitationsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly router = inject(Router);
  private readonly memberService = inject(FamilyMemberService);
  private readonly toastService = inject(ToastService);

  readonly invitations = signal<FamilyInvitation[]>([]);
  readonly isLoading = signal<boolean>(false);

  readonly InvitationStatusEnum = InvitationStatusEnum;

  constructor() {
    this.addIcons();
  }

  ngOnInit() {
    this.loadInvitations();
    this.subscribeToInvitations();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private addIcons() {
    addIcons({
      arrowBackOutline, checkmarkOutline, closeOutline, timeOutline,
      homeOutline, peopleOutline, mailOutline, personOutline,
      calendarOutline, alertCircleOutline
    });
  }

  private subscribeToInvitations() {
    this.memberService.pendingInvitations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(invitations => {
        this.invitations.set(invitations);
      });
  }

  private loadInvitations() {
    this.isLoading.set(true);
    this.memberService.getPendingInvitations()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        error: (error) => {
          console.error('Load invitations error:', error);
          this.toastService.showToast('Failed to load invitations.', 'danger');
        }
      });
  }

  // Event Handlers
  async goBack() {
    await this.router.navigate(['/tabs/family']);
  }

  doRefresh(event: any) {
    this.memberService.getPendingInvitations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        complete: () => event.target.complete(),
        error: () => {
          event.target.complete();
          this.toastService.showToast('Failed to refresh invitations.', 'danger');
        }
      });
  }

  async acceptInvitation(invitation: FamilyInvitation) {
    if (this.isExpired(invitation)) {
      await this.toastService.showToast('This invitation has expired.', 'warning');
      return;
    }

    const confirmed = await this.toastService.showConfirmation(
      'Accept Invitation',
      `Join "${invitation.family?.name}" as ${getFamilyRoleName(invitation.role as FamilyRoleEnum)}?`,
      'Accept',
      'Cancel'
    );

    if (confirmed) {
      await this.handleAcceptInvitation(invitation);
    }
  }

  private async handleAcceptInvitation(invitation: FamilyInvitation) {
    const loading = await this.toastService.showLoading('Accepting invitation...');

    this.memberService.acceptInvitation(invitation.token)
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          await this.toastService.showToast('Successfully joined the family!', 'success');
          // Navigate to the family page
          if (invitation.family?.slug) {
            await this.router.navigate(['/family', invitation.family.slug]);
          } else {
            await this.router.navigate(['/tabs/family']);
          }
        },
        error: async (error) => {
          console.error('Accept invitation error:', error);
          const message = error.status === 410
            ? 'This invitation has expired or is no longer valid.'
            : 'Failed to accept invitation. Please try again.';
          await this.toastService.showToast(message, 'danger');
        }
      });
  }

  async declineInvitation(invitation: FamilyInvitation) {
    const confirmed = await this.toastService.showDestructiveConfirmation(
      'Decline Invitation',
      `Are you sure you want to decline the invitation to join "${invitation.family?.name}"?`,
      'Decline',
      'Cancel'
    );

    if (confirmed) {
      await this.handleDeclineInvitation(invitation);
    }
  }

  private async handleDeclineInvitation(invitation: FamilyInvitation) {
    const loading = await this.toastService.showLoading('Declining invitation...');

    this.memberService.declineInvitation(invitation.token)
      .pipe(
        finalize(() => loading.dismiss()),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: async () => {
          await this.toastService.showToast('Invitation declined.', 'success');
        },
        error: async (error) => {
          console.error('Decline invitation error:', error);
          await this.toastService.showToast('Failed to decline invitation.', 'danger');
        }
      });
  }

  async viewFamilyPreview(invitation: FamilyInvitation) {
    // TODO: Implement family preview modal
    await this.toastService.showToast('Family preview will be available soon!', 'warning');
  }

  // Utility Methods
  trackByInvitationId(index: number, invitation: FamilyInvitation): number {
    return invitation.id;
  }

  getFamilyRoleName(role: number): string {
    return getFamilyRoleName(role as FamilyRoleEnum);
  }

  getInvitationStatusLabel(status: InvitationStatusEnum): string {
    return getInvitationStatusLabel(status);
  }

  getInvitationStatusColor(status: InvitationStatusEnum): string {
    return getInvitationStatusColor(status);
  }

  getTimeAgo(dateString: string): string {
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

  getExpiryText(expiresAt: string): string {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffInMs = expiry.getTime() - now.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    const diffInDays = diffInHours / 24;

    if (diffInMs <= 0) return 'Expired';
    if (diffInHours < 1) return `Expires in ${Math.floor(diffInMs / (1000 * 60))}m`;
    if (diffInHours < 24) return `Expires in ${Math.floor(diffInHours)}h`;
    return `Expires in ${Math.floor(diffInDays)}d`;
  }

  isExpired(invitation: FamilyInvitation): boolean {
    return new Date(invitation.expiresAt) < new Date();
  }

  isPending(invitation: FamilyInvitation): boolean {
    return invitation.status === InvitationStatusEnum.PENDING && !this.isExpired(invitation);
  }

  getExpiryColor(expiresAt: string): string {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diffInHours = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (diffInHours <= 0) return '#ef4444';
    if (diffInHours < 24) return '#f59e0b';
    return '#22c55e';
  }

  getPendingInvitations(): FamilyInvitation[] {
    return this.invitations().filter(inv => inv.status === InvitationStatusEnum.PENDING);
  }

  getProcessedInvitations(): FamilyInvitation[] {
    return this.invitations().filter(inv => inv.status !== InvitationStatusEnum.PENDING);
  }
}
