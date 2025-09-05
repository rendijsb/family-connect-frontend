import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject, interval } from 'rxjs';
import { tap, finalize, map, takeUntil } from 'rxjs';
import { ApiUrlService } from '../api.service';
import { AuthService } from '../auth/auth.service';
import { WebSocketService } from '../websocket/websocket.service';
import {
  ChatRoom,
  ChatMessage,
  MessageReaction,
  CreateChatRoomRequest,
  SendMessageRequest,
  UpdateChatRoomRequest,
  MessageTypeEnum,
  ChatRoomTypeEnum,
} from '../../../models/chat/chat.models';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

interface TypingUser {
  userId: number;
  userName: string;
  lastTyping: number;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly apiUrlService = inject(ApiUrlService);
  private readonly authService = inject(AuthService);
  private readonly webSocketService = inject(WebSocketService);

  // State signals
  private readonly _chatRooms = signal<ChatRoom[]>([]);
  private readonly _currentChatRoom = signal<ChatRoom | null>(null);
  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isLoadingMessages = signal<boolean>(false);
  private readonly _typingUsers = signal<TypingUser[]>([]);

  private currentChatChannel: any = null;
  private channelSubscriptions = new Map<number, any>();
  private typingTimeouts = new Map<number, any>();

  // Subjects for real-time updates
  private readonly messageReceived$ = new Subject<ChatMessage>();
  private readonly messageUpdated$ = new Subject<ChatMessage>();
  private readonly messageDeleted$ = new Subject<number>();
  private readonly typingStarted$ = new Subject<{
    roomId: number;
    user: any;
  }>();
  private readonly typingEnded$ = new Subject<{
    roomId: number;
    userId: number;
  }>();
  private readonly roomUpdated$ = new Subject<ChatRoom>();
  private readonly destroy$ = new Subject<void>();

  // Public readonly signals
  readonly chatRooms = this._chatRooms.asReadonly();
  readonly currentChatRoom = this._currentChatRoom.asReadonly();
  readonly messages = this._messages.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isLoadingMessages = this._isLoadingMessages.asReadonly();
  readonly typingUsers = this._typingUsers.asReadonly();

  // Computed signals
  readonly totalUnreadCount = computed(() => {
    return this._chatRooms().reduce(
      (total, room) => total + (room.unreadCount || 0),
      0
    );
  });

  readonly currentRoomUnreadCount = computed(() => {
    const currentRoom = this._currentChatRoom();
    return currentRoom?.unreadCount || 0;
  });

  readonly typingUsersText = computed(() => {
    const users = this._typingUsers();
    if (users.length === 0) return '';
    if (users.length === 1) return `${users[0].userName} is typing...`;
    if (users.length === 2)
      return `${users[0].userName} and ${users[1].userName} are typing...`;
    return `${users[0].userName} and ${users.length - 1} others are typing...`;
  });

  constructor() {
    this.startTypingCleanup();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnectWebSocket();
  }

  // Chat Rooms API
  getChatRooms(familySlug: string): Observable<ApiResponse<ChatRoom[]>> {
    this._isLoading.set(true);

    return this.http
      .get<ApiResponse<ChatRoom[]>>(
        this.apiUrlService.getUrl(`families/${familySlug}/chat/rooms`)
      )
      .pipe(
        tap((response) => {
          this._chatRooms.set(response.data);
        }),
        finalize(() => this._isLoading.set(false))
      );
  }

  getChatRoom(
    familySlug: string,
    roomId: number
  ): Observable<ApiResponse<ChatRoom>> {
    return this.http
      .get<ApiResponse<ChatRoom>>(
        this.apiUrlService.getUrl(`families/${familySlug}/chat/rooms/${roomId}`)
      )
      .pipe(
        tap((response) => {
          this._currentChatRoom.set(response.data);
          this.updateChatRoomInList(response.data);
        })
      );
  }

  createChatRoom(
    familySlug: string,
    request: CreateChatRoomRequest
  ): Observable<ApiResponse<ChatRoom>> {
    this._isLoading.set(true);

    return this.http
      .post<ApiResponse<ChatRoom>>(
        this.apiUrlService.getUrl(`families/${familySlug}/chat/rooms`),
        request
      )
      .pipe(
        tap((response) => {
          const currentRooms = this._chatRooms();
          this._chatRooms.set([response.data, ...currentRooms]);
        }),
        finalize(() => this._isLoading.set(false))
      );
  }

