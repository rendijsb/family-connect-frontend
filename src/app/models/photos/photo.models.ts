export interface PhotoAlbum {
  id: number;
  familyId: number;
  createdBy: number;
  name: string;
  description?: string;
  coverPhoto?: string;
  privacy: AlbumPrivacy;
  allowedMembers?: number[];
  allowDownload: boolean;
  allowComments: boolean;
  photoCount: number;
  videoCount: number;
  totalSize: number;
  lastUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
  creator?: User;
  family?: any; // Import from family models
  photos?: Photo[];
  recentPhotos?: Photo[];
}

export interface Photo {
  id: number;
  albumId: number;
  uploadedBy: number;
  filename: string;
  originalName: string;
  mimeType: string;
  path: string;
  thumbnailPath?: string;
  size: number;
  width?: number;
  height?: number;
  metadata?: PhotoMetadata;
  description?: string;
  tags?: string[];
  peopleTagged?: number[];
  location?: string;
  takenAt?: string;
  viewsCount: number;
  likesCount: number;
  commentsCount: number;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Relationships
  album?: PhotoAlbum;
  uploader?: User;
  comments?: PhotoComment[];
  likes?: PhotoLike[];
  
  // Computed properties
  fullUrl?: string;
  thumbnailUrl?: string;
  formattedSize?: string;
  isLikedByCurrentUser?: boolean;
}

export interface PhotoComment {
  id: number;
  photoId: number;
  userId: number;
  parentId?: number;
  comment: string;
  isEdited: boolean;
  editedAt?: string;
  createdAt: string;
  updatedAt: string;
  
  // Relationships
  photo?: Photo;
  user?: User;
  parent?: PhotoComment;
  replies?: PhotoComment[];
}

export interface PhotoLike {
  id: number;
  photoId: number;
  userId: number;
  createdAt: string;
  updatedAt: string;
  
  // Relationships
  photo?: Photo;
  user?: User;
}

export interface PhotoMetadata {
  exif?: {
    make?: string;
    model?: string;
    software?: string;
    dateTime?: string;
    exposureTime?: string;
    fNumber?: string;
    iso?: number;
    focalLength?: string;
    flash?: string;
    orientation?: number;
  };
  gps?: {
    latitude?: number;
    longitude?: number;
    altitude?: number;
  };
  camera?: {
    make?: string;
    model?: string;
    lens?: string;
  };
  settings?: {
    iso?: number;
    aperture?: string;
    shutterSpeed?: string;
    focalLength?: string;
    whiteBalance?: string;
  };
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  firstName?: string;
  lastName?: string;
}

export type AlbumPrivacy = 'family' | 'specific_members' | 'public' | 'private';

export interface CreateAlbumRequest {
  name: string;
  description?: string;
  privacy: AlbumPrivacy;
  allowedMembers?: number[];
  allowDownload?: boolean;
  allowComments?: boolean;
}

export interface UpdateAlbumRequest extends Partial<CreateAlbumRequest> {
  coverPhoto?: string;
}

export interface UploadPhotoRequest {
  file: File | Blob;
  description?: string;
  tags?: string[];
  location?: string;
  peopleTagged?: number[];
}

export interface BulkUploadRequest {
  files: UploadPhotoRequest[];
}

export interface UpdatePhotoRequest {
  description?: string;
  tags?: string[];
  location?: string;
  peopleTagged?: number[];
  isFavorite?: boolean;
}

export interface CreateCommentRequest {
  comment: string;
  parentId?: number;
}

export interface UpdateCommentRequest {
  comment: string;
}

export interface PhotoSearchFilters {
  search?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  uploadedBy?: number;
  isFavorite?: boolean;
  hasLocation?: boolean;
  sortBy?: 'created_at' | 'taken_at' | 'name' | 'size' | 'views_count' | 'likes_count';
  sortDirection?: 'asc' | 'desc';
}

export interface AlbumSearchFilters {
  search?: string;
  privacy?: AlbumPrivacy[];
  createdBy?: number;
  sortBy?: 'created_at' | 'updated_at' | 'name' | 'photo_count';
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
  from: number;
  to: number;
}

export interface PhotoStats {
  totalPhotos: number;
  totalVideos: number;
  totalSize: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  averageRating?: number;
}

export interface AlbumStats extends PhotoStats {
  totalAlbums: number;
  publicAlbums: number;
  privateAlbums: number;
  familyAlbums: number;
}

export interface UploadProgress {
  fileId: string;
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}

export interface PhotoViewerData {
  photos: Photo[];
  currentIndex: number;
  albumId?: string;
  familySlug?: string;
}

export interface PhotoUploadData {
  albumId: string;
  familySlug: string;
}

// API Response interfaces
export interface PhotoResponse extends Photo {
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canComment: boolean;
    canLike: boolean;
    canDownload: boolean;
  };
}

export interface AlbumResponse extends PhotoAlbum {
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canAddPhotos: boolean;
    canManagePhotos: boolean;
  };
}

// Event interfaces for real-time updates
export interface PhotoLikedEvent {
  photoId: number;
  userId: number;
  userName: string;
  likesCount: number;
}

export interface PhotoCommentedEvent {
  photoId: number;
  comment: PhotoComment;
  commentsCount: number;
}

export interface PhotoUploadedEvent {
  albumId: number;
  photo: Photo;
  uploaderName: string;
}

export interface AlbumUpdatedEvent {
  albumId: number;
  changes: Partial<PhotoAlbum>;
  updatedBy: string;
}