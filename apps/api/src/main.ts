import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { loadConfig } from "@tradescore/config";
import { createLogger } from "@tradescore/logging";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { ResponseEnvelopeInterceptor } from "./common/response.interceptor";
import { LOGGER } from "./tokens";

/**
 * API bootstrap.
 *
 * Establishes the production-grade request pipeline up front: global API prefix
 * and versioning, strict DTO validation at the boundary, the standard response
 * envelope, the standard error envelope, and locked-down CORS driven by config.
 */
async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Versioned, prefixed API surface (spec §13).
  app.setGlobalPrefix("api/v1");

  // Reject unknown/invalid payloads before they reach handlers (OWASP A03/A04).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Standard success + error envelopes.
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());
  const logger = app.get(LOGGER);
  app.useGlobalFilters(new AllExceptionsFilter(logger));

  // CORS restricted to configured origins only.
  app.enableCors({
    origin: config.api.corsOrigins,
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(config.api.port, config.api.host);
  logger.info(
    { port: config.api.port, host: config.api.host, env: config.env },
    `TradeScore API listening on http://${config.api.host}:${config.api.port}/api/v1`,
  );
}

bootstrap().catch((error: unknown) => {
  const logger = createLogger({ base: { service: "tradescore-api" } });
  logger.fatal({ err: error }, "failed to bootstrap API");
  process.exit(1);
});
