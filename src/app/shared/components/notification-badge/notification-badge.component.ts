import { Component, Input, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { IonButton, IonIcon, IonBadge } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { notificationsOutline, mailOutline } from 'ionicons/icons';

import { FamilyMemberService } from '../../../core/services/family-member/family-member.service';

@Component({
  selector: 'app-notification-badge',
  templateUrl: './notification-badge.component.html',
  styleUrls: ['./notification-badge.component.scss'],
  standalone: true,
  imports: [CommonModule, IonButton, IonIcon, IonBadge]
})
export class NotificationBadgeComponent implements OnInit, OnDestroy {
  @Input() showInvitationsOnly: boolean = false;

  private readonly router = inject(Router);
  private readonly memberService = inject(FamilyMemberService);
  private readonly destroy$ = new Subject<void>();

  totalCount = 0;
  invitationCount = 0;

  constructor() {
    addIcons({ notificationsOutline, mailOutline });
  }

  ngOnInit() {
    this.subscribeToNotifications();
    this.loadNotifications();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToNotifications() {
    this.memberService.pendingInvitations$
      .pipe(takeUntil(this.destroy$))
      .subscribe(invitations => {
        this.invitationCount = invitations.filter(inv =>
          inv.status === 'pending' && !this.isExpired(inv.expiresAt)
        ).length;

        this.updateTotalCount();
      });
  }

  private loadNotifications() {
    this.memberService.getPendingInvitations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: (error) => {
          console.error('Failed to load notifications:', error);
        }
      });
  }

  private updateTotalCount() {
    if (this.showInvitationsOnly) {
      this.totalCount = this.invitationCount;
    } else {
      // In the future, add other notification types
      this.totalCount = this.invitationCount;
    }
  }

  private isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  async openNotifications() {
    if (this.showInvitationsOnly) {
      await this.router.navigate(['/invitations']);
    } else {
      // For now, just navigate to invitations
      // In the future, could open a notifications menu
      await this.router.navigate(['/invitations']);
    }
  }
}
