import { describe, expect, it } from "vitest";
import { AssuranceLevel } from "@tradescore/shared";
import { verificationBadge, parseSort, sortToOrderBy } from "./discovery-helpers";

describe("verificationBadge", () => {
  it("marks verified levels and labels them", () => {
    expect(verificationBadge(AssuranceLevel.FULLY_VERIFIED)).toMatchObject({
      verified: true,
      label: "Fully Verified",
    });
    expect(verificationBadge(AssuranceLevel.PHONE_VERIFIED).verified).toBe(true);
    expect(verificationBadge(AssuranceLevel.UNVERIFIED).verified).toBe(false);
  });
});

describe("parseSort / sortToOrderBy", () => {
  it("defaults to score and whitelists input", () => {
    expect(parseSort(undefined)).toBe("score");
    expect(parseSort("name")).toBe("name");
    expect(parseSort("; DROP TABLE businesses;--")).toBe("score");
  });

  it("produces safe ORDER BY clauses", () => {
    expect(sortToOrderBy("score")).toContain("s.score DESC");
    expect(sortToOrderBy("name")).toBe("b.name ASC");
  });
});
