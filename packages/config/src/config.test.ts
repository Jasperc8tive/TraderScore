import { describe, expect, it } from "vitest";
import { loadConfig } from "./config";
import { parseEnv } from "./env";

const base = {
  NODE_ENV: "test",
  JWT_ACCESS_SECRET: "a".repeat(32),
  JWT_REFRESH_SECRET: "b".repeat(32),
} as NodeJS.ProcessEnv;

describe("config", () => {
  it("applies defaults and groups config", () => {
    const cfg = loadConfig(base);
    expect(cfg.api.port).toBe(4000);
    expect(cfg.isTest).toBe(true);
    expect(cfg.api.corsOrigins).toEqual(["http://localhost:3000"]);
  });

  it("builds a database url from discrete vars", () => {
    const cfg = loadConfig({ ...base, POSTGRES_HOST: "db", POSTGRES_DB: "ts" });
    expect(cfg.database.url).toContain("@db:5432/ts");
  });

  it("rejects short jwt secrets", () => {
    expect(() => parseEnv({ ...base, JWT_ACCESS_SECRET: "short" })).toThrow(
      /Invalid environment/,
    );
  });
});
