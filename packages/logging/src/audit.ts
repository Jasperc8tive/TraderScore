import type { Logger } from "./logger";
import { getContext } from "./context";

/**
 * Audit logging.
 *
 * Audit entries are a security/forensics record of *who did what to what*. They
 * are distinct from operational logs: they describe deliberate, security-relevant
 * actions (auth events, privileged operations, trust-affecting changes) and are
 * the evidentiary basis for investigating fraud vectors F7–F9 (Trust
 * Architecture Review §3).
 *
 * In Stage 1 audit entries are emitted to the structured log stream on a
 * dedicated `audit` channel. A later stage persists them to the `activity_logs`
 * table; the call sites do not change because they depend on this interface.
 */
export interface AuditEntry {
  /** Stable action key, e.g. "auth.otp.requested", "business.verified". */
  action: string;
  /** The kind of entity acted upon, e.g. "business". */
  resourceType?: string;
  /** The id of the entity acted upon. */
  resourceId?: string;
  /** Outcome of the action. */
  outcome: "success" | "failure";
  /** Non-sensitive contextual metadata. Never include secrets/OTP/tokens. */
  metadata?: Record<string, unknown>;
}

export interface AuditLogger {
  record(entry: AuditEntry): void;
}

export class LogAuditLogger implements AuditLogger {
  private readonly log: Logger;

  constructor(logger: Logger) {
    this.log = logger.child({ channel: "audit" });
  }

  record(entry: AuditEntry): void {
    const ctx = getContext();
    this.log.info(
      {
        audit: true,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        outcome: entry.outcome,
        actorUserId: ctx?.userId ?? null,
        actorRole: ctx?.role ?? null,
        requestId: ctx?.requestId ?? null,
        metadata: entry.metadata ?? {},
        at: new Date().toISOString(),
      },
      `audit:${entry.action}`,
    );
  }
}
