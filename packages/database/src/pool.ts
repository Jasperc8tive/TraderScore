import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import type { Logger } from "@tradescore/logging";

export interface DatabaseOptions {
  connectionString: string;
  ssl: boolean;
  poolMax: number;
  logger?: Logger;
}

/**
 * PostgreSQL connection management.
 *
 * A single pooled connection per process. All access is parameterized (no string
 * interpolation into SQL — OWASP A03 injection defense). `withTransaction` gives
 * call sites a safe transactional scope with automatic COMMIT/ROLLBACK, which the
 * append-only trust model relies on (a trade and its status event must commit
 * atomically).
 */
export class Database {
  readonly pool: Pool;
  private readonly logger?: Logger;

  constructor(options: DatabaseOptions) {
    this.pool = new Pool({
      connectionString: options.connectionString,
      max: options.poolMax,
      ssl: options.ssl ? { rejectUnauthorized: false } : false,
      application_name: "tradescore",
    });
    if (options.logger) this.logger = options.logger;

    this.pool.on("error", (err) => {
      this.logger?.error({ err }, "unexpected idle postgres client error");
    });
  }

  /** Run a parameterized query. */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: ReadonlyArray<unknown> = [],
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const result = await this.pool.query<T>(text, params as unknown[]);
    this.logger?.debug(
      { durationMs: Date.now() - start, rows: result.rowCount },
      "db query",
    );
    return result;
  }

  /** Execute `fn` inside a transaction; commits on success, rolls back on throw. */
  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /** Liveness probe used by the API health endpoint. */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
