import { pino, type Logger as PinoLogger } from "pino";
import { getContext } from "./context";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  level?: LogLevel;
  /** Pretty-print for local development; structured JSON otherwise. */
  pretty?: boolean;
  /** Static fields attached to every log line (e.g. service name). */
  base?: Record<string, unknown>;
}

/**
 * Fields that must never appear in logs. Defense against accidentally logging
 * secrets, tokens, or OTP codes (Security review; OWASP A09 logging failures).
 */
const REDACT_PATHS = [
  "password",
  "*.password",
  "otp",
  "*.otp",
  "token",
  "*.token",
  "accessToken",
  "refreshToken",
  "authorization",
  "req.headers.authorization",
  "*.secret",
];

/**
 * Create a structured logger. Output is JSON (machine-parseable, ready for
 * CloudWatch/Datadog) except in local dev where pretty printing is friendlier.
 *
 * The logger automatically merges the current request context (requestId,
 * userId) into every line via a mixin, so logs are correlated without callers
 * passing ids around.
 */
export function createLogger(options: LoggerOptions = {}): PinoLogger {
  const { level = "info", pretty = false, base = {} } = options;

  return pino({
    level,
    base,
    redact: { paths: REDACT_PATHS, censor: "[REDACTED]" },
    mixin() {
      const ctx = getContext();
      return ctx
        ? { requestId: ctx.requestId, userId: ctx.userId, role: ctx.role }
        : {};
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(pretty
      ? {
          transport: {
            target: "pino/file",
            options: { destination: 1 },
          },
        }
      : {}),
  });
}

export type Logger = PinoLogger;
