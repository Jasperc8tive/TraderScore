/**
 * Cross-cutting domain constants shared across all packages and apps.
 *
 * These enums are intentionally placed in @tradescore/shared (not @tradescore/auth
 * or @tradescore/core) because they are referenced by the database layer, the auth
 * layer, the API, and the web app alike. Keeping a single canonical definition
 * prevents drift between, e.g., a DB CHECK constraint and a TypeScript guard.
 */

/**
 * System roles. Encodes least-privilege separation (Trust Architecture Review §3, F7).
 * Order is not significant; authorization is capability-based, not hierarchical-by-int.
 */
export const Role = {
  ADMIN: "ADMIN",
  MODERATOR: "MODERATOR",
  BUSINESS_OWNER: "BUSINESS_OWNER",
  BUSINESS_STAFF: "BUSINESS_STAFF",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ALL_ROLES: readonly Role[] = Object.values(Role);

/** Lifecycle status for a user account. */
export const UserStatus = {
  PENDING: "PENDING", // created, not yet verified
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

/**
 * A user's role *within a specific business* (membership), distinct from the
 * system Role. OWNER controls the business identity and membership; STAFF can
 * operate on its behalf within limits. Enforces separation of duties
 * (Trust Architecture Review §3, F7).
 */
export const BusinessMemberRole = {
  OWNER: "OWNER",
  STAFF: "STAFF",
} as const;
export type BusinessMemberRole = (typeof BusinessMemberRole)[keyof typeof BusinessMemberRole];

/** Lifecycle status for a business entity. */
export const BusinessStatus = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type BusinessStatus = (typeof BusinessStatus)[keyof typeof BusinessStatus];

/**
 * Assurance level captures the *provenance* of trust in a business identity
 * (Trust Architecture Review §3, F1/F2). Unverified businesses carry near-zero
 * scoring weight; higher assurance unlocks higher influence. This is an ordered
 * scale, so it is modeled with explicit numeric ranks for comparison.
 */
export const AssuranceLevel = {
  UNVERIFIED: "UNVERIFIED",
  PHONE_VERIFIED: "PHONE_VERIFIED",
  DOCUMENT_VERIFIED: "DOCUMENT_VERIFIED",
  FULLY_VERIFIED: "FULLY_VERIFIED",
} as const;
export type AssuranceLevel = (typeof AssuranceLevel)[keyof typeof AssuranceLevel];

export const ASSURANCE_RANK: Record<AssuranceLevel, number> = {
  UNVERIFIED: 0,
  PHONE_VERIFIED: 1,
  DOCUMENT_VERIFIED: 2,
  FULLY_VERIFIED: 3,
};

/**
 * Lifecycle status of a logged trade.
 *
 * A trade is worth nothing until counterparty-confirmed (Trust Architecture
 * Review §3, F3). Stage 3 uses DRAFT / PENDING_CONFIRMATION / CANCELLED; the
 * remaining states are owned by the confirmation workflow (Stage 4) and are
 * declared here so the contract is fixed up front.
 */
export const TradeStatus = {
  DRAFT: "DRAFT",
  PENDING_CONFIRMATION: "PENDING_CONFIRMATION",
  CONFIRMED: "CONFIRMED",
  DISPUTED: "DISPUTED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type TradeStatus = (typeof TradeStatus)[keyof typeof TradeStatus];

/** Direction of a trade from the initiating business's perspective. */
export const TradeDirection = {
  SALE: "SALE", // initiator sold to the counterparty
  PURCHASE: "PURCHASE", // initiator bought from the counterparty
} as const;
export type TradeDirection = (typeof TradeDirection)[keyof typeof TradeDirection];

/**
 * Human-readable reputation band derived from a score. A business with no
 * confirmed trades is always NEW (no track record), regardless of score.
 * Bands are a *label* over the numeric score — never the source of truth
 * (Trust Architecture Review §4).
 */
export const ScoreBand = {
  NEW: "NEW",
  BUILDING: "BUILDING",
  ESTABLISHED: "ESTABLISHED",
  TRUSTED: "TRUSTED",
  HIGHLY_TRUSTED: "HIGHLY_TRUSTED",
} as const;
export type ScoreBand = (typeof ScoreBand)[keyof typeof ScoreBand];

/** Direction of a score factor's contribution. */
export const ScoreFactorDirection = {
  POSITIVE: "POSITIVE",
  NEGATIVE: "NEGATIVE",
} as const;
export type ScoreFactorDirection =
  (typeof ScoreFactorDirection)[keyof typeof ScoreFactorDirection];

/**
 * Lifecycle of a formal dispute case (Stage 7). A dispute freezes a trade's trust
 * until a moderator/admin adjudicates it (Trust Architecture Review §3, F6).
 */
export const DisputeStatus = {
  OPEN: "OPEN",
  UNDER_REVIEW: "UNDER_REVIEW",
  RESOLVED: "RESOLVED",
  WITHDRAWN: "WITHDRAWN",
} as const;
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

/** Adjudicated outcome of a resolved dispute. */
export const DisputeResolution = {
  UPHELD: "UPHELD", // dispute valid → trade rejected
  DISMISSED: "DISMISSED", // dispute invalid → trade confirmed
} as const;
export type DisputeResolution = (typeof DisputeResolution)[keyof typeof DisputeResolution];

/**
 * Fraud detection (Stage 9). Flags are OPINIONS about data — they never mutate
 * trades, confirmations, or scores (Trust Architecture Review §2).
 */
export const FraudFlagType = {
  SYBIL_CLUSTER: "SYBIL_CLUSTER",
  CIRCULAR_TRADING: "CIRCULAR_TRADING",
  WASH_TRADING: "WASH_TRADING",
  VELOCITY_ANOMALY: "VELOCITY_ANOMALY",
  HIGH_DISPUTE_RATE: "HIGH_DISPUTE_RATE",
  RELATIONSHIP_RISK: "RELATIONSHIP_RISK",
} as const;
export type FraudFlagType = (typeof FraudFlagType)[keyof typeof FraudFlagType];

export const FraudSubjectType = {
  BUSINESS: "BUSINESS",
  USER: "USER",
  RELATIONSHIP: "RELATIONSHIP",
  TRADE: "TRADE",
} as const;
export type FraudSubjectType = (typeof FraudSubjectType)[keyof typeof FraudSubjectType];

export const FraudSeverity = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;
export type FraudSeverity = (typeof FraudSeverity)[keyof typeof FraudSeverity];

export const FraudFlagStatus = {
  OPEN: "OPEN",
  CONFIRMED: "CONFIRMED",
  DISMISSED: "DISMISSED",
} as const;
export type FraudFlagStatus = (typeof FraudFlagStatus)[keyof typeof FraudFlagStatus];

/** Commercial plans (Stage 13). Prices/entitlements are defined in app code. */
export const PlanId = {
  FREE: "FREE",
  PRO: "PRO",
  ELITE: "ELITE",
} as const;
export type PlanId = (typeof PlanId)[keyof typeof PlanId];

/** Subscription lifecycle. */
export const SubscriptionStatus = {
  ACTIVE: "ACTIVE",
  PAST_DUE: "PAST_DUE",
  CANCELLED: "CANCELLED",
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

/** Invoice lifecycle. */
export const InvoiceStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

/** Delivery channels for notifications (Stage 10). */
export const NotificationChannel = {
  SMS: "SMS",
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
  IN_APP: "IN_APP",
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

/** Delivery lifecycle of a notification. */
export const NotificationStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  FAILED: "FAILED",
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

/** Kinds of entries in the append-only trade event log (matches the DB CHECK). */
export const TradeEventType = {
  CREATED: "CREATED",
  EDITED: "EDITED",
  SUBMITTED: "SUBMITTED",
  CANCELLED: "CANCELLED",
  // Counterparty decisions (Stage 4) and dispute outcomes (Stage 7).
  CONFIRMED: "CONFIRMED",
  DISPUTED: "DISPUTED",
  REJECTED: "REJECTED",
} as const;
export type TradeEventType = (typeof TradeEventType)[keyof typeof TradeEventType];
