import type { Role, UserStatus, BusinessStatus, AssuranceLevel, BusinessMemberRole } from "@tradescore/shared";
import type {
  BusinessMemberRecord,
  BusinessRecord,
  MarketClusterRecord,
  UserRecord,
} from "./types";

/**
 * Map raw snake_case DB rows to camelCase records. Centralized so column naming
 * lives in exactly one place per entity.
 */

export function mapUser(r: Record<string, unknown>): UserRecord {
  return {
    id: r.id as string,
    phone: r.phone as string,
    email: (r.email as string | null) ?? null,
    fullName: (r.full_name as string | null) ?? null,
    role: r.role as Role,
    status: r.status as UserStatus,
    phoneVerifiedAt: r.phone_verified_at ? new Date(r.phone_verified_at as string) : null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    deletedAt: r.deleted_at ? new Date(r.deleted_at as string) : null,
  };
}

export function mapBusiness(r: Record<string, unknown>): BusinessRecord {
  return {
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    description: (r.description as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    marketClusterId: (r.market_cluster_id as string | null) ?? null,
    assuranceLevel: r.assurance_level as AssuranceLevel,
    status: r.status as BusinessStatus,
    referralCode: r.referral_code as string,
    createdBy: r.created_by as string,
    verifiedAt: r.verified_at ? new Date(r.verified_at as string) : null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    deletedAt: r.deleted_at ? new Date(r.deleted_at as string) : null,
  };
}

export function mapBusinessMember(r: Record<string, unknown>): BusinessMemberRecord {
  return {
    id: r.id as string,
    businessId: r.business_id as string,
    userId: r.user_id as string,
    memberRole: r.member_role as BusinessMemberRole,
    addedBy: (r.added_by as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    deletedAt: r.deleted_at ? new Date(r.deleted_at as string) : null,
  };
}

export function mapMarketCluster(r: Record<string, unknown>): MarketClusterRecord {
  return {
    id: r.id as string,
    name: r.name as string,
    slug: r.slug as string,
    city: (r.city as string | null) ?? null,
    state: (r.state as string | null) ?? null,
    country: r.country as string,
    description: (r.description as string | null) ?? null,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
    deletedAt: r.deleted_at ? new Date(r.deleted_at as string) : null,
  };
}
