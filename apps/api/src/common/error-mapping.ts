import { ErrorCode } from "@tradescore/shared";

/**
 * Pure mapping from HTTP status to our stable error code. Extracted from the
 * exception filter so it can be unit-tested without the NestJS runtime.
 */
export function httpStatusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCode.VALIDATION_ERROR;
    case 401:
      return ErrorCode.UNAUTHORIZED;
    case 403:
      return ErrorCode.FORBIDDEN;
    case 404:
      return ErrorCode.NOT_FOUND;
    case 409:
      return ErrorCode.CONFLICT;
    case 429:
      return ErrorCode.RATE_LIMITED;
    default:
      return ErrorCode.INTERNAL;
  }
}
