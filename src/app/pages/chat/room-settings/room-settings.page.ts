import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil, finalize } from 'rxjs';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
  IonIcon, IonItem, IonInput, IonTextarea, IonLabel,
  IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonToggle,
  IonAvatar, IonChip,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline, settingsOutline, saveOutline, trashOutline,
  peopleOutline, personAddOutline, personRemoveOutline, shieldCheckmarkOutline,
  notificationsOutline, lockClosedOutline, eyeOutline, createOutline
} from 'ionicons/icons';

import { ChatService } from '../../../core/services/chat/chat.service';
import { FamilyMemberService } from '../../../core/services/family-member/family-member.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ToastService } from '../../../shared/services/toast.service';
import {
  ChatRoom,
  ChatRoomMember,
  UpdateChatRoomRequest,
  ChatRoomTypeEnum,
  getChatRoomTypeName
} from '../../../models/chat/chat.models';
import { FamilyMember } from '../../../models/families/family.models';

@Component({
  selector: 'app-room-settings',
  templateUrl: './room-settings.page.html',
  styleUrls: ['./room-settings.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonButton, IonButtons,
    IonIcon, IonItem, IonInput, IonTextarea, IonLabel,
    IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonToggle,
    IonAvatar, IonChip
  ]
})
export class RoomSettingsPage implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);
  private readonly chatService = inject(ChatService);
  private readonly memberService = inject(FamilyMemberService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  readonly chatRoom = this.chatService.currentChatRoom;
  readonly isLoading = signal<boolean>(false);
  readonly familySlug = signal<string>('');
  readonly roomId = signal<number>(0);
  readonly familyMembers = signal<FamilyMember[]>([]);
  readonly roomMembers = signal<ChatRoomMember[]>([]);

  settingsForm!: FormGroup;
  readonly currentUser = this.authService.user;
  readonly ChatRoomTypeEnum = ChatRoomTypeEnum;

  constructor() {
    this.addIcons();
    this.initializeForm();
  }

  ngOnInit() {
    const familySlug = this.route.snapshot.paramMap.get('slug') || '';
    const roomIdStr = this.route.snapshot.paramMap.get('roomId') || '';
    const roomId = parseInt(roomIdStr, 10);

    this.familySlug.set(familySlug);
    this.roomId.set(roomId);

    if (familySlug && roomId) {
      this.loadRoomData();
      this.loadFamilyMembers();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private addIcons() {
    addIcons({
      arrowBackOutline, settingsOutline, saveOutline, trashOutline,
      peopleOutline, personAddOutline, personRemoveOutline, shieldCheckmarkOutline,
      notificationsOutline, lockClosedOutline, eyeOutline, createOutline
    });
  }

  private initializeForm() {
    this.settingsForm = this.formBuilder.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      description: ['', [Validators.maxLength(200)]],
      isPrivate: [false]
    });
  }

  private loadRoomData() {
    this.isLoading.set(true);

    this.chatService.getChatRoom(this.familySlug(), this.roomId())
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          const room = this.chatRoom();
          if (room) {
            this.settingsForm.patchValue({
              name: room.name,
              description: room.description || '',
              isPrivate: room.isPrivate
            });
            this.roomMembers.set(room.members || []);
          }
        },
        error: (error) => {
          console.error('Load room error:', error);
          this.toastService.showToast('Failed to load room settings.', 'danger');
          this.goBack();
        }
      });
  }

  private loadFamilyMembers() {
    this.memberService.getFamilyMembers(this.familySlug())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.familyMembers.set(response.data);
        },
        error: (error) => {
          console.error('Load family members error:', error);
        }
      });
  }

  async goBack() {
    await this.router.navigate(['/family', this.familySlug(), 'chat', this.roomId()]);
  }

  async onSaveSettings() {
    if (!this.settingsForm.valid) return;

    const request: UpdateChatRoomRequest = {
      name: this.settingsForm.value.name.trim(),
      description: this.settingsForm.value.description?.trim() || undefined,
      isPrivate: this.settingsForm.value.isPrivate
    };

    this.isLoading.set(true);

    this.chatService.updateChatRoom(this.familySlug(), this.roomId(), request)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          this.toastService.showToast('Room settings updated successfully!', 'success');
        },
        error: (error) => {
          console.error('Update room error:', error);
          this.toastService.showToast('Failed to update room settings.', 'danger');
        }
      });
  }

  async addMembers() {
    const currentMemberIds = this.roomMembers().map(m => m.userId);
    const availableMembers = this.familyMembers().filter(
      member => !currentMemberIds.includes(member.userId)
    );

    if (availableMembers.length === 0) {
      await this.toastService.showToast('All family members are already in this room.', 'warning');
      return;
    }

    // In a real implementation, this would open a member selection modal
    await this.toastService.showToast('Add members feature coming soon!', 'warning');
  }

  async removeMember(member: ChatRoomMember) {
    if (member.userId === this.currentUser()?.id) {
      await this.toastService.showToast('You cannot remove yourself from the room.', 'warning');
      return;
    }

    const confirmed = await this.toastService.showDestructiveConfirmation(
      'Remove Member',
      `Are you sure you want to remove this member from the chat room?`,
      'Remove',
      'Cancel'
    );

    if (confirmed) {
      // In a real implementation, this would call a remove member API
      await this.toastService.showToast('Remove member feature coming soon!', 'warning');
    }
  }

  async toggleMemberAdmin(member: ChatRoomMember) {
    // In a real implementation, this would call an update member role API
    await this.toastService.showToast('Toggle admin feature coming soon!', 'warning');
  }

  async deleteRoom() {
    const room = this.chatRoom();
    if (!room) return;

    const confirmed = await this.toastService.showDeleteConfirmation(room.name, 'Chat Room');

    if (confirmed) {
      this.isLoading.set(true);

      this.chatService.deleteChatRoom(this.familySlug(), this.roomId())
        .pipe(
          finalize(() => this.isLoading.set(false)),
          takeUntil(this.destroy$)
        )
        .subscribe({
          next: async () => {
            await this.toastService.showToast('Chat room deleted successfully!', 'success');
            await this.router.navigate(['/family', this.familySlug(), 'chat']);
          },
          error: (error) => {
            console.error('Delete room error:', error);
            this.toastService.showToast('Failed to delete chat room.', 'danger');
          }
        });
    }
  }

  getChatRoomTypeName(type: ChatRoomTypeEnum): string {
    return getChatRoomTypeName(type);
  }

  isCurrentUserAdmin(): boolean {
    const currentUserId = this.currentUser()?.id;
    if (!currentUserId) return false;

    const currentMember = this.roomMembers().find(m => m.userId === currentUserId);
    return currentMember?.isAdmin || false;
  }

  canManageRoom(): boolean {
    return this.isCurrentUserAdmin();
  }

  getMemberName(member: ChatRoomMember): string {
    return member.user?.name || 'Unknown User';
  }

  getMemberAvatar(member: ChatRoomMember): string {
    return member.user?.avatar || 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png?20150327203541';
  }
}
