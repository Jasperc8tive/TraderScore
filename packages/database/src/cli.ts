#!/usr/bin/env node
import { join } from "node:path";
import { config as loadDotenv } from "dotenv";
import { loadConfig } from "@tradescore/config";
import { createLogger } from "@tradescore/logging";
import { Database } from "./pool";
import { Migrator } from "./migrator";
import { runSeeds, runPilotSeed } from "./seed";

/**
 * Load the repository-root `.env` for host-run usage. Migrations and seeds are
 * run from the host (see README), where — unlike inside Docker Compose, which
 * injects `env_file` values — nothing populates `process.env`. `override: true`
 * makes the project's committed local config authoritative over stale, unrelated
 * machine-level variables. If the project `.env` does not define `DATABASE_URL`,
 * drop any inherited one so a global `DATABASE_URL` from another project on the
 * same machine cannot hijack the local connection. The path resolves to the repo
 * root from both `src/` (tsx) and compiled `dist/` (same depth).
 */
const dotenvResult = loadDotenv({
  path: join(__dirname, "..", "..", "..", ".env"),
  override: true,
});
if (!dotenvResult.parsed?.DATABASE_URL) {
  delete process.env.DATABASE_URL;
}

/**
 * Database CLI: `tradescore-db <migrate|status|seed>`.
 *
 * Resolves the migrations directory relative to the package root so it works
 * both from compiled `dist/` and from `src/` under tsx.
 */
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

async function main(): Promise<void> {
  const command = process.argv[2];
  const config = loadConfig();
  const logger = createLogger({ level: config.observability.logLevel, base: { service: "db-cli" } });
  const db = new Database({
    connectionString: config.database.url,
    ssl: config.database.ssl,
    poolMax: config.database.poolMax,
    logger,
  });

  try {
    switch (command) {
      case "migrate": {
        const migrator = new Migrator(db, MIGRATIONS_DIR, logger);
        await migrator.migrate();
        break;
      }
      case "status": {
        const migrator = new Migrator(db, MIGRATIONS_DIR, logger);
        const status = await migrator.status();
        for (const m of status) {
          logger.info({ migration: m.name, applied: m.applied }, m.name);
        }
        break;
      }
      case "seed": {
        if (config.isProduction) {
          throw new Error("Refusing to run development seeds in production");
        }
        await runSeeds(db, logger);
        break;
      }
      case "seed:pilot": {
        if (config.isProduction) {
          throw new Error("Refusing to run pilot seed in production");
        }
        await runPilotSeed(db, logger);
        break;
      }
      default:
        logger.error(`Unknown command: ${command ?? "(none)"}. Use migrate | status | seed | seed:pilot.`);
        process.exitCode = 1;
    }
  } catch (error) {
    logger.error({ err: error }, "database CLI failed");
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

void main();