  findOrCreateDirectMessage(
    familySlug: string,
    otherUserId: number
  ): Observable<ApiResponse<ChatRoom>> {
    this._isLoading.set(true);

    return this.http
      .post<ApiResponse<ChatRoom>>(
        this.apiUrlService.getUrl(`families/${familySlug}/chat/rooms/direct`),
        { otherUserId }
      )
      .pipe(
        tap((response) => {
          const currentRooms = this._chatRooms();
          const existingRoom = currentRooms.find(
            (room) => room.id === response.data.id
          );
          if (!existingRoom) {
            this._chatRooms.set([response.data, ...currentRooms]);
          }
        }),
        finalize(() => this._isLoading.set(false))
      );
  }

  updateChatRoom(
    familySlug: string,
    roomId: number,
    request: UpdateChatRoomRequest
  ): Observable<ApiResponse<ChatRoom>> {
    return this.http
      .put<ApiResponse<ChatRoom>>(
        this.apiUrlService.getUrl(
          `families/${familySlug}/chat/rooms/${roomId}`
        ),
        request
      )
      .pipe(
        tap((response) => {
          this.updateChatRoomInList(response.data);
          if (this._currentChatRoom()?.id === roomId) {
            this._currentChatRoom.set(response.data);
          }
        })
      );
  }

  deleteChatRoom(
    familySlug: string,
    roomId: number
  ): Observable<ApiResponse<void>> {
    return this.http
      .delete<ApiResponse<void>>(
        this.apiUrlService.getUrl(`families/${familySlug}/chat/rooms/${roomId}`)
      )
      .pipe(
        tap(() => {
          const currentRooms = this._chatRooms();
          this._chatRooms.set(
            currentRooms.filter((room) => room.id !== roomId)
          );
          if (this._currentChatRoom()?.id === roomId) {
            this._currentChatRoom.set(null);
          }
        })
      );
  }

  // Messages API
  getMessages(
    familySlug: string,
    roomId: number,
    page: number = 1,
    perPage: number = 50
  ): Observable<ApiResponse<ChatMessage[]>> {
    if (page === 1) {
      this._isLoadingMessages.set(true);
    }

    return this.http
      .get<ApiResponse<ChatMessage[]>>(
        this.apiUrlService.getUrl(
          `families/${familySlug}/chat/rooms/${roomId}/messages`
        ),
        {
          params: { page: page.toString(), per_page: perPage.toString() },
        }
      )
      .pipe(
        tap((response) => {
          if (page === 1) {
            // Reverse the messages to show in chronological order (oldest first)
            this._messages.set(response.data.reverse());
          } else {
            // Prepend older messages for pagination (also reversed)
            const currentMessages = this._messages();
            this._messages.set([
              ...response.data.reverse(),
              ...currentMessages,
            ]);
          }
        }),
        finalize(() => {
          if (page === 1) {
            this._isLoadingMessages.set(false);
          }
        })
      );
  }

  sendMessage(
    familySlug: string,
    roomId: number,
    request: SendMessageRequest
  ): Observable<ApiResponse<ChatMessage>> {
    // Add optimistic message
    const optimisticMessage: ChatMessage = {
      id: Date.now(), // Temporary ID
      chatRoomId: roomId,
      userId: this.authService.user()?.id || 0,
      message: request.message,
      type: request.type,
      replyToId: request.replyToId,
      attachments: request.attachments ? [] : undefined,
      metadata: request.metadata,
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: this.authService.user(),
      isOptimistic: true,
      isSending: true,
    };

    this.addMessageToList(optimisticMessage);

    return this.http
      .post<ApiResponse<ChatMessage>>(
        this.apiUrlService.getUrl(
          `families/${familySlug}/chat/rooms/${roomId}/messages`
        ),
        request
      )
      .pipe(
        tap((response) => {
          // Replace optimistic message with real one
          this.replaceOptimisticMessage(optimisticMessage.id, response.data);
        }),
        tap(() => {
          // Update last message in room list
          this.updateLastMessage(roomId, optimisticMessage);
        }),
        finalize(() => {
          // Mark as sent/failed
          this.updateMessageSendingState(optimisticMessage.id, false);
        })
      );
  }

