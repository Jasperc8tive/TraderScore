import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request context propagated implicitly via AsyncLocalStorage.
 *
 * Carrying the request id (and the acting user, once authenticated) in async
 * context means every log line emitted while handling a request is automatically
 * correlated — without threading a logger through every function signature. This
 * is the backbone of request logging and of audit attribution (Trust
 * Architecture Review §5: "every privileged action audit-logged").
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
  role?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Run `fn` with the given request context bound for its entire async lifetime. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

/** Read the current request context, if any. */
export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Attach the authenticated actor to the current context (post-auth). */
export function setActor(userId: string, role: string): void {
  const ctx = storage.getStore();
  if (ctx) {
    ctx.userId = userId;
    ctx.role = role;
  }
}
