import { z } from "zod";

/**
 * The single source of truth for environment configuration.
 *
 * Every value the platform reads from the environment is declared here and
 * validated at startup. If a required variable is missing or malformed, the
 * process fails fast with an actionable message rather than failing mysteriously
 * at runtime. This keeps the code free of scattered `process.env.X!` access and
 * makes the same build run unchanged locally and on AWS (env-driven, §15 of spec).
 */

const booleanFromString = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .transform((v) => v === true || v === "true" || v === "1");

const numberFromString = (defaultValue?: number) => {
  const base = z.coerce.number().int();
  return defaultValue === undefined ? base : base.default(defaultValue);
};

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // API
  API_PORT: numberFromString(4000),
  API_HOST: z.string().default("0.0.0.0"),
  API_CORS_ORIGINS: z.string().default("http://localhost:3000"),

  // Web
  WEB_PORT: numberFromString(3000),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),

  // PostgreSQL — discrete vars, with optional full URL override.
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: numberFromString(5432),
  POSTGRES_USER: z.string().default("tradescore"),
  POSTGRES_PASSWORD: z.string().default("tradescore_dev_password"),
  POSTGRES_DB: z.string().default("tradescore"),
  POSTGRES_SSL: booleanFromString.default(false),
  POSTGRES_POOL_MAX: numberFromString(10),

  // Redis
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: numberFromString(6379),
  REDIS_PASSWORD: z.string().optional(),

  // Auth — secrets must be long enough to be safe. Relaxed in test only.
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: numberFromString(900),
  JWT_REFRESH_TTL: numberFromString(2592000),
  JWT_ISSUER: z.string().default("tradescore"),

  // OTP
  OTP_TTL: numberFromString(300),
  OTP_LENGTH: numberFromString(6),
  OTP_MAX_ATTEMPTS: numberFromString(5),
  OTP_RESEND_COOLDOWN: numberFromString(60),

  // Storage
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./.docker-data/uploads"),
  STORAGE_S3_BUCKET: z.string().optional(),
  STORAGE_S3_REGION: z.string().optional(),
  STORAGE_S3_ENDPOINT: z.string().optional(),

  // Observability
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  SENTRY_DSN: z.string().optional(),
  POSTHOG_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate the given environment record (defaults to process.env).
 * Throws an aggregated, readable error if validation fails.
 */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
