export interface Memory {
  id: number;
  familyId: number;
  createdBy: number;
  title: string;
  description?: string;
  type: MemoryType;
  memoryDate: string;
  participants?: number[];
  media?: MemoryMedia[];
  location?: MemoryLocation;
  tags?: string[];
  visibility: MemoryVisibility;
  visibleTo?: number[];
  isFeatured: boolean;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  aiGeneratedTags?: string[];
  aiDetectedEmotions?: string[];
  createdAt: string;
  updatedAt: string;
  
  // Relationships
  family?: any;
  creator?: User;
  comments?: MemoryComment[];
  likes?: MemoryLike[];
  
  // Computed properties
  isLikedByCurrentUser?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export interface MemoryComment {
  id: number;
  memoryId: number;
  userId: number;
  parentId?: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  
  // Relationships
  memory?: Memory;
  user?: User;
  parent?: MemoryComment;
  replies?: MemoryComment[];
}

export interface MemoryLike {
  id: number;
  memoryId: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
  
  // Relationships
  memory?: Memory;
  user?: User;
}

export interface FamilyMilestone {
  id: number;
  familyId: number;
  userId?: number;
  createdBy: number;
  type: MilestoneType;
  title: string;
  description?: string;
  milestoneDate: string;
  media?: MemoryMedia[];
  metadata?: Record<string, any>;
  isRecurring: boolean;
  recurrencePattern?: string;
  notifyFamily: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Relationships
  family?: any;
  user?: User;
  creator?: User;
  
  // Computed properties
  daysUntilMilestone?: number;
  isUpcoming?: boolean;
}

export interface FamilyTradition {
  id: number;
  familyId: number;
  createdBy: number;
  name: string;
  description: string;
  frequency: TraditionFrequency;
  scheduleDetails?: TraditionSchedule;
  startedDate?: string;
  participants?: number[];
  activities?: TraditionActivity[];
  recipes?: TraditionRecipe[];
  songsGames?: TraditionSongGame[];
  media?: MemoryMedia[];
  isActive: boolean;
  timesCelebrated: number;
  lastCelebratedAt?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relationships
  family?: any;
  creator?: User;
  
  // Computed properties
  nextCelebrationDate?: string;
  daysSinceLastCelebration?: number;
  canCelebrate?: boolean;
}

export interface FamilyTimeCapsule {
  id: number;
  familyId: number;
  createdBy: number;
  title: string;
  description?: string;
  contents?: TimeCapsuleContent[];
  contributors?: number[];
  sealedAt: string;
  opensAt: string;
  isOpened: boolean;
  openedAt?: string;
  openingConditions?: TimeCapsuleCondition[];
  createdAt: string;
  updatedAt: string;
  
  // Relationships
  family?: any;
  creator?: User;
  
