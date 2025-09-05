export enum MessageTypeEnum {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  LOCATION = 'location',
  POLL = 'poll',
  EVENT = 'event',
  SYSTEM = 'system',
}

export enum ChatRoomTypeEnum {
  GROUP = 'group',
  DIRECT = 'direct',
  ANNOUNCEMENT = 'announcement',
  EMERGENCY = 'emergency',
}

export interface ChatRoom {
  id: number;
  familyId: number;
  name: string;
  type: ChatRoomTypeEnum;
  description?: string;
  createdBy: number;
  isPrivate: boolean;
  isArchived: boolean;
  settings: any;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;

  // Computed/related fields
  unreadCount?: number;
  lastMessage?: ChatMessage;
  members?: ChatRoomMember[];
  isCurrentUserAdmin?: boolean;
  isCurrentUserMuted?: boolean;
}

export interface ChatMessage {
  id: number;
  chatRoomId: number;
  userId: number;
  replyToId?: number;
  message: string;
  type: MessageTypeEnum;
  attachments?: any[]|null;
  metadata?: any;
  isEdited: boolean;
  isDeleted: boolean;
  editedAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;

  // Relations
  user?: any;
  replyTo?: ChatMessage;
  reactions?: MessageReaction[];

  // UI state
  isOptimistic?: boolean;
  isSending?: boolean;
  sendError?: string;
}

export interface ChatRoomMember {
  id: number;
  chatRoomId: number;
  userId: number;
  isAdmin: boolean;
  isMuted: boolean;
  lastReadAt?: string;
  unreadCount: number;
  mutedUntil?: string;
  createdAt: string;
  updatedAt: string;

  // Relations
  user?: any;
}

export interface MessageReaction {
  id: number;
  messageId: number;
  userId: number;
  emoji: string;
  createdAt: string;
  updatedAt: string;

  // Relations
  user?: any;
}

export interface CreateChatRoomRequest {
  name: string;
  description?: string;
  type: ChatRoomTypeEnum;
  memberIds: number[];
  isPrivate?: boolean;
}

export interface SendMessageRequest {
  message: string;
  type: MessageTypeEnum;
  replyToId?: number;
  attachments?: File[];
  metadata?: any;
}

export interface UpdateChatRoomRequest {
  name?: string;
  description?: string;
  isPrivate?: boolean;
  settings?: any;
}

// Utility functions
export function getChatRoomTypeName(type: ChatRoomTypeEnum): string {
  switch (type) {
    case ChatRoomTypeEnum.GROUP:
      return 'Group Chat';
    case ChatRoomTypeEnum.DIRECT:
      return 'Direct Message';
    case ChatRoomTypeEnum.ANNOUNCEMENT:
      return 'Announcements';
    case ChatRoomTypeEnum.EMERGENCY:
      return 'Emergency';
    default:
      return 'Chat';
  }
}

export function getMessageTypeName(type: MessageTypeEnum): string {
  switch (type) {
    case MessageTypeEnum.TEXT:
      return 'Text';
    case MessageTypeEnum.IMAGE:
      return 'Image';
    case MessageTypeEnum.VIDEO:
      return 'Video';
    case MessageTypeEnum.AUDIO:
      return 'Audio';
    case MessageTypeEnum.FILE:
      return 'File';
    case MessageTypeEnum.LOCATION:
      return 'Location';
    case MessageTypeEnum.POLL:
      return 'Poll';
    case MessageTypeEnum.EVENT:
      return 'Event';
    case MessageTypeEnum.SYSTEM:
      return 'System';
    default:
      return 'Message';
  }
}

export function getMessageTypeIcon(type: MessageTypeEnum): string {
  switch (type) {
    case MessageTypeEnum.TEXT:
      return 'chatbubble-outline';
    case MessageTypeEnum.IMAGE:
      return 'image-outline';
    case MessageTypeEnum.VIDEO:
      return 'videocam-outline';
    case MessageTypeEnum.AUDIO:
      return 'mic-outline';
    case MessageTypeEnum.FILE:
      return 'document-outline';
    case MessageTypeEnum.LOCATION:
      return 'location-outline';
    case MessageTypeEnum.POLL:
      return 'bar-chart-outline';
    case MessageTypeEnum.EVENT:
      return 'calendar-outline';
    case MessageTypeEnum.SYSTEM:
      return 'information-circle-outline';
    default:
      return 'chatbubble-outline';
  }
}

export function getChatRoomTypeIcon(type: ChatRoomTypeEnum): string {
  switch (type) {
    case ChatRoomTypeEnum.GROUP:
      return 'people-outline';
    case ChatRoomTypeEnum.DIRECT:
      return 'person-circle-outline';
    case ChatRoomTypeEnum.ANNOUNCEMENT:
      return 'megaphone-outline';
    case ChatRoomTypeEnum.EMERGENCY:
      return 'warning-outline';
    default:
      return 'chatbubble-outline';
  }
}

export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);
  const diffInDays = diffInHours / 24;

  if (diffInMs < 60000) return 'now';
  if (diffInMs < 3600000) return `${Math.floor(diffInMs / 60000)}m`;
  if (diffInHours < 24) return `${Math.floor(diffInHours)}h`;
  if (diffInDays < 7)
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatMessageDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return 'Today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function isMessageFromCurrentUser(
  message: ChatMessage,
  currentUserId: number
): boolean {
  return message.userId === currentUserId;
}

export function shouldShowAvatar(
  messages: ChatMessage[],
  index: number
): boolean {
  const currentMessage = messages[index];
  const nextMessage = messages[index + 1];

  if (!nextMessage) return true;

  return currentMessage.userId !== nextMessage.userId;
}

export function shouldShowTimestamp(
  messages: ChatMessage[],
  index: number
): boolean {
  const currentMessage = messages[index];
  const prevMessage = messages[index - 1];

  if (!prevMessage) return true;

  const currentTime = new Date(currentMessage.createdAt).getTime();
  const prevTime = new Date(prevMessage.createdAt).getTime();
  const diffInMinutes = (currentTime - prevTime) / (1000 * 60);

  return diffInMinutes > 5 || currentMessage.userId !== prevMessage.userId;
}
