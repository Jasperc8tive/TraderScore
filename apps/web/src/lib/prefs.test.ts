import { describe, expect, it } from "vitest";
import { parseLowBandwidth, pageSizeFor } from "./prefs";

describe("preferences", () => {
  it("parses the low-bandwidth cookie", () => {
    expect(parseLowBandwidth("1")).toBe(true);
    expect(parseLowBandwidth("0")).toBe(false);
    expect(parseLowBandwidth(undefined)).toBe(false);
  });

  it("returns a smaller page size in low-bandwidth mode", () => {
    expect(pageSizeFor(true)).toBeLessThan(pageSizeFor(false));
  });
});
