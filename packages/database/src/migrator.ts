import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Logger } from "@tradescore/logging";
import type { Database } from "./pool";

/**
 * Forward-only SQL migration runner.
 *
 * Migrations are plain `.sql` files named `NNNN_description.sql`. They run in
 * lexical order, each inside its own transaction, and are recorded in a
 * `schema_migrations` ledger with a checksum. A changed checksum on an
 * already-applied migration is treated as an error: applied migrations are
 * immutable history, mirroring the append-only philosophy of the trust data
 * itself (Trust Architecture Review §1).
 */
export interface MigrationResult {
  applied: string[];
  alreadyApplied: string[];
}

const LEDGER_DDL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name        TEXT PRIMARY KEY,
    checksum    TEXT NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

function checksum(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

export class Migrator {
  constructor(
    private readonly db: Database,
    private readonly migrationsDir: string,
    private readonly logger: Logger,
  ) {}

  private async listMigrationFiles(): Promise<string[]> {
    const entries = await readdir(this.migrationsDir);
    return entries.filter((f) => f.endsWith(".sql")).sort((a, b) => a.localeCompare(b));
  }

  private async appliedMap(): Promise<Map<string, string>> {
    await this.db.query(LEDGER_DDL);
    const { rows } = await this.db.query<{ name: string; checksum: string }>(
      "SELECT name, checksum FROM schema_migrations",
    );
    return new Map(rows.map((r) => [r.name, r.checksum]));
  }

  /** Apply all pending migrations. Idempotent. */
  async migrate(): Promise<MigrationResult> {
    const files = await this.listMigrationFiles();
    const applied = await this.appliedMap();
    const result: MigrationResult = { applied: [], alreadyApplied: [] };

    for (const file of files) {
      const sql = await readFile(join(this.migrationsDir, file), "utf8");
      const sum = checksum(sql);
      const priorSum = applied.get(file);

      if (priorSum !== undefined) {
        if (priorSum !== sum) {
          throw new Error(
            `Migration "${file}" has changed after being applied. ` +
              `Applied migrations are immutable; create a new migration instead.`,
          );
        }
        result.alreadyApplied.push(file);
        continue;
      }

      this.logger.info({ migration: file }, `applying migration`);
      await this.db.withTransaction(async (client) => {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)",
          [file, sum],
        );
      });
      result.applied.push(file);
    }

    this.logger.info(
      { applied: result.applied.length, total: files.length },
      "migrations complete",
    );
    return result;
  }

  /** Report applied vs pending migrations without changing anything. */
  async status(): Promise<{ name: string; applied: boolean }[]> {
    const files = await this.listMigrationFiles();
    const applied = await this.appliedMap();
    return files.map((name) => ({ name, applied: applied.has(name) }));
  }
}
