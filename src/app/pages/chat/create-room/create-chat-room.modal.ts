import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonButtons,
  IonIcon,
  IonItem,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonLabel,
  IonCheckbox,
  IonModal,
  IonList,
  IonAvatar,
  IonChip,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personCircleOutline } from 'ionicons/icons';
import {
  closeOutline,
  chatbubbleOutline,
  peopleOutline,
  personOutline,
  megaphoneOutline,
  warningOutline,
  createOutline,
  addOutline,
  radioButtonOnOutline,
  radioButtonOffOutline,
  lockClosedOutline,
  informationCircleOutline,
  hourglassOutline,
} from 'ionicons/icons';

import { ModalController } from '@ionic/angular';
import {
  ChatRoomTypeEnum,
  CreateChatRoomRequest,
  getChatRoomTypeName,
  getChatRoomTypeIcon,
} from '../../../models/chat/chat.models';
import { FamilyMember, Family } from '../../../models/families/family.models';
import { ValidationErrorDirective } from '../../../shared/directives/validation-error.directive';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ChatService } from '../../../core/services/chat/chat.service';
import { ToastService } from '../../../shared/services/toast.service';

export interface CreateChatRoomResult {
  name: string;
  description?: string;
  type: ChatRoomTypeEnum;
  memberIds: number[];
  isPrivate: boolean;
}

@Component({
  selector: 'app-create-chat-room-modal',
  templateUrl: './create-chat-room.modal.html',
  styleUrls: ['./create-chat-room.modal.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonButtons,
    IonIcon,
    IonItem,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonLabel,
    IonCheckbox,
    IonModal,
    IonList,
    IonAvatar,
    IonChip,
    ValidationErrorDirective,
  ],
})
export class CreateChatRoomModal implements OnInit {
  @Input() family?: Family;
  @Input() familyMembers: FamilyMember[] = [];

  private readonly formBuilder = inject(FormBuilder);
  private readonly modalController = inject(ModalController);
  private readonly authService = inject(AuthService);
  private readonly chatService = inject(ChatService);
  private readonly toastService = inject(ToastService);

  chatRoomForm!: FormGroup;
  readonly isSubmitted = signal<boolean>(false);
  readonly isCreating = signal<boolean>(false);
  readonly selectedMembers = signal<number[]>([]);
  readonly ChatRoomTypeEnum = ChatRoomTypeEnum;
  readonly selectedRoomType = signal<ChatRoomTypeEnum>(ChatRoomTypeEnum.GROUP);
  readonly isDirectMessage = computed(
    () => this.selectedRoomType() === ChatRoomTypeEnum.DIRECT
  );
  readonly currentUser = computed(() => this.authService.user());
  readonly availableMembers = computed(() => {
    const currentUserId = this.currentUser()?.id;
    if (!currentUserId) return this.familyMembers;
    return this.familyMembers.filter(
      (member) => member.userId !== currentUserId
    );
  });

  readonly roomTypes = [
    {
      value: ChatRoomTypeEnum.GROUP,
      label: getChatRoomTypeName(ChatRoomTypeEnum.GROUP),
      icon: getChatRoomTypeIcon(ChatRoomTypeEnum.GROUP),
      description: 'Everyone can participate and see messages',
    },
    {
      value: ChatRoomTypeEnum.DIRECT,
      label: getChatRoomTypeName(ChatRoomTypeEnum.DIRECT),
      icon: getChatRoomTypeIcon(ChatRoomTypeEnum.DIRECT),
      description: 'Private conversation between selected members',
    },
    {
      value: ChatRoomTypeEnum.ANNOUNCEMENT,
      label: getChatRoomTypeName(ChatRoomTypeEnum.ANNOUNCEMENT),
      icon: getChatRoomTypeIcon(ChatRoomTypeEnum.ANNOUNCEMENT),
      description: 'Only moderators can send messages',
    },
    {
      value: ChatRoomTypeEnum.EMERGENCY,
      label: getChatRoomTypeName(ChatRoomTypeEnum.EMERGENCY),
      icon: getChatRoomTypeIcon(ChatRoomTypeEnum.EMERGENCY),
      description: 'Important notifications and alerts',
    },
  ];

  constructor() {
    this.addIcons();
    this.initializeForm();
  }

  ngOnInit() {
    // Pre-select all available members by default (excluding current user)
    const allMemberIds =
      this.availableMembers().map((member) => member.userId) || [];
    this.selectedMembers.set(allMemberIds);
    if (this.chatRoomForm) {
      this.chatRoomForm.patchValue({
        memberIds: allMemberIds,
      });
    }
  }

  private addIcons() {
    addIcons({
      closeOutline,
      chatbubbleOutline,
      peopleOutline,
      personOutline,
      personCircleOutline,
      megaphoneOutline,
      warningOutline,
      createOutline,
      addOutline,
      radioButtonOnOutline,
      radioButtonOffOutline,
      lockClosedOutline,
      informationCircleOutline,
      hourglassOutline,
    });
  }

