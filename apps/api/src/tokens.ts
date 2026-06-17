/**
 * Dependency-injection tokens for cross-cutting infrastructure.
 *
 * These string tokens let the rest of the application depend on interfaces from
 * the workspace packages (Database, EventBus, Logger, ...) without those packages
 * needing to know about NestJS. Keeps the framework at the edges (Clean
 * Architecture): domain/infra packages stay framework-agnostic.
 */
export const APP_CONFIG = Symbol("APP_CONFIG");
export const LOGGER = Symbol("LOGGER");
export const AUDIT_LOGGER = Symbol("AUDIT_LOGGER");
export const DATABASE = Symbol("DATABASE");
export const EVENT_BUS = Symbol("EVENT_BUS");
export const TOKEN_SERVICE = Symbol("TOKEN_SERVICE");
export const REDIS = Symbol("REDIS");
export const OTP_SERVICE = Symbol("OTP_SERVICE");
export const OTP_STORE = Symbol("OTP_STORE");
export const SESSION_STORE = Symbol("SESSION_STORE");
export const OTP_DELIVERY = Symbol("OTP_DELIVERY");
