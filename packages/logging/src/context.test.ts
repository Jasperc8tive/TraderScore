import { describe, expect, it } from "vitest";
import { runWithContext, getContext, setActor } from "./context";

describe("request context", () => {
  it("propagates context within the run scope", () => {
    runWithContext({ requestId: "req-1" }, () => {
      expect(getContext()?.requestId).toBe("req-1");
      setActor("user-1", "ADMIN");
      expect(getContext()?.userId).toBe("user-1");
      expect(getContext()?.role).toBe("ADMIN");
    });
  });

  it("returns undefined outside any scope", () => {
    expect(getContext()).toBeUndefined();
  });
});