  private initializeForm() {
    this.chatRoomForm = this.formBuilder.group({
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(50),
        ],
      ],
      description: ['', [Validators.maxLength(200)]],
      type: [ChatRoomTypeEnum.GROUP, [Validators.required]],
      memberIds: [[], [Validators.required, Validators.minLength(1)]],
      isPrivate: [false],
    });

    // Watch for room type changes
    this.chatRoomForm
      .get('type')
      ?.valueChanges.subscribe((type: ChatRoomTypeEnum) => {
      this.selectedRoomType.set(type);
      this.onRoomTypeChanged(type);
    });
  }

  private onRoomTypeChanged(type: ChatRoomTypeEnum) {
    if (type === ChatRoomTypeEnum.DIRECT) {
      // For direct messages, limit to 1 other member (excluding current user)
      // Clear current selection and automatically set isPrivate to true
      this.selectedMembers.set([]);
      this.chatRoomForm.get('isPrivate')?.setValue(true);

      // For direct messages, disable and clear validators for the name field
      const nameCtrl = this.chatRoomForm.get('name');
      nameCtrl?.clearValidators();
      nameCtrl?.setValue('');
      nameCtrl?.disable();
    } else {
      // For other types, enable name field and require it
      this.chatRoomForm.get('name')?.enable();
      this.chatRoomForm
        .get('name')
        ?.setValidators([
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(50),
        ]);
      this.chatRoomForm.get('isPrivate')?.setValue(false);
    }

    this.chatRoomForm.get('name')?.updateValueAndValidity();
  }

  async dismiss() {
    await this.modalController.dismiss();
  }

  async onCreateRoom() {
    this.isSubmitted.set(true);

    if (!this.chatRoomForm) {
      return;
    }

    // Direct message: call dedicated endpoint and skip name validation
    if (this.isDirectMessage()) {
      if (this.selectedMembers().length !== 1) {
        this.markFormGroupTouched();
        return;
      }

      this.isCreating.set(true);
      try {
        const familySlug = this.family?.slug;
        if (!familySlug) throw new Error('Family not found');

        const otherMemberId = this.selectedMembers()[0];
        this.chatService
          .findOrCreateDirectMessage(familySlug, otherMemberId)
          .subscribe({
            next: async () => {
              this.toastService.showToast('Direct message ready!', 'success');
              this.isCreating.set(false);
              await this.modalController.dismiss({ created: true }, 'confirm');
            },
            error: (error) => {
              console.error('Create direct message error:', error);
              this.toastService.showToast(
                'Failed to create direct message. Please try again.',
                'danger'
              );
              this.isCreating.set(false);
            },
          });
      } catch (error) {
        console.error('Direct message setup error:', error);
        this.toastService.showToast(
          'Failed to create direct message. Please try again.',
          'danger'
        );
        this.isCreating.set(false);
      }
      return;
    }

    // Non-direct: validate full form (including name)
    if (!this.chatRoomForm.valid) {
      this.markFormGroupTouched();
      return;
    }

    this.isCreating.set(true);

    try {
      // Include current user in the member list
      const currentUserId = this.currentUser()?.id;
      const memberIds = [...this.selectedMembers()];
      if (currentUserId && !memberIds.includes(currentUserId)) {
        memberIds.push(currentUserId);
      }

      // Group/other types: use entered name
      const roomName = this.chatRoomForm.value.name?.trim() || '';

      const request: CreateChatRoomRequest = {
        name: roomName,
        description: this.chatRoomForm.value.description?.trim() || undefined,
        type: this.chatRoomForm.value.type,
        memberIds: memberIds,
        isPrivate: this.chatRoomForm.value.isPrivate || false,
      };

      const familySlug = this.family?.slug;
      if (!familySlug) {
        throw new Error('Family not found');
      }

      this.chatService.createChatRoom(familySlug, request).subscribe({
        next: async (response) => {
          this.toastService.showToast(
            'Chat room created successfully!',
            'success'
          );
          this.isCreating.set(false);
          await this.modalController.dismiss({ created: true }, 'confirm');
        },
        error: (error) => {
          console.error('Create chat room error:', error);
          this.toastService.showToast(
            'Failed to create chat room. Please try again.',
            'danger'
          );
          this.isCreating.set(false);
        },
      });
    } catch (error) {
      console.error('Create chat room setup error:', error);
      this.toastService.showToast(
        'Failed to create chat room. Please try again.',
        'danger'
      );
      this.isCreating.set(false);
    }
  }

  onMemberToggle(memberId: number, event: any) {
    const isChecked = event.detail.checked;
    const currentSelected = this.selectedMembers();

    if (isChecked) {
      // For direct messages, limit to 1 other member
      if (this.isDirectMessage()) {
        this.selectedMembers.set([memberId]);
      } else {
        this.selectedMembers.set([...currentSelected, memberId]);
      }
    } else {
      this.selectedMembers.set(currentSelected.filter((id) => id !== memberId));
    }

    if (this.chatRoomForm) {
      this.chatRoomForm.patchValue({
        memberIds: this.selectedMembers(),
      });
    }
  }

  toggleAllMembers() {
    const allMemberIds =
      this.availableMembers().map((member) => member.userId) || [];
    const currentSelected = this.selectedMembers();

    if (currentSelected.length === allMemberIds.length) {
      // Deselect all
      this.selectedMembers.set([]);
    } else {
      // Select all
      this.selectedMembers.set(allMemberIds);
    }

    if (this.chatRoomForm) {
      this.chatRoomForm.patchValue({
        memberIds: this.selectedMembers(),
      });
    }
  }

  isMemberSelected(memberId: number): boolean {
    return this.selectedMembers().includes(memberId);
  }

  getRoomTypeIcon(type: ChatRoomTypeEnum): string {
    return getChatRoomTypeIcon(type);
  }

  getRoomTypeName(type: ChatRoomTypeEnum): string {
    return getChatRoomTypeName(type);
  }

  private markFormGroupTouched() {
    if (this.chatRoomForm) {
      Object.keys(this.chatRoomForm.controls).forEach((key) => {
        this.chatRoomForm.get(key)?.markAsTouched();
      });
    }
  }

  get selectedCount(): number {
    return this.selectedMembers().length;
  }

  get totalMembers(): number {
    return this.availableMembers().length || 0;
  }
}
