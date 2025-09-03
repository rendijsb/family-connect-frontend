export enum FamilyRoleEnum {
  OWNER = 1,
  MODERATOR = 2,
  MEMBER = 3,
  CHILD = 4
}

export enum FamilyPrivacyEnum {
  PUBLIC = 'public',
  PRIVATE = 'private',
  INVITE_ONLY = 'invite_only'
}

export interface Family {
  id: number;
  name: string;
  slug: string;
  description?: string;
  ownerId: number;
  privacy: FamilyPrivacyEnum;
  joinCode?: string;
  settings: any;
  timezone: string;
  language: string;
  maxMembers: number;
  isActive: boolean;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;

  memberCount: number;
  currentUserRole?: FamilyRoleEnum;

  members?: FamilyMember[];
  owner?: any;
}

export interface FamilyMember {
  id: number;
  familyId: number;
  userId: number;
  role: FamilyRoleEnum;
  nickname?: string;
  relationship?: string;
  permissions: string[];
  notificationsEnabled: boolean;
  isActive: boolean;
  joinedAt: string;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;

  // Relations
  user?: any;
  family?: Family;
}

export interface CreateFamilyRequest {
  name: string;
  description?: string;
  privacy: FamilyPrivacyEnum;
  timezone?: string;
  language?: string;
  maxMembers?: number;
}

export interface UpdateFamilyRequest {
  name?: string;
  description?: string;
  privacy?: FamilyPrivacyEnum;
  timezone?: string;
  language?: string;
  maxMembers?: number;
  settings?: any;
}

export interface JoinFamilyRequest {
  joinCode: string;
}

export interface UpdateMemberRequest {
  role?: FamilyRoleEnum;
  nickname?: string;
  relationship?: string;
  notificationsEnabled?: boolean;
}

export interface FamilyPermission {
  id: string;
  name: string;
  description: string;
  requiredRole: FamilyRoleEnum;
}

export const FAMILY_PERMISSIONS: FamilyPermission[] = [
  { id: 'view_all', name: 'View All', description: 'View all family content', requiredRole: FamilyRoleEnum.MEMBER },
  { id: 'view_limited', name: 'View Limited', description: 'View limited family content', requiredRole: FamilyRoleEnum.CHILD },
  { id: 'manage_members', name: 'Manage Members', description: 'Add/remove family members', requiredRole: FamilyRoleEnum.MODERATOR },
  { id: 'manage_events', name: 'Manage Events', description: 'Create and manage family events', requiredRole: FamilyRoleEnum.MODERATOR },
  { id: 'manage_photos', name: 'Manage Photos', description: 'Upload and manage family photos', requiredRole: FamilyRoleEnum.MODERATOR },
  { id: 'manage_chat', name: 'Manage Chat', description: 'Moderate family chat', requiredRole: FamilyRoleEnum.MODERATOR },
  { id: 'create_events', name: 'Create Events', description: 'Create family events', requiredRole: FamilyRoleEnum.MEMBER },
  { id: 'upload_photos', name: 'Upload Photos', description: 'Upload family photos', requiredRole: FamilyRoleEnum.MEMBER },
  { id: 'chat', name: 'Chat', description: 'Participate in family chat', requiredRole: FamilyRoleEnum.MEMBER },
  { id: 'chat_limited', name: 'Limited Chat', description: 'Limited chat participation', requiredRole: FamilyRoleEnum.CHILD },
  { id: 'all', name: 'All Permissions', description: 'Full family management access', requiredRole: FamilyRoleEnum.OWNER }
];

// Utility functions
export function getFamilyRoleName(role: FamilyRoleEnum): string {
  switch (role) {
    case FamilyRoleEnum.OWNER: return 'Family Owner';
    case FamilyRoleEnum.MODERATOR: return 'Family Moderator';
    case FamilyRoleEnum.MEMBER: return 'Family Member';
    case FamilyRoleEnum.CHILD: return 'Child Member';
    default: return 'Unknown';
  }
}

export function getFamilyRolePermissions(role: FamilyRoleEnum): string[] {
  switch (role) {
    case FamilyRoleEnum.OWNER: return ['all'];
    case FamilyRoleEnum.MODERATOR: return ['manage_members', 'manage_events', 'manage_photos', 'manage_chat'];
    case FamilyRoleEnum.MEMBER: return ['view_all', 'create_events', 'upload_photos', 'chat'];
    case FamilyRoleEnum.CHILD: return ['view_limited', 'chat_limited'];
    default: return [];
  }
}

export function canUserManageFamily(userRole?: FamilyRoleEnum): boolean {
  if (!userRole) return false;
  return userRole === FamilyRoleEnum.OWNER || userRole === FamilyRoleEnum.MODERATOR;
}

export function canUserManageMembers(userRole?: FamilyRoleEnum): boolean {
  if (!userRole) return false;
  return userRole === FamilyRoleEnum.OWNER || userRole === FamilyRoleEnum.MODERATOR;
}

export function canUserInviteMembers(userRole?: FamilyRoleEnum): boolean {
  if (!userRole) return false;
  return userRole === FamilyRoleEnum.OWNER || userRole === FamilyRoleEnum.MODERATOR;
}

export function hasPermission(userRole: FamilyRoleEnum | undefined, permission: string): boolean {
  if (!userRole) return false;

  const permissions = getFamilyRolePermissions(userRole);
  return permissions.includes('all') || permissions.includes(permission);
}

export function isFamilyRole(value: any): value is FamilyRoleEnum {
  return Object.values(FamilyRoleEnum).includes(value);
}

export function isFamilyPrivacy(value: any): value is FamilyPrivacyEnum {
  return Object.values(FamilyPrivacyEnum).includes(value);
}
