import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { runWithContext } from "@tradescore/logging";

/**
 * Establishes a per-request context (correlation id) for the lifetime of the
 * request. Every log line and audit entry emitted while handling the request is
 * automatically tagged with this id. Honors an inbound `x-request-id` so a trace
 * can be followed across services.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const headerId = req.headers["x-request-id"];
    const requestId = (Array.isArray(headerId) ? headerId[0] : headerId) ?? randomUUID();
    res.setHeader("x-request-id", requestId);
    runWithContext({ requestId }, () => next());
  }
}
