import type {
  Role,
  UserStatus,
  BusinessStatus,
  AssuranceLevel,
  BusinessMemberRole,
  UUID,
} from "@tradescore/shared";

/**
 * Persistence-facing record shapes (camelCase projections of DB rows).
 * Repositories map snake_case columns to these so the rest of the app never
 * deals with raw DB naming.
 */

export interface UserRecord {
  id: UUID;
  phone: string;
  email: string | null;
  fullName: string | null;
  role: Role;
  status: UserStatus;
  phoneVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface BusinessRecord {
  id: UUID;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  marketClusterId: UUID | null;
  assuranceLevel: AssuranceLevel;
  status: BusinessStatus;
  referralCode: string;
  createdBy: UUID;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface BusinessMemberRecord {
  id: UUID;
  businessId: UUID;
  userId: UUID;
  memberRole: BusinessMemberRole;
  addedBy: UUID | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface MarketClusterRecord {
  id: UUID;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  country: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
