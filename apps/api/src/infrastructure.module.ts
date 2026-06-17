import { Global, Module, type OnModuleDestroy, type OnModuleInit, Inject } from "@nestjs/common";
import { Redis } from "ioredis";
import { loadConfig, type AppConfig } from "@tradescore/config";
import { createLogger, LogAuditLogger, type Logger } from "@tradescore/logging";
import { InMemoryEventBus } from "@tradescore/events";
import { Database } from "@tradescore/database";
import { TokenService, OtpService } from "@tradescore/auth";
import { RedisOtpStore } from "./auth/redis-otp.store";
import { RedisSessionStore } from "./auth/redis-session.store";
import { DevOtpDelivery } from "./auth/otp-delivery";
import {
  APP_CONFIG,
  AUDIT_LOGGER,
  DATABASE,
  EVENT_BUS,
  LOGGER,
  OTP_DELIVERY,
  OTP_SERVICE,
  OTP_STORE,
  REDIS,
  SESSION_STORE,
  TOKEN_SERVICE,
} from "./tokens";

/**
 * Composition root for cross-cutting infrastructure.
 *
 * Global so every feature module can inject the shared config, logger, database,
 * event bus, and token service. This is where framework-agnostic packages are
 * instantiated and bound to DI tokens — the one place NestJS meets the platform.
 */
@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => loadConfig(),
    },
    {
      provide: LOGGER,
      useFactory: (config: AppConfig): Logger =>
        createLogger({
          level: config.observability.logLevel,
          pretty: !config.isProduction,
          base: { service: "tradescore-api" },
        }),
      inject: [APP_CONFIG],
    },
    {
      provide: AUDIT_LOGGER,
      useFactory: (logger: Logger) => new LogAuditLogger(logger),
      inject: [LOGGER],
    },
    {
      provide: EVENT_BUS,
      useFactory: (logger: Logger) => new InMemoryEventBus(logger),
      inject: [LOGGER],
    },
    {
      provide: DATABASE,
      useFactory: (config: AppConfig, logger: Logger): Database =>
        new Database({
          connectionString: config.database.url,
          ssl: config.database.ssl,
          poolMax: config.database.poolMax,
          logger,
        }),
      inject: [APP_CONFIG, LOGGER],
    },
    {
      provide: TOKEN_SERVICE,
      useFactory: (config: AppConfig) =>
        new TokenService({
          accessSecret: config.auth.accessSecret,
          accessTtlSeconds: config.auth.accessTtl,
          issuer: config.auth.issuer,
        }),
      inject: [APP_CONFIG],
    },
    {
      provide: REDIS,
      useFactory: (config: AppConfig): Redis =>
        new Redis(config.redis.url, { maxRetriesPerRequest: null, lazyConnect: false }),
      inject: [APP_CONFIG],
    },
    {
      provide: OTP_SERVICE,
      useFactory: (config: AppConfig) =>
        new OtpService({
          secret: config.auth.accessSecret,
          length: config.otp.length,
          ttlSeconds: config.otp.ttl,
          maxAttempts: config.otp.maxAttempts,
        }),
      inject: [APP_CONFIG],
    },
    {
      provide: OTP_STORE,
      useFactory: (redis: Redis) => new RedisOtpStore(redis),
      inject: [REDIS],
    },
    {
      provide: SESSION_STORE,
      useFactory: (redis: Redis) => new RedisSessionStore(redis),
      inject: [REDIS],
    },
    {
      provide: OTP_DELIVERY,
      useFactory: (logger: Logger) => new DevOtpDelivery(logger),
      inject: [LOGGER],
    },
  ],
  exports: [
    APP_CONFIG,
    LOGGER,
    AUDIT_LOGGER,
    EVENT_BUS,
    DATABASE,
    TOKEN_SERVICE,
    REDIS,
    OTP_SERVICE,
    OTP_STORE,
    SESSION_STORE,
    OTP_DELIVERY,
  ],
})
export class InfrastructureModule implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    const healthy = await this.db.healthCheck();
    if (!healthy) {
      this.logger.warn("database health check failed at startup; is postgres running?");
    } else {
      this.logger.info("database connection established");
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.db.close();
    this.redis.disconnect();
  }
}
