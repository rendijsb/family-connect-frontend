import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewInit,
  effect,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {Router, ActivatedRoute} from '@angular/router';
import {Subject, takeUntil, debounceTime} from 'rxjs';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButton,
  IonButtons,
  IonIcon,
  IonTextarea,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonRefresher,
  IonRefresherContent,
  IonAvatar,
  IonSkeletonText,
} from '@ionic/angular/standalone';
import {addIcons} from 'ionicons';
import {
  arrowBackOutline,
  sendOutline,
  attachOutline,
  micOutline,
  cameraOutline,
  imageOutline,
  documentOutline,
  locationOutline,
  addCircleOutline,
  ellipsisVerticalOutline,
  heartOutline,
  happyOutline,
  sadOutline,
  thumbsUpOutline,
  thumbsDownOutline,
  playOutline,
  copyOutline,
  trashOutline,
  createOutline,
  flagOutline,
  informationCircleOutline,
  timeOutline,
  checkmarkDoneOutline,
  closeOutline,
  arrowUndoOutline,
  alertCircleOutline,
  checkmarkOutline,
  videocamOutline,
  addOutline,
  arrowDownOutline,
} from 'ionicons/icons';

import {ChatService} from '../../../core/services/chat/chat.service';
import {AuthService} from '../../../core/services/auth/auth.service';
import {ToastService} from '../../../shared/services/toast.service';
import {
  ChatRoom,
  ChatMessage,
  MessageTypeEnum,
  ChatRoomTypeEnum, // Added missing import
  SendMessageRequest,
  isMessageFromCurrentUser,
  shouldShowAvatar,
  shouldShowTimestamp,
  formatMessageTime,
  formatMessageDate,
  getChatRoomTypeIcon,
} from '../../../models/chat/chat.models';