  // Computed properties
  daysUntilOpening?: number;
  canBeOpened?: boolean;
  contributorCount?: number;
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  firstName?: string;
  lastName?: string;
}

// Enums
export type MemoryType = 
  | 'general'
  | 'milestone'
  | 'achievement'
  | 'tradition'
  | 'story'
  | 'vacation'
  | 'holiday'
  | 'birthday'
  | 'anniversary'
  | 'first_time'
  | 'funny_moment'
  | 'life_lesson';

export type MemoryVisibility = 'family' | 'specific_members' | 'private' | 'public';

export type MilestoneType = 
  | 'birth'
  | 'first_steps'
  | 'first_words'
  | 'first_day_school'
  | 'graduation'
  | 'first_job'
  | 'engagement'
  | 'wedding'
  | 'new_home'
  | 'retirement'
  | 'achievement'
  | 'award';

export type TraditionFrequency = 
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'special'
  | 'seasonal'
  | 'holiday';

// Supporting interfaces
export interface MemoryMedia {
  id?: number;
  type: 'photo' | 'video' | 'audio' | 'document';
  url: string;
  thumbnailUrl?: string;
  filename: string;
  size: number;
  mimeType: string;
  metadata?: Record<string, any>;
}

export interface MemoryLocation {
  address?: string;
  city?: string;
  country?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  placeId?: string;
}

export interface TraditionSchedule {
  dayOfWeek?: number; // 0-6, Sunday = 0
  dayOfMonth?: number; // 1-31
  month?: number; // 1-12
  time?: string; // HH:MM format
  timezone?: string;
  customRule?: string;
}

export interface TraditionActivity {
  id?: number;
  name: string;
  description?: string;
  duration?: string;
  materials?: string[];
  instructions?: string[];
}

export interface TraditionRecipe {
  id?: number;
  name: string;
  description?: string;
  ingredients: string[];
  instructions: string[];
  servings?: number;
  cookTime?: string;
  prepTime?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface TraditionSongGame {
  id?: number;
  name: string;
  type: 'song' | 'game' | 'activity';
  description?: string;
  lyrics?: string;
  rules?: string[];
  materials?: string[];
  ageRange?: string;
}

export interface TimeCapsuleContent {
  id?: number;
  contributorId: number;
  type: 'message' | 'photo' | 'video' | 'audio' | 'document' | 'prediction';
  content: string | MemoryMedia;
  addedAt: string;
  contributorName?: string;
}

export interface TimeCapsuleCondition {
  id?: number;
  type: 'date' | 'event' | 'milestone' | 'custom';
  description: string;
  value?: any;
  isMetAllTime: boolean;
}

// Request interfaces
export interface CreateMemoryRequest {
  title: string;
  description?: string;
  type: MemoryType;
  memoryDate: string;
  participants?: number[];
  media?: File[] | MemoryMedia[];
  location?: MemoryLocation;
  tags?: string[];
  visibility: MemoryVisibility;
  visibleTo?: number[];
  isFeatured?: boolean;
}

export interface UpdateMemoryRequest extends Partial<CreateMemoryRequest> {}

export interface CreateMilestoneRequest {
  userId?: number;
  type: MilestoneType;
  title: string;
  description?: string;
  milestoneDate: string;
  media?: File[] | MemoryMedia[];
  metadata?: Record<string, any>;
  isRecurring?: boolean;
  recurrencePattern?: string;
  notifyFamily?: boolean;
}

export interface UpdateMilestoneRequest extends Partial<CreateMilestoneRequest> {}

export interface CreateTraditionRequest {
  name: string;
  description: string;
  frequency: TraditionFrequency;
  scheduleDetails?: TraditionSchedule;
  startedDate?: string;
  participants?: number[];
  activities?: TraditionActivity[];
  recipes?: TraditionRecipe[];
  songsGames?: TraditionSongGame[];
  media?: File[] | MemoryMedia[];
}

export interface UpdateTraditionRequest extends Partial<CreateTraditionRequest> {}

export interface CreateTimeCapsuleRequest {
  title: string;
  description?: string;
  opensAt: string;
  openingConditions?: TimeCapsuleCondition[];
  initialContents?: TimeCapsuleContent[];
}

export interface UpdateTimeCapsuleRequest extends Partial<CreateTimeCapsuleRequest> {}

export interface AddTimeCapsuleContentRequest {
  type: TimeCapsuleContent['type'];
  content: string | File;
}

export interface CreateMemoryCommentRequest {
  content: string;
  parentId?: number;
}

export interface UpdateMemoryCommentRequest {
  content: string;
}

// Filter interfaces
export interface MemoryFilters {
  search?: string;
  type?: MemoryType[];
  tags?: string[];
  participants?: number[];
  dateFrom?: string;
  dateTo?: string;
  createdBy?: number;
  visibility?: MemoryVisibility[];
  isFeatured?: boolean;
  sortBy?: 'memory_date' | 'created_at' | 'title' | 'views_count' | 'likes_count';
  sortDirection?: 'asc' | 'desc';
}

export interface MilestoneFilters {
  type?: MilestoneType[];
  userId?: number;
  dateFrom?: string;
  dateTo?: string;
  isUpcoming?: boolean;
  isRecurring?: boolean;
  sortBy?: 'milestone_date' | 'created_at' | 'title';
  sortDirection?: 'asc' | 'desc';
}

export interface TraditionFilters {
  frequency?: TraditionFrequency[];
  isActive?: boolean;
  search?: string;
  participants?: number[];
  hasRecipes?: boolean;
  hasActivities?: boolean;
  sortBy?: 'name' | 'created_at' | 'last_celebrated_at' | 'times_celebrated';
  sortDirection?: 'asc' | 'desc';
}

export interface TimeCapsuleFilters {
  isOpened?: boolean;
  openingSoon?: boolean; // within 30 days
  createdBy?: number;
  sortBy?: 'opens_at' | 'created_at' | 'title';
  sortDirection?: 'asc' | 'desc';
}

// Response interfaces
export interface PaginatedResponse<T> {
  data: T[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  from: number;
  to: number;
}

export interface MemoryResponse extends Memory {
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canComment: boolean;
    canLike: boolean;
    canShare: boolean;
  };
}

export interface MemoryTimelineItem {
  date: string;
  memories: Memory[];
  milestones: FamilyMilestone[];
  traditions: FamilyTradition[];
  count: number;
}

export interface MemoryStats {
  totalMemories: number;
  totalMilestones: number;
  totalTraditions: number;
  totalTimeCapsules: number;
  memoryTypes: Record<MemoryType, number>;
  memoriesThisMonth: number;
  memoriesThisYear: number;
  mostActiveMonth: string;
  averageMemoriesPerMonth: number;
}

// Event interfaces for real-time updates
export interface MemoryCreatedEvent {
  memory: Memory;
  creatorName: string;
  familyId: number;
}

export interface MemoryLikedEvent {
  memoryId: number;
  userId: number;
  userName: string;
  likesCount: number;
  isLiked: boolean;
}

export interface MemoryCommentedEvent {
  memoryId: number;
  comment: MemoryComment;
  commentsCount: number;
}

export interface MilestoneReachedEvent {
  milestone: FamilyMilestone;
  userName: string;
  familyId: number;
}

export interface TraditionCelebratedEvent {
  tradition: FamilyTradition;
  celebratedBy: string;
  familyId: number;
  timesCelebrated: number;
}

export interface TimeCapsuleOpenedEvent {
  capsule: FamilyTimeCapsule;
  openedBy: string;
  familyId: number;
  contents: TimeCapsuleContent[];
}