  updateMessage(
    familySlug: string,
    messageId: number,
    message: string
  ): Observable<ApiResponse<ChatMessage>> {
    return this.http
      .put<ApiResponse<ChatMessage>>(
        this.apiUrlService.getUrl(
          `families/${familySlug}/chat/messages/${messageId}`
        ),
        { message }
      )
      .pipe(
        tap((response) => {
          this.updateMessageInList(response.data);
        })
      );
  }

  deleteMessage(
    familySlug: string,
    messageId: number
  ): Observable<ApiResponse<void>> {
    return this.http
      .delete<ApiResponse<void>>(
        this.apiUrlService.getUrl(
          `families/${familySlug}/chat/messages/${messageId}`
        )
      )
      .pipe(
        tap(() => {
          this.markMessageAsDeleted(messageId);
        })
      );
  }

  // Message Reactions API
  addReaction(
    familySlug: string,
    messageId: number,
    emoji: string
  ): Observable<ApiResponse<MessageReaction>> {
    return this.http
      .post<ApiResponse<MessageReaction>>(
        this.apiUrlService.getUrl(
          `families/${familySlug}/chat/messages/${messageId}/reactions`
        ),
        { emoji }
      )
      .pipe(
        tap((response) => {
          this.addReactionToMessage(messageId, response.data);
        })
      );
  }

  removeReaction(
    familySlug: string,
    messageId: number,
    emoji: string
  ): Observable<ApiResponse<void>> {
    const currentUserId = this.authService.user()?.id;

    return this.http
      .delete<ApiResponse<void>>(
        this.apiUrlService.getUrl(
          `families/${familySlug}/chat/messages/${messageId}/reactions/${emoji}`
        )
      )
      .pipe(
        tap(() => {
          if (currentUserId) {
            this.removeReactionFromMessage(messageId, emoji, currentUserId);
          }
        })
      );
  }

  // Room Management
  markAsRead(
    familySlug: string,
    roomId: number
  ): Observable<ApiResponse<void>> {
    return this.http
      .post<ApiResponse<void>>(
        this.apiUrlService.getUrl(
          `families/${familySlug}/chat/rooms/${roomId}/read`
        ),
        {}
      )
      .pipe(
        tap(() => {
          this.markRoomAsRead(roomId);
        })
      );
  }

  // Typing Indicators
  sendTypingIndicator(
    familySlug: string,
    roomId: number
  ): Observable<ApiResponse<void>> {
    return this.http.post<ApiResponse<void>>(
      this.apiUrlService.getUrl(
        `families/${familySlug}/chat/rooms/${roomId}/typing`
      ),
      {}
    );
  }

  // WebSocket methods moved to dedicated section below

  private handleWebSocketMessage(data: any) {
    switch (data.type) {
      case 'message_received':
        this.handleNewMessage(data.message);
        break;
      case 'message_updated':
        this.handleMessageUpdate(data.message);
        break;
      case 'message_deleted':
        this.handleMessageDeletion(data.messageId);
        break;
      case 'typing_started':
        this.handleTypingStarted(data.roomId, data.user);
        break;
      case 'typing_ended':
        this.handleTypingEnded(data.roomId, data.userId);
        break;
      case 'room_updated':
        this.handleRoomUpdate(data.room);
        break;
    }
  }

  private handleNewMessage(message: ChatMessage) {
    this.addMessageToList(message);
    this.updateLastMessage(message.chatRoomId, message);
  }

  private handleMessageUpdate(message: ChatMessage) {
    this.updateMessageInList(message);
  }

  private handleMessageDeletion(messageId: number) {
    this.markMessageAsDeleted(messageId);
  }

  private handleTypingStarted(roomId: number, user: any) {
    if (this._currentChatRoom()?.id === roomId) {
      const currentUsers = this._typingUsers();
      if (!currentUsers.find((u) => u.userId === user.id)) {
        this._typingUsers.set([
          ...currentUsers,
          {
            userId: user.id,
            userName: user.name,
            lastTyping: Date.now(),
          },
        ]);
      }
    }
  }

  private handleTypingEnded(roomId: number, userId: number) {
    if (this._currentChatRoom()?.id === roomId) {
      const currentUsers = this._typingUsers();
      this._typingUsers.set(currentUsers.filter((u) => u.userId !== userId));
    }
  }

