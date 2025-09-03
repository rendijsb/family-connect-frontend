export enum RoleEnum {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  CLIENT = 'client'
}

export interface Role {
  id: number;
  name: string;
  displayName: string;
  description: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  emailVerifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  role: Role;
  token?: string;
  avatar?: string;
  canManageFamily?: boolean;
}
