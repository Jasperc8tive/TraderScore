/**
 * Canonical application error model.
 *
 * Every error surfaced across a boundary carries a stable, machine-readable
 * `code` (for clients and logs) plus an HTTP status hint. The API maps any
 * AppError onto the standard error envelope `{ error: { code, message, details } }`.
 *
 * Stable codes are part of the API contract — do not rename them lightly.
 */

export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type ErrorDetails = Record<string, unknown>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: ErrorDetails;
  /** True for expected, client-facing errors; false for unexpected faults. */
  readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    httpStatus: number,
    options?: {
      details?: ErrorDetails | undefined;
      isOperational?: boolean | undefined;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.isOperational = options?.isOperational ?? true;
    if (options?.details !== undefined) {
      this.details = options.details;
    }
    // captureStackTrace is V8-only and not in the standard lib typings.
    const errorCtor = Error as unknown as {
      captureStackTrace?: (target: object, ctor: unknown) => void;
    };
    errorCtor.captureStackTrace?.(this, new.target);
  }

  toJSON(): { code: ErrorCode; message: string; details?: ErrorDetails } {
    return this.details !== undefined
      ? { code: this.code, message: this.message, details: this.details }
      : { code: this.code, message: this.message };
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: ErrorDetails) {
    super(ErrorCode.VALIDATION_ERROR, message, 400, { details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(ErrorCode.UNAUTHORIZED, message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to perform this action") {
    super(ErrorCode.FORBIDDEN, message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(ErrorCode.NOT_FOUND, `${resource} not found`, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict", details?: ErrorDetails) {
    super(ErrorCode.CONFLICT, message, 409, { details });
  }
}

export class RateLimitedError extends AppError {
  constructor(message = "Too many requests", details?: ErrorDetails) {
    super(ErrorCode.RATE_LIMITED, message, 429, { details });
  }
}

export class InternalError extends AppError {
  constructor(message = "An unexpected error occurred", cause?: unknown) {
    super(ErrorCode.INTERNAL, message, 500, { isOperational: false, cause });
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
