import {
  Catch,
  HttpException,
  Inject,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Response } from "express";
import type { AppError} from "@tradescore/shared";
import { ErrorCode, isAppError, type ApiError } from "@tradescore/shared";
import type { Logger } from "@tradescore/logging";
import { LOGGER } from "../tokens";
import { httpStatusToErrorCode } from "./error-mapping";

/**
 * Translates every thrown error into the standard error envelope
 * `{ error: { code, message, details } }` (spec §13).
 *
 * - AppError carries its own stable code + HTTP status (operational, client-safe).
 * - NestJS HttpException is mapped to a reasonable code/status.
 * - Anything else is an unexpected fault: logged at error with the stack, and
 *   surfaced to the client as a generic INTERNAL error WITHOUT leaking internals
 *   (OWASP A09 / information exposure).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (isAppError(exception)) {
      if (!exception.isOperational) {
        this.logger.error({ err: exception }, "non-operational AppError");
      }
      response.status(exception.httpStatus).json(this.envelope(exception));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const message =
        typeof payload === "string"
          ? payload
          : ((payload as { message?: string | string[] }).message ?? exception.message);
      response.status(status).json({
        error: {
          code: httpStatusToErrorCode(status),
          message: Array.isArray(message) ? message.join("; ") : message,
        },
      } satisfies ApiError);
      return;
    }

    // Unknown / unexpected fault.
    this.logger.error({ err: exception }, "unhandled exception");
    response.status(500).json({
      error: { code: ErrorCode.INTERNAL, message: "An unexpected error occurred" },
    } satisfies ApiError);
  }

  private envelope(error: AppError): ApiError {
    return { error: error.toJSON() };
  }
}
