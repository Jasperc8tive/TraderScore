import { describe, expect, it } from "vitest";
import { ErrorCode } from "@tradescore/shared";
import { httpStatusToErrorCode } from "./error-mapping";

describe("httpStatusToErrorCode", () => {
  it("maps known statuses to stable codes", () => {
    expect(httpStatusToErrorCode(400)).toBe(ErrorCode.VALIDATION_ERROR);
    expect(httpStatusToErrorCode(401)).toBe(ErrorCode.UNAUTHORIZED);
    expect(httpStatusToErrorCode(403)).toBe(ErrorCode.FORBIDDEN);
    expect(httpStatusToErrorCode(404)).toBe(ErrorCode.NOT_FOUND);
    expect(httpStatusToErrorCode(409)).toBe(ErrorCode.CONFLICT);
    expect(httpStatusToErrorCode(429)).toBe(ErrorCode.RATE_LIMITED);
  });

  it("falls back to INTERNAL for unknown statuses", () => {
    expect(httpStatusToErrorCode(500)).toBe(ErrorCode.INTERNAL);
    expect(httpStatusToErrorCode(418)).toBe(ErrorCode.INTERNAL);
  });
});
