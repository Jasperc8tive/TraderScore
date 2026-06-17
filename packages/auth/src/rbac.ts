import { Role } from "@tradescore/shared";

/**
 * Role-Based Access Control.
 *
 * Authorization is **capability-based**, not hierarchical-by-integer. Each role
 * maps to an explicit set of permissions. This makes least privilege auditable
 * (Trust Architecture Review §3, F7): you can read exactly what a BUSINESS_STAFF
 * may do, and granting a new capability is a deliberate edit here rather than an
 * accidental side effect of a numeric role comparison.
 *
 * Permissions use a `resource:action` convention. New permissions are added as
 * later stages introduce new resources (trades, disputes, scores...).
 */
export const Permission = {
  // Identity / business management
  BUSINESS_CREATE: "business:create",
  BUSINESS_UPDATE: "business:update",
  BUSINESS_VERIFY: "business:verify",
  BUSINESS_VIEW: "business:view",
  BUSINESS_MODERATE: "business:moderate",
  // Dispute adjudication
  DISPUTE_RESOLVE: "dispute:resolve",
  // Fraud operations
  FRAUD_MANAGE: "fraud:manage",
  // Platform administration
  USER_MANAGE: "user:manage",
  MARKET_MANAGE: "market:manage",
  AUDIT_VIEW: "audit:view",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  [Role.ADMIN]: new Set(Object.values(Permission)),
  [Role.MODERATOR]: new Set([
    Permission.BUSINESS_VIEW,
    Permission.BUSINESS_VERIFY,
    Permission.BUSINESS_MODERATE,
    Permission.DISPUTE_RESOLVE,
    Permission.FRAUD_MANAGE,
    Permission.AUDIT_VIEW,
    Permission.MARKET_MANAGE,
  ]),
  [Role.BUSINESS_OWNER]: new Set([
    Permission.BUSINESS_CREATE,
    Permission.BUSINESS_UPDATE,
    Permission.BUSINESS_VIEW,
  ]),
  // Staff can operate within a business but cannot create/own one or change its
  // identity. Owner-only actions stay owner-only (separation of duties).
  [Role.BUSINESS_STAFF]: new Set([Permission.BUSINESS_VIEW]),
};

/** True if the role is granted the permission. */
export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/** All permissions granted to a role (useful for emitting to a client/UI). */
export function permissionsFor(role: Role): Permission[] {
  return Array.from(ROLE_PERMISSIONS[role] ?? []);
}
