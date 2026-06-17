import { describe, expect, it } from "vitest";
import { ok, err, isOk, isErr, unwrap } from "./result";

describe("Result", () => {
  it("constructs and narrows Ok", () => {
    const r = ok(42);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it("constructs and narrows Err", () => {
    const r = err(new Error("boom"));
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.message).toBe("boom");
  });

  it("unwraps Ok and throws on Err", () => {
    expect(unwrap(ok("x"))).toBe("x");
    expect(() => unwrap(err(new Error("nope")))).toThrow("nope");
  });
});
