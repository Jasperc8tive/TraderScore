/** Common structural types shared across the platform. */

/** A UUID string. Branded loosely for readability; not enforced at runtime. */
export type UUID = string;

/** ISO-8601 timestamp string. */
export type ISODateString = string;

/** Audit columns present on every persisted entity. */
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

/** Soft-deletable entities also carry a deletion marker. */
export interface SoftDeletable {
  deletedAt: Date | null;
}

/** Standard success envelope returned by the API. */
export interface ApiSuccess<T> {
  data: T;
}

/** Standard error envelope returned by the API. */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Cursor/offset pagination request. */
export interface Pagination {
  page: number;
  pageSize: number;
}

/** Paginated response wrapper. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** Identifier of the actor responsible for a change (for attribution/audit). */
export interface Actor {
  userId: UUID;
  role: string;
}
