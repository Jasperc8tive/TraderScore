import { describe, expect, it } from "vitest";
import { resolveFlags, parseEnvFlag, DEFAULT_FLAGS } from "./feature-flags";

describe("feature flags", () => {
  it("returns defaults with no env overrides", () => {
    const flags = resolveFlags({});
    expect(flags.DISPUTES_ENABLED).toBe(true);
    expect(Object.keys(flags)).toEqual(Object.keys(DEFAULT_FLAGS));
  });

  it("applies FEATURE_<KEY> overrides", () => {
    const flags = resolveFlags({ FEATURE_DISPUTES_ENABLED: "false", FEATURE_PREMIUM_BADGES: "1" });
    expect(flags.DISPUTES_ENABLED).toBe(false);
    expect(flags.PREMIUM_BADGES).toBe(true);
  });

  it("ignores malformed/unknown env values", () => {
    const flags = resolveFlags({ FEATURE_DISPUTES_ENABLED: "maybe", FEATURE_UNKNOWN: "true" });
    expect(flags.DISPUTES_ENABLED).toBe(true); // falls through to default
    expect("UNKNOWN" in flags).toBe(false);
  });

  it("parses env flag values", () => {
    expect(parseEnvFlag("true")).toBe(true);
    expect(parseEnvFlag("0")).toBe(false);
    expect(parseEnvFlag(undefined)).toBeUndefined();
  });
});
