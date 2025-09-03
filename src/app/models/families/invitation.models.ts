export enum InvitationStatusEnum {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired'
}

export enum RelationshipTypeEnum {
  PARENT = 'parent',
  CHILD = 'child',
  SPOUSE = 'spouse',
  SIBLING = 'sibling',
  GRANDPARENT = 'grandparent',
  GRANDCHILD = 'grandchild',
  AUNT_UNCLE = 'aunt_uncle',
  NEPHEW_NIECE = 'nephew_niece',
  COUSIN = 'cousin',
  IN_LAW = 'in_law',
  GUARDIAN = 'guardian',
  OTHER = 'other'
}

export interface FamilyInvitation {
  id: number;
  familyId: number;
  invitedBy: number;
  email: string;
  token: string;
  role: number;
  message?: string;
  status: InvitationStatusEnum;
  expiresAt: string;
  acceptedAt?: string;
  declinedAt?: string;
  createdAt: string;
  updatedAt: string;

  // Relations
  family?: any;
  inviter?: any;
}

export interface FamilyMemberRelationship {
  id: number;
  familyId: number;
  memberId: number;
  relatedMemberId: number;
  relationshipType: RelationshipTypeEnum;
  isGuardian: boolean;
  createdAt: string;
  updatedAt: string;

  // Relations
  member?: any;
  relatedMember?: any;
}

export interface InviteMemberRequest {
  email: string;
  role: number;
  message?: string;
}

export interface UpdateMemberRoleRequest {
  role: number;
}

export interface SetRelationshipRequest {
  relatedMemberId: number;
  relationshipType: RelationshipTypeEnum;
  isGuardian?: boolean;
}

// Utility functions
export function getRelationshipLabel(type: RelationshipTypeEnum): string {
  switch (type) {
    case RelationshipTypeEnum.PARENT: return 'Parent';
    case RelationshipTypeEnum.CHILD: return 'Child';
    case RelationshipTypeEnum.SPOUSE: return 'Spouse';
    case RelationshipTypeEnum.SIBLING: return 'Sibling';
    case RelationshipTypeEnum.GRANDPARENT: return 'Grandparent';
    case RelationshipTypeEnum.GRANDCHILD: return 'Grandchild';
    case RelationshipTypeEnum.AUNT_UNCLE: return 'Aunt/Uncle';
    case RelationshipTypeEnum.NEPHEW_NIECE: return 'Nephew/Niece';
    case RelationshipTypeEnum.COUSIN: return 'Cousin';
    case RelationshipTypeEnum.IN_LAW: return 'In-Law';
    case RelationshipTypeEnum.GUARDIAN: return 'Guardian';
    case RelationshipTypeEnum.OTHER: return 'Other';
    default: return 'Unknown';
  }
}

export function getInvitationStatusLabel(status: InvitationStatusEnum): string {
  switch (status) {
    case InvitationStatusEnum.PENDING: return 'Pending';
    case InvitationStatusEnum.ACCEPTED: return 'Accepted';
    case InvitationStatusEnum.DECLINED: return 'Declined';
    case InvitationStatusEnum.EXPIRED: return 'Expired';
    default: return 'Unknown';
  }
}

export function getInvitationStatusColor(status: InvitationStatusEnum): string {
  switch (status) {
    case InvitationStatusEnum.PENDING: return '#f59e0b';
    case InvitationStatusEnum.ACCEPTED: return '#22c55e';
    case InvitationStatusEnum.DECLINED: return '#ef4444';
    case InvitationStatusEnum.EXPIRED: return '#6b7280';
    default: return '#6b7280';
  }
}