@Component({
  selector: 'app-chat-room',
  templateUrl: './chat-room.page.html',
  styleUrls: ['./chat-room.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonButtons,
    IonIcon,
    IonTextarea,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonRefresher,
    IonRefresherContent,
    IonAvatar,
    IonSkeletonText,
  ],
})
export class ChatRoomPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLIonTextareaElement>;

  private readonly destroy$ = new Subject<void>();
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly chatService = inject(ChatService);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  // Typing indicator subject
  private readonly typingSubject = new Subject<void>();

  // State signals
  readonly chatRoom = this.chatService.currentChatRoom;
  readonly messages = this.chatService.messages;
  readonly isLoadingMessages = this.chatService.isLoadingMessages;
  readonly typingUsers = this.chatService.typingUsers;
  readonly typingUsersText = this.chatService.typingUsersText;

  readonly familySlug = signal<string>('');
  readonly roomId = signal<number>(0);
  readonly messageText = signal<string>('');
  readonly replyingTo = signal<ChatMessage | null>(null);
  readonly showEmojiPicker = signal<boolean>(false);
  readonly isRecording = signal<boolean>(false);
  readonly currentPage = signal<number>(1);
  readonly hasMoreMessages = signal<boolean>(true);
  readonly isWebSocketConnected = signal<boolean>(false);
  readonly connectionError = signal<string | null>(null);
  private connectionRetryCount = 0;
  private maxRetries = 3;

  // Common emoji reactions
  readonly commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];

  readonly currentUser = computed(() => this.authService.user());
  readonly MessageTypeEnum = MessageTypeEnum;
  readonly ChatRoomTypeEnum = ChatRoomTypeEnum; // Added missing enum

  constructor() {
    this.addIcons();
    this.setupTypingIndicator();
    this.setupAutoScroll();
  }

  ngOnInit() {
    const familySlug = this.route.snapshot.paramMap.get('slug') || '';
    const roomIdStr = this.route.snapshot.paramMap.get('roomId') || '';
    const roomId = parseInt(roomIdStr, 10);

    this.familySlug.set(familySlug);
    this.roomId.set(roomId);

    if (familySlug && roomId) {
      this.loadChatRoom();
    } else {
      console.error('Invalid route parameters');
      this.goBack();
    }
  }

  ngAfterViewInit() {
    // View is ready
  }

  private setupAutoScroll() {
    effect(() => {
      const messages = this.messages();
      if (messages.length > 0) {
        setTimeout(() => this.scrollToBottom(), 100);
      }
    });
  }

  private async initializeRealtimeFeatures(roomId: number): Promise<void> {
    console.log('🚀 Initializing real-time features for room:', roomId);

    this.connectionError.set(null);

    try {
      // Step 1: Initialize WebSocket connection
      console.log('🔌 Step 1: Initializing WebSocket connection...');
      await this.chatService.initializeWebSocket();

      // Step 2: Wait a moment for connection to stabilize
      await this.delay(1000);

      // Step 3: Join the chat room
      console.log('🏠 Step 2: Joining chat room...');
      this.chatService.joinChatRoom(roomId);

      // Step 4: Subscribe to real-time events
      console.log('📡 Step 3: Setting up real-time event subscriptions...');
      this.subscribeToRealTimeEvents();

      this.isWebSocketConnected.set(true);
      this.connectionRetryCount = 0;

      console.log('✅ Real-time features initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize real-time features:', error);
      this.connectionError.set('Failed to connect to real-time chat');
      this.isWebSocketConnected.set(false);

      // Retry with exponential backoff
      await this.retryConnection(roomId);
    }
  }

  private async retryConnection(roomId: number): Promise<void> {
    if (this.connectionRetryCount >= this.maxRetries) {
      console.error('❌ Max connection retries reached');
      this.connectionError.set('Unable to establish real-time connection. Please refresh the page.');
      return;
    }

    this.connectionRetryCount++;
    const retryDelay = Math.pow(2, this.connectionRetryCount) * 1000; // Exponential backoff

    console.log(`🔄 Retrying connection (${this.connectionRetryCount}/${this.maxRetries}) in ${retryDelay}ms...`);

    await this.delay(retryDelay);

    try {
      await this.initializeRealtimeFeatures(roomId);
    } catch (error) {
      console.error(`❌ Retry ${this.connectionRetryCount} failed:`, error);
      await this.retryConnection(roomId);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private subscribeToRealTimeEvents() {
    console.log('📡 Setting up real-time event subscriptions...');

    // Subscribe to new messages
    this.chatService
      .getMessageReceivedStream()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message) => {
          console.log('📨 Real-time message received in component:', message);

          // Scroll to bottom for new messages (but not for older messages during pagination)
          const currentRoom = this.chatService.currentChatRoom();
          if (currentRoom && message.chatRoomId === currentRoom.id) {
            // Small delay to allow DOM to update
            setTimeout(() => {
              this.scrollToBottom();
            }, 100);
          }
        },
        error: (error) => {
          console.error('❌ Error receiving real-time message:', error);
          this.handleRealtimeError('Failed to receive messages');
        },
      });

    // Subscribe to message updates
    this.chatService
      .getMessageUpdatedStream()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message) => {
          console.log('📝 Real-time message updated in component:', message);
        },
        error: (error) => {
          console.error('❌ Error receiving message update:', error);
          this.handleRealtimeError('Failed to receive message updates');
        },
      });

    // Subscribe to message deletions
    this.chatService
      .getMessageDeletedStream()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (messageId) => {
          console.log('🗑️ Real-time message deleted in component:', messageId);
        },
        error: (error) => {
          console.error('❌ Error receiving message deletion:', error);
          this.handleRealtimeError('Failed to receive message deletions');
        },
      });

    console.log('✅ Real-time event subscriptions set up');
  }

  private handleRealtimeError(message: string) {
    this.connectionError.set(message);
    this.isWebSocketConnected.set(false);

    // Show toast for user feedback
    this.toastService.showToast(message, 'warning');
  }

