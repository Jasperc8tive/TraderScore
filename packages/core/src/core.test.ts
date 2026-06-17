import { describe, expect, it } from "vitest";
import { normalizePhone, isValidPhone } from "./phone";
import { slugify, slugWithSuffix } from "./slug";
import { Money } from "./money";

describe("normalizePhone", () => {
  it("normalizes Nigerian local and international formats to one canonical E.164", () => {
    const a = normalizePhone("0801 234 5678");
    const b = normalizePhone("+2348012345678");
    const c = normalizePhone("2348012345678");
    expect(a.ok && a.value).toBe("+2348012345678");
    expect(b.ok && b.value).toBe("+2348012345678");
    expect(c.ok && c.value).toBe("+2348012345678");
  });

  it("rejects empty and absurd lengths", () => {
    expect(isValidPhone("")).toBe(false);
    expect(isValidPhone("123")).toBe(false);
  });
});

describe("slugify", () => {
  it("produces url-safe, idempotent slugs", () => {
    expect(slugify("Adigun Electronics!!")).toBe("adigun-electronics");
    expect(slugify(slugify("Adigun  Electronics"))).toBe("adigun-electronics");
    expect(slugWithSuffix("Computer Village", "Ikeja")).toBe("computer-village-ikeja");
  });
});

describe("Money", () => {
  it("constructs valid money and rejects invalid", () => {
    const m = Money.of(150000, "NGN");
    expect(m.ok && m.value.toMajorUnits()).toBe(1500);
    expect(Money.of(1.5).ok).toBe(false);
    expect(Money.of(-1).ok).toBe(false);
    expect(Money.of(100, "ngn").ok).toBe(false);
  });

  it("adds same-currency amounts", () => {
    const a = Money.of(100);
    const b = Money.of(250);
    if (a.ok && b.ok) {
      expect(a.value.add(b.value).minorUnits).toBe(350);
    }
  });
});