  private handleRoomUpdate(room: ChatRoom) {
    this.updateChatRoomInList(room);
    if (this._currentChatRoom()?.id === room.id) {
      this._currentChatRoom.set(room);
    }
  }

  // Helper methods
  private addMessageToList(message: ChatMessage) {
    const currentMessages = this._messages();
    this._messages.set([...currentMessages, message]);
  }

  private updateMessageInList(updatedMessage: ChatMessage) {
    const currentMessages = this._messages();
    const index = currentMessages.findIndex((m) => m.id === updatedMessage.id);
    if (index !== -1) {
      const newMessages = [...currentMessages];
      newMessages[index] = updatedMessage;
      this._messages.set(newMessages);
    }
  }

  private replaceOptimisticMessage(
    optimisticId: number,
    realMessage: ChatMessage
  ) {
    const currentMessages = this._messages();
    const index = currentMessages.findIndex((m) => m.id === optimisticId);
    if (index !== -1) {
      const newMessages = [...currentMessages];
      newMessages[index] = realMessage;
      this._messages.set(newMessages);
    }
  }

  private updateMessageSendingState(
    messageId: number,
    isSending: boolean,
    error?: string
  ) {
    const currentMessages = this._messages();
    const index = currentMessages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      const newMessages = [...currentMessages];
      newMessages[index] = {
        ...newMessages[index],
        isSending,
        sendError: error,
      };
      this._messages.set(newMessages);
    }
  }

  private markMessageAsDeleted(messageId: number) {
    const currentMessages = this._messages();
    const index = currentMessages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      const newMessages = [...currentMessages];
      newMessages[index] = {
        ...newMessages[index],
        isDeleted: true,
        message: 'This message was deleted',
      };
      this._messages.set(newMessages);
    }
  }

  private addReactionToMessage(messageId: number, reaction: MessageReaction) {
    const currentMessages = this._messages();
    const index = currentMessages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      const newMessages = [...currentMessages];
      if (!newMessages[index].reactions) {
        newMessages[index].reactions = [];
      }
      newMessages[index].reactions!.push(reaction);
      this._messages.set(newMessages);
    }
  }

  private removeReactionFromMessage(
    messageId: number,
    emoji: string,
    userId: number
  ) {
    const currentMessages = this._messages();
    const index = currentMessages.findIndex((m) => m.id === messageId);
    if (index !== -1) {
      const newMessages = [...currentMessages];
      if (newMessages[index].reactions) {
        newMessages[index].reactions = newMessages[index].reactions!.filter(
          (r) => !(r.emoji === emoji && r.userId === userId)
        );
      }
      this._messages.set(newMessages);
    }
  }

  private updateChatRoomInList(updatedRoom: ChatRoom) {
    const currentRooms = this._chatRooms();
    const index = currentRooms.findIndex((r) => r.id === updatedRoom.id);
    if (index !== -1) {
      const newRooms = [...currentRooms];
      newRooms[index] = updatedRoom;
      this._chatRooms.set(newRooms);
    }
  }

  private updateLastMessage(roomId: number, message: ChatMessage) {
    const currentRooms = this._chatRooms();
    const index = currentRooms.findIndex((r) => r.id === roomId);
    if (index !== -1) {
      const newRooms = [...currentRooms];
      newRooms[index] = {
        ...newRooms[index],
        lastMessage: message,
        lastMessageAt: message.createdAt,
      };
      // Move to top of list if it's a new message
      if (!message.isOptimistic) {
        const [updatedRoom] = newRooms.splice(index, 1);
        newRooms.unshift(updatedRoom);
      }
      this._chatRooms.set(newRooms);
    }
  }

  private markRoomAsRead(roomId: number) {
    const currentRooms = this._chatRooms();
    const index = currentRooms.findIndex((r) => r.id === roomId);
    if (index !== -1) {
      const newRooms = [...currentRooms];
      newRooms[index] = {
        ...newRooms[index],
        unreadCount: 0,
      };
      this._chatRooms.set(newRooms);
    }
  }

  private startTypingCleanup() {
    // Clean up typing indicators every 3 seconds
    interval(3000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const now = Date.now();
        const currentUsers = this._typingUsers();
        const activeUsers = currentUsers.filter(
          (user) => now - user.lastTyping < 5000 // 5 seconds timeout
        );

        if (activeUsers.length !== currentUsers.length) {
          this._typingUsers.set(activeUsers);
        }
      });
  }

  // Public utility methods
  clearCurrentRoom() {
    this._currentChatRoom.set(null);
    this._messages.set([]);
    this._typingUsers.set([]);
  }

  getCurrentMessages(): ChatMessage[] {
    return this._messages();
  }

  getCurrentChatRooms(): ChatRoom[] {
    return this._chatRooms();
  }

  // WebSocket Real-time Methods
  async initializeWebSocket(): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      console.warn('Cannot initialize WebSocket: User not authenticated');
      return;
    }

    try {
      console.log('🔌 Initializing WebSocket connection...');
      await this.webSocketService.connect();
      console.log('✅ WebSocket initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize WebSocket:', error);
      throw error;
    }
  }

  joinChatRoom(roomId: number): void {
    console.log('🏠 Joining chat room:', roomId);

    // Leave previous room if any
    if (this.currentChatChannel) {
      console.log('🚪 Leaving previous chat room');
      this.leaveChatRoom();
    }

    if (!this.webSocketService.isWebSocketConnected()) {
      console.error('❌ WebSocket not connected, cannot join chat room');
      return;
    }

    try {
      // Join new room channel
      const channelName = `chat-room.${roomId}`;
      console.log('🏠 Attempting to join channel:', channelName);

      const channel = this.webSocketService.joinPrivateChannel(channelName);

      if (channel) {
        this.currentChatChannel = channel;
        this.channelSubscriptions.set(roomId, channel);

        this.setupChannelListeners(channel, roomId);
        console.log('✅ Successfully joined chat room:', roomId);
      }
    } catch (error) {
      console.error('❌ Failed to join chat room:', roomId, error);
    }
  }

  private setupChannelListeners(channel: any, roomId: number): void {
    // Listen for new messages
    channel.listen('.message.sent', (event: any) => {
      console.log('📨 REAL-TIME MESSAGE RECEIVED:', event);

      const newMessage = event.message;
      if (newMessage && newMessage.chatRoomId === roomId) {
        this.handleRealtimeMessage(newMessage);
      }
    });

    // Listen for message updates
    channel.listen('.message.updated', (event: any) => {
      console.log('📝 REAL-TIME MESSAGE UPDATED:', event);

      const updatedMessage = event.message;
      if (updatedMessage) {
        this.handleRealtimeMessageUpdate(updatedMessage);
      }
    });

    // Listen for message deletions
    channel.listen('.message.deleted', (event: any) => {
      console.log('🗑️ REAL-TIME MESSAGE DELETED:', event);

      if (event.messageId && event.chatRoomId === roomId) {
        this.handleRealtimeMessageDeletion(event.messageId);
      }
    });

    // Listen for reactions
    channel.listen('.reaction.added', (event: any) => {
      console.log('❤️ REAL-TIME REACTION ADDED:', event);

      if (event.reaction && event.messageId) {
        this.handleRealtimeReactionAdded(event.messageId, event.reaction);
      }
    });

    channel.listen('.reaction.removed', (event: any) => {
      console.log('💔 REAL-TIME REACTION REMOVED:', event);

      if (event.messageId && event.emoji && event.userId) {
        this.handleRealtimeReactionRemoved(
          event.messageId,
          event.emoji,
          event.userId
        );
      }
    });

    // Listen for typing indicators
    channel.listen('.user.typing', (event: any) => {
      console.log('⌨️ USER TYPING:', event);

      if (event.userId && event.userName && event.isTyping !== undefined) {
        this.handleTypingEvent(
          roomId,
          {
            id: event.userId,
            name: event.userName,
          },
          event.isTyping
        );
      }
    });

    // Handle subscription success
    channel.subscribed(() => {
      console.log('✅ Successfully subscribed to chat room channel:', roomId);
    });

    // Handle subscription errors
    channel.error((error: any) => {
      console.error(
        '❌ Channel subscription error for room',
        roomId,
        ':',
        error
      );
    });
  }

  private handleRealtimeMessage(message: ChatMessage): void {
    console.log('📨 Processing realtime message:', message);

    const currentMessages = this._messages();

    // If this is our own message, try to replace an optimistic one instead of duplicating
    const currentUserId = this.authService.user()?.id;
    if (currentUserId && message.userId === currentUserId) {
      const optimisticIndex = currentMessages.findIndex(
        (m) =>
          (m as any).isOptimistic === true &&
          m.userId === currentUserId &&
          m.message === message.message &&
          (m.replyToId ?? null) === (message.replyToId ?? null) &&
          m.type === message.type
      );

      if (optimisticIndex !== -1) {
        const replaced = [...currentMessages];
        replaced[optimisticIndex] = message;
        this._messages.set(this.sortMessagesChronologically(replaced));

        this.updateRoomLastMessage(message.chatRoomId, message);
        this.messageReceived$.next(message);
        console.log('🔄 Replaced optimistic message with realtime message');
        return;
      }
    }

    // Check if message already exists (avoid duplicates)
    const messageExists = currentMessages.some((m) => m.id === message.id);

    if (!messageExists) {
      const next = [...currentMessages, message];
      this._messages.set(this.sortMessagesChronologically(next));

      // Update chat room's last message
      this.updateRoomLastMessage(message.chatRoomId, message);

      // Emit event for components to react
      this.messageReceived$.next(message);

      console.log('✅ Realtime message added to list');
    } else {
      console.log('ℹ️ Message already exists, skipping duplicate');
    }
  }

  private handleRealtimeMessageUpdate(message: ChatMessage): void {
    console.log('📝 Processing realtime message update:', message);

    const currentMessages = this._messages();
    const messageIndex = currentMessages.findIndex((m) => m.id === message.id);

    if (messageIndex !== -1) {
      const updatedMessages = [...currentMessages];
      updatedMessages[messageIndex] = message;
      this._messages.set(this.sortMessagesChronologically(updatedMessages));

      // Emit event
      this.messageUpdated$.next(message);

      console.log('✅ Message updated in list');
    }
  }

  private handleRealtimeMessageDeletion(messageId: number): void {
    console.log('🗑️ Processing realtime message deletion:', messageId);

    const currentMessages = this._messages();
    const messageIndex = currentMessages.findIndex((m) => m.id === messageId);

    if (messageIndex !== -1) {
      const updatedMessages = [...currentMessages];
      updatedMessages[messageIndex] = {
        ...updatedMessages[messageIndex],
        isDeleted: true,
        message: 'This message was deleted',
        attachments: null,
        metadata: null,
      };
      this._messages.set(this.sortMessagesChronologically(updatedMessages));

      // Emit event
      this.messageDeleted$.next(messageId);

      console.log('✅ Message marked as deleted');
    }
  }

  private handleRealtimeReactionAdded(
    messageId: number,
    reaction: MessageReaction
  ): void {
    console.log('❤️ Processing realtime reaction added:', messageId, reaction);

    const currentMessages = this._messages();
    const messageIndex = currentMessages.findIndex((m) => m.id === messageId);

    if (messageIndex !== -1) {
      const updatedMessages = [...currentMessages];
      const message = { ...updatedMessages[messageIndex] };

      if (!message.reactions) {
        message.reactions = [];
      }

      // Check if reaction already exists
      const reactionExists = message.reactions.some(
        (r) => r.userId === reaction.userId && r.emoji === reaction.emoji
      );

      if (!reactionExists) {
        message.reactions = [...message.reactions, reaction];
        updatedMessages[messageIndex] = message;
        this._messages.set(this.sortMessagesChronologically(updatedMessages));
      }
    }
  }

  private handleRealtimeReactionRemoved(
    messageId: number,
    emoji: string,
    userId: number
  ): void {
    console.log(
      '💔 Processing realtime reaction removed:',
      messageId,
      emoji,
      userId
    );

    const currentMessages = this._messages();
    const messageIndex = currentMessages.findIndex((m) => m.id === messageId);

    if (messageIndex !== -1) {
      const updatedMessages = [...currentMessages];
      const message = { ...updatedMessages[messageIndex] };

      if (message.reactions) {
        message.reactions = message.reactions.filter(
          (r) => !(r.userId === userId && r.emoji === emoji)
        );
        updatedMessages[messageIndex] = message;
        this._messages.set(this.sortMessagesChronologically(updatedMessages));
      }
    }
  }

  private handleTypingEvent(
    roomId: number,
    user: any,
    isTyping: boolean
  ): void {
    const currentRoom = this._currentChatRoom();
    if (!currentRoom || currentRoom.id !== roomId) {
      return;
    }

    // Ignore own typing events
    const currentUserId = this.authService.user()?.id;
    if (user.id === currentUserId) {
      return;
    }

    const currentTypingUsers = this._typingUsers();

    if (isTyping) {
      // Add user to typing list if not already there
      const userExists = currentTypingUsers.some((tu) => tu.userId === user.id);
      if (!userExists) {
        const typingUser: TypingUser = {
          userId: user.id,
          userName: user.name,
          lastTyping: Date.now(),
        };
        this._typingUsers.set([...currentTypingUsers, typingUser]);

        // Auto-remove typing indicator after 5 seconds
        const timeoutId = setTimeout(() => {
          this.removeTypingUser(user.id);
        }, 5000);

        this.typingTimeouts.set(user.id, timeoutId);
      }
    } else {
      this.removeTypingUser(user.id);
    }
  }

  private removeTypingUser(userId: number): void {
    const currentTypingUsers = this._typingUsers();
    const filteredUsers = currentTypingUsers.filter(
      (tu) => tu.userId !== userId
    );
    this._typingUsers.set(filteredUsers);

    // Clear timeout if exists
    const timeoutId = this.typingTimeouts.get(userId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.typingTimeouts.delete(userId);
    }
  }

  private updateRoomLastMessage(roomId: number, message: ChatMessage): void {
    const currentRooms = this._chatRooms();
    const roomIndex = currentRooms.findIndex((r) => r.id === roomId);

    if (roomIndex !== -1) {
      const updatedRooms = [...currentRooms];
      updatedRooms[roomIndex] = {
        ...updatedRooms[roomIndex],
        lastMessage: message,
        lastMessageAt: message.createdAt,
      };

      // Move room to top of list for recent activity
      if (roomIndex > 0) {
        const [updatedRoom] = updatedRooms.splice(roomIndex, 1);
        updatedRooms.unshift(updatedRoom);
      }

      this._chatRooms.set(updatedRooms);
    }
  }

  leaveChatRoom(): void {
    if (this.currentChatChannel) {
      const currentRoom = this._currentChatRoom();
      if (currentRoom) {
        const channelName = `chat-room.${currentRoom.id}`;

        try {
          this.webSocketService.leaveChannel(channelName);
          this.channelSubscriptions.delete(currentRoom.id);
          console.log('🚪 Left chat room:', currentRoom.id);
        } catch (error) {
          console.error('❌ Error leaving chat room:', error);
        }
      }

      this.currentChatChannel = null;
    }

    // Clear typing indicators
    this._typingUsers.set([]);

    // Clear typing timeouts
    this.typingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.typingTimeouts.clear();
  }

  disconnectWebSocket(): void {
    // Leave all channels
    this.channelSubscriptions.forEach((channel, roomId) => {
      const channelName = `chat-room.${roomId}`;
      this.webSocketService.leaveChannel(channelName);
    });

    this.channelSubscriptions.clear();
    this.currentChatChannel = null;

    // Clear typing state
    this._typingUsers.set([]);
    this.typingTimeouts.forEach((timeoutId) => clearTimeout(timeoutId));
    this.typingTimeouts.clear();

    // Disconnect WebSocket
    this.webSocketService.disconnect();
    console.log('🔌 WebSocket disconnected and cleaned up');
  }

  // Observable streams for real-time events
  getMessageReceivedStream(): Observable<ChatMessage> {
    return this.messageReceived$.asObservable();
  }

  getMessageUpdatedStream(): Observable<ChatMessage> {
    return this.messageUpdated$.asObservable();
  }

  getMessageDeletedStream(): Observable<number> {
    return this.messageDeleted$.asObservable();
  }

  getTypingStartedStream(): Observable<{ roomId: number; user: any }> {
    return this.typingStarted$.asObservable();
  }

  getTypingEndedStream(): Observable<{ roomId: number; userId: number }> {
    return this.typingEnded$.asObservable();
  }

  getRoomUpdatedStream(): Observable<ChatRoom> {
    return this.roomUpdated$.asObservable();
  }

  // Ensure messages remain in chronological order by createdAt (fallback to id)
  private sortMessagesChronologically(messages: ChatMessage[]): ChatMessage[] {
    return [...messages].sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (at !== bt) return at - bt;
      return (a.id || 0) - (b.id || 0);
    });
  }
}