// Replace the existing sendMessage method with retry logic
  async sendMessage() {
    const text = this.messageText().trim();
    if (!text) return;

    const request: SendMessageRequest = {
      message: text,
      type: MessageTypeEnum.TEXT,
      replyToId: this.replyingTo()?.id,
    };

    // Clear input immediately for better UX
    this.messageText.set('');
    this.replyingTo.set(null);

    this.chatService
      .sendMessage(this.familySlug(), this.roomId(), request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✅ Message sent successfully');
          // Message will be added to UI via real-time events
          setTimeout(() => this.scrollToBottom(), 100);
        },
        error: (error) => {
          console.error('❌ Send message error:', error);

          // Restore message text on error
          this.messageText.set(text);

          // Show error and offer retry
          this.toastService.showToast('Failed to send message. Please try again.', 'danger');
        },
      });
  }

  ngOnDestroy() {
    console.log('🔄 ChatRoomPage destroying, cleaning up...');

    try {
      this.chatService.leaveChatRoom();
    } catch (error) {
      console.error('Error leaving chat room:', error);
    }

    this.destroy$.next();
    this.destroy$.complete();

    this.chatService.clearCurrentRoom();

    console.log('✅ ChatRoomPage cleanup complete');
  }

  private addIcons() {
    addIcons({
      arrowBackOutline,
      sendOutline,
      attachOutline,
      micOutline,
      cameraOutline,
      imageOutline,
      documentOutline,
      locationOutline,
      addCircleOutline,
      ellipsisVerticalOutline,
      heartOutline,
      happyOutline,
      sadOutline,
      thumbsUpOutline,
      thumbsDownOutline,
      playOutline,
      copyOutline,
      trashOutline,
      createOutline,
      flagOutline,
      informationCircleOutline,
      timeOutline,
      checkmarkDoneOutline,
      closeOutline,
      'arrow-undo-outline': arrowUndoOutline, // Reply icon
      alertCircleOutline,
      checkmarkOutline,
      videocamOutline,
      addOutline,
      arrowDownOutline,
    });
  }

  private setupTypingIndicator() {
    this.typingSubject
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe(() => {
        this.sendTypingIndicator();
      });
  }

  private loadChatRoom() {
    this.chatService
      .getChatRoom(this.familySlug(), this.roomId())
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async () => {
          console.log('✅ Chat room loaded successfully');

          // Mark as read when opening room
          this.markAsRead();

          // Load initial messages
          await this.loadMessages();

          // Initialize real-time features after room is loaded
          await this.initializeRealtimeFeatures(this.roomId());
        },
        error: (error) => {
          console.error('❌ Load chat room error:', error);
          this.toastService.showToast('Failed to load chat room.', 'danger');
          this.goBack();
        },
      });
  }

  private loadMessages(page: number = 1) {
    this.chatService
      .getMessages(this.familySlug(), this.roomId(), page)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.data.length < 50) {
            this.hasMoreMessages.set(false);
          }
          if (page === 1) {
            setTimeout(() => this.scrollToBottom(), 100);
          }
        },
        error: (error) => {
          console.error('Load messages error:', error);
          this.toastService.showToast('Failed to load messages.', 'danger');
        },
      });
  }

  private markAsRead() {
    this.chatService
      .markAsRead(this.familySlug(), this.roomId())
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  private sendTypingIndicator() {
    this.chatService
      .sendTypingIndicator(this.familySlug(), this.roomId())
      .pipe(takeUntil(this.destroy$))
      .subscribe();
  }

  private scrollToBottom() {
    this.content?.scrollToBottom(300);
  }

  // Event Handlers
  async goBack() {
    await this.router.navigate(['/family', this.familySlug(), 'chat']);
  }

  doRefresh(event: any) {
    this.currentPage.set(1);
    this.hasMoreMessages.set(true);
    this.loadMessages(1);
    setTimeout(() => event.target.complete(), 1000);
  }

  onInfiniteScroll(event: any) {
    if (this.hasMoreMessages()) {
      const nextPage = this.currentPage() + 1;
      this.currentPage.set(nextPage);
      this.loadMessages(nextPage);
    }
    setTimeout(() => event.target.complete(), 1000);
  }

  onMessageInputChange() {
    this.typingSubject.next();
  }

  onMessageKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // Missing methods that were referenced in template
  getRoomMemberCount(chatRoom: ChatRoom): string {
    return `${chatRoom.members?.length || 0}`;
  }

  async openRoomInfo() {
    // Navigate to room info page or show modal
    await this.toastService.showToast('Room info coming soon!', 'warning');
  }

  scrollToMessage(message: ChatMessage) {
    // Find and scroll to specific message
    const messageElement = document.querySelector(
      `[data-message-id="${message.id}"]`
    );
    if (messageElement) {
      messageElement.scrollIntoView({behavior: 'smooth', block: 'center'});
    }
  }

  isRealtimeConnected(): boolean {
    return this.isWebSocketConnected() && !this.connectionError();
  }

  async retryRealtimeConnection() {
    this.connectionRetryCount = 0;
    this.connectionError.set(null);
    await this.initializeRealtimeFeatures(this.roomId());
  }

  getMessagePreview(message: ChatMessage): string {
    if (message.isDeleted) return 'This message was deleted';

    switch (message.type) {
      case MessageTypeEnum.TEXT:
        return message.message.length > 50
          ? message.message.substring(0, 50) + '...'
          : message.message;
      case MessageTypeEnum.IMAGE:
        return '📷 Photo';
      case MessageTypeEnum.VIDEO:
        return '🎥 Video';
      case MessageTypeEnum.AUDIO:
        return '🎵 Voice message';
      case MessageTypeEnum.FILE:
        return '📄 Document';
      case MessageTypeEnum.LOCATION:
        return '📍 Location';
      default:
        return message.message || 'Message';
    }
  }

  async presentAttachmentOptions() {
    const buttons = [
      {
        text: 'Camera',
        icon: 'camera-outline',
        handler: () => this.openCamera(),
      },
      {
        text: 'Photo & Video Library',
        icon: 'image-outline',
        handler: () => this.openGallery(),
      },
      {
        text: 'Document',
        icon: 'document-outline',
        handler: () => this.openDocuments(),
      },
      {
        text: 'Location',
        icon: 'location-outline',
        handler: () => this.shareLocation(),
      },
    ];

    await this.toastService.showActionSheet('Add Attachment', buttons);
  }

  async presentMessageOptions(message: ChatMessage, event: Event) {
    event.stopPropagation();

    const buttons: any[] = [
      {
        text: 'Reply',
        icon: 'arrow-undo-outline',
        handler: () => this.replyToMessage(message),
      },
      {
        text: 'Copy Text',
        icon: 'copy-outline',
        handler: () => this.copyMessageText(message),
      },
    ];

    if (this.isCurrentUserMessage(message)) {
      buttons.push(
        {
          text: 'Edit',
          icon: 'create-outline',
          handler: () => this.editMessage(message),
        },
        {
          text: 'Delete',
          icon: 'trash-outline',
          cssClass: 'destructive-button', // Use cssClass instead of role
          handler: () => this.confirmDeleteMessage(message),
        }
      );
    } else {
      buttons.push({
        text: 'Report',
        icon: 'flag-outline',
        handler: () => this.reportMessage(message),
      });
    }

    await this.toastService.showActionSheet('Message Options', buttons);
  }

  async presentEmojiPicker(message: ChatMessage) {
    const alert = document.createElement('ion-alert');
    alert.header = 'Add Reaction';
    alert.cssClass = 'emoji-alert';

    // Create emoji buttons
    const buttons = this.commonEmojis.map((emoji) => ({
      text: emoji,
      cssClass: 'emoji-button',
      handler: () => this.addReaction(message, emoji),
    }));

    // Add cancel button
    buttons.push({
      text: 'Cancel',
      cssClass: 'cancel-button',
      handler: () => alert.dismiss(),
    });

    alert.buttons = buttons;
    document.body.appendChild(alert);
    await alert.present();
  }

  // Message Actions
  replyToMessage(message: ChatMessage) {
    this.replyingTo.set(message);
    this.messageInput.nativeElement.focus();
  }

  cancelReply() {
    this.replyingTo.set(null);
  }

  async copyMessageText(message: ChatMessage) {
    await this.toastService.copyToClipboard(
      message.message,
      'Message copied to clipboard!'
    );
  }

  async editMessage(message: ChatMessage) {
    // Simple prompt for editing - in a full app, this would be a proper modal
    const alert = document.createElement('ion-alert');
    alert.header = 'Edit Message';
    alert.inputs = [
      {
        name: 'message',
        type: 'textarea',
        value: message.message,
        placeholder: 'Edit your message...',
      },
    ];
    alert.buttons = [
      {
        text: 'Cancel',
        handler: () => alert.dismiss(),
      },
      {
        text: 'Update',
        handler: (data: any) => {
          if (data.message && data.message.trim()) {
            this.updateMessage(message, data.message.trim());
          }
        },
      },
    ];

    document.body.appendChild(alert);
    await alert.present();
  }

  private updateMessage(message: ChatMessage, newText: string) {
    this.chatService
      .updateMessage(this.familySlug(), message.id, newText)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.showToast('Message updated', 'success');
        },
        error: () => {
          this.toastService.showToast('Failed to update message', 'danger');
        },
      });
  }

  async confirmDeleteMessage(message: ChatMessage) {
    const confirmed = await this.toastService.showDestructiveConfirmation(
      'Delete Message',
      'Are you sure you want to delete this message?',
      'Delete',
      'Cancel'
    );

    if (confirmed) {
      this.deleteMessage(message);
    }
  }

  private deleteMessage(message: ChatMessage) {
    this.chatService
      .deleteMessage(this.familySlug(), message.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastService.showToast('Message deleted', 'success');
        },
        error: () => {
          this.toastService.showToast('Failed to delete message', 'danger');
        },
      });
  }

  async reportMessage(message: ChatMessage) {
    await this.toastService.showToast(
      'Message reporting coming soon!',
      'warning'
    );
  }

  // Reactions
  addReaction(message: ChatMessage, emoji: string) {
    this.chatService
      .addReaction(this.familySlug(), message.id, emoji)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: () => {
          this.toastService.showToast('Failed to add reaction', 'danger');
        },
      });
  }

  removeReaction(message: ChatMessage, emoji: string) {
    this.chatService
      .removeReaction(this.familySlug(), message.id, emoji)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: () => {
          this.toastService.showToast('Failed to remove reaction', 'danger');
        },
      });
  }

  toggleReaction(message: ChatMessage, emoji: string) {
    const currentUserId = this.currentUser()?.id;
    if (!currentUserId) return;

    const existingReaction = message.reactions?.find(
      (r) => r.emoji === emoji && r.userId === currentUserId
    );

    if (existingReaction) {
      this.removeReaction(message, emoji);
    } else {
      this.addReaction(message, emoji);
    }
  }

  // Attachment handlers (placeholders)
  private async openCamera() {
    await this.toastService.showToast('Camera feature coming soon!', 'warning');
  }

  private async openGallery() {
    await this.toastService.showToast(
      'Gallery feature coming soon!',
      'warning'
    );
  }

  private async openDocuments() {
    await this.toastService.showToast(
      'Document attachment coming soon!',
      'warning'
    );
  }

  private async shareLocation() {
    await this.toastService.showToast(
      'Location sharing coming soon!',
      'warning'
    );
  }

  // Voice recording (placeholder)
  async toggleRecording() {
    if (this.isRecording()) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  private async startRecording() {
    this.isRecording.set(true);
    await this.toastService.showToast('Voice recording started', 'primary');
  }

  private async stopRecording() {
    this.isRecording.set(false);
    await this.toastService.showToast('Voice recording stopped', 'primary');
  }

  // Utility Methods
  trackByMessageId(index: number, message: ChatMessage): number {
    return message.id;
  }

  isCurrentUserMessage(message: ChatMessage): boolean {
    const currentUserId = this.currentUser()?.id;
    return currentUserId
      ? isMessageFromCurrentUser(message, currentUserId)
      : false;
  }

  shouldShowAvatar(index: number): boolean {
    const messages = this.messages();
    const currentMessage = messages[index];

    if (!currentMessage || index === messages.length - 1) return true;

    const nextMessage = messages[index + 1];
    if (!nextMessage) return true;

    // Show avatar if next message is from different user or there's a significant time gap
    const isDifferentUser = currentMessage.userId !== nextMessage.userId;
    const timeDiff =
      new Date(nextMessage.createdAt).getTime() -
      new Date(currentMessage.createdAt).getTime();
    const hasTimeGap = timeDiff > 300000; // 5 minutes

    return isDifferentUser || hasTimeGap;
  }

  shouldShowTimestamp(index: number): boolean {
    const messages = this.messages();
    if (index === 0) return true;

    const currentMessage = messages[index];
    const previousMessage = messages[index - 1];

    if (!currentMessage || !previousMessage) return true;

    const currentDate = new Date(currentMessage.createdAt).toDateString();
    const previousDate = new Date(previousMessage.createdAt).toDateString();

    return currentDate !== previousDate;
  }

  formatMessageTime(dateString: string): string {
    return formatMessageTime(dateString);
  }

  formatMessageDate(dateString: string): string {
    return formatMessageDate(dateString);
  }

  getReactionCount(message: ChatMessage, emoji: string): number {
    return message.reactions?.filter((r) => r.emoji === emoji).length || 0;
  }

  hasUserReacted(message: ChatMessage, emoji: string): boolean {
    const currentUserId = this.currentUser()?.id;
    if (!currentUserId) return false;

    return (
      message.reactions?.some(
        (r) => r.emoji === emoji && r.userId === currentUserId
      ) || false
    );
  }

  getUniqueReactions(message: ChatMessage): string[] {
    if (!message.reactions) return [];

    const uniqueEmojis = new Set(message.reactions.map((r) => r.emoji));
    return Array.from(uniqueEmojis);
  }

  getMessageStatus(message: ChatMessage): string {
    if (message.isSending) return 'sending';
    if (message.sendError) return 'failed';
    if (message.isDeleted) return 'deleted';
    return 'sent';
  }

  getMessageStatusIcon(message: ChatMessage): string {
    const status = this.getMessageStatus(message);
    switch (status) {
      case 'sending':
        return 'time-outline';
      case 'failed':
        return 'alert-circle-outline';
      case 'sent':
        return 'checkmark-outline';
      case 'deleted':
        return 'trash-outline';
      default:
        return 'checkmark-outline';
    }
  }

  protected readonly getChatRoomTypeIcon = getChatRoomTypeIcon;
}
