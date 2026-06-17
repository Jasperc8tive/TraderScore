import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Logger } from "@tradescore/logging";
import { Migrator } from "./migrator";
import type { Database } from "./pool";

const silentLogger = { info: () => {}, error: () => {}, debug: () => {} } as unknown as Logger;

// A fake Database that reports no migrations applied yet.
const fakeDb = {
  query: async () => ({ rows: [] }),
} as unknown as Database;

const migrationsDir = join(__dirname, "..", "migrations");

describe("Migrator.status", () => {
  it("lists all migration files as pending when ledger is empty", async () => {
    const migrator = new Migrator(fakeDb, migrationsDir, silentLogger);
    const status = await migrator.status();

    const names = status.map((s) => s.name);
    expect(names).toContain("0001_extensions_and_helpers.sql");
    expect(names).toContain("0004_businesses.sql");
    expect(status.every((s) => s.applied === false)).toBe(true);
    // Files must be returned in lexical (apply) order.
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
