import { parseEnv, type Env } from "./env";

/**
 * Typed, grouped application configuration derived from validated env.
 *
 * Consumers depend on this shape, not on `process.env`. Grouping by concern
 * (db, redis, auth, ...) keeps call sites readable and makes it obvious which
 * subsystem a setting belongs to.
 */
export interface AppConfig {
  env: Env["NODE_ENV"];
  isProduction: boolean;
  isTest: boolean;

  api: {
    host: string;
    port: number;
    corsOrigins: string[];
  };
  web: {
    port: number;
    apiUrl: string;
  };
  database: {
    url: string;
    ssl: boolean;
    poolMax: number;
  };
  redis: {
    url: string;
  };
  auth: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: number;
    refreshTtl: number;
    issuer: string;
  };
  otp: {
    ttl: number;
    length: number;
    maxAttempts: number;
    resendCooldown: number;
  };
  storage: {
    driver: Env["STORAGE_DRIVER"];
    localPath: string;
    s3?: { bucket?: string; region?: string; endpoint?: string };
  };
  observability: {
    logLevel: Env["LOG_LEVEL"];
    sentryDsn?: string;
    posthogKey?: string;
  };
}

function buildDatabaseUrl(env: Env): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const auth = `${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}`;
  return `postgresql://${auth}@${env.POSTGRES_HOST}:${env.POSTGRES_PORT}/${env.POSTGRES_DB}`;
}

function buildRedisUrl(env: Env): string {
  if (env.REDIS_URL) return env.REDIS_URL;
  const auth = env.REDIS_PASSWORD ? `:${encodeURIComponent(env.REDIS_PASSWORD)}@` : "";
  return `redis://${auth}${env.REDIS_HOST}:${env.REDIS_PORT}`;
}

/** Load, validate, and group configuration. Call once at process startup. */
export function loadConfig(source?: NodeJS.ProcessEnv): AppConfig {
  const env = parseEnv(source);
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
    api: {
      host: env.API_HOST,
      port: env.API_PORT,
      corsOrigins: env.API_CORS_ORIGINS.split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    },
    web: { port: env.WEB_PORT, apiUrl: env.NEXT_PUBLIC_API_URL },
    database: { url: buildDatabaseUrl(env), ssl: env.POSTGRES_SSL, poolMax: env.POSTGRES_POOL_MAX },
    redis: { url: buildRedisUrl(env) },
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshTtl: env.JWT_REFRESH_TTL,
      issuer: env.JWT_ISSUER,
    },
    otp: {
      ttl: env.OTP_TTL,
      length: env.OTP_LENGTH,
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      resendCooldown: env.OTP_RESEND_COOLDOWN,
    },
    storage: {
      driver: env.STORAGE_DRIVER,
      localPath: env.STORAGE_LOCAL_PATH,
      s3: {
        ...(env.STORAGE_S3_BUCKET !== undefined ? { bucket: env.STORAGE_S3_BUCKET } : {}),
        ...(env.STORAGE_S3_REGION !== undefined ? { region: env.STORAGE_S3_REGION } : {}),
        ...(env.STORAGE_S3_ENDPOINT !== undefined ? { endpoint: env.STORAGE_S3_ENDPOINT } : {}),
      },
    },
    observability: {
      logLevel: env.LOG_LEVEL,
      ...(env.SENTRY_DSN !== undefined ? { sentryDsn: env.SENTRY_DSN } : {}),
      ...(env.POSTHOG_KEY !== undefined ? { posthogKey: env.POSTHOG_KEY } : {}),
    },
  };
}
