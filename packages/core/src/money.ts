import { type Result, ok, err, ValidationError } from "@tradescore/shared";

/**
 * Money value object.
 *
 * Amounts are stored as integer **minor units** (kobo for NGN) to avoid floating
 * point error — non-negotiable for a system that will later inform credit
 * decisions. Trade values (Stage 3) use this type. Defined now in core so the
 * monetary contract is fixed before any money-bearing table exists.
 */
export class Money {
  private constructor(
    /** Amount in minor units (e.g. kobo). Always an integer. */
    readonly minorUnits: number,
    readonly currency: string,
  ) {}

  static of(minorUnits: number, currency = "NGN"): Result<Money, ValidationError> {
    if (!Number.isInteger(minorUnits)) {
      return err(new ValidationError("Money amount must be an integer in minor units"));
    }
    if (minorUnits < 0) {
      return err(new ValidationError("Money amount cannot be negative"));
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      return err(new ValidationError("Currency must be a 3-letter ISO code"));
    }
    return ok(new Money(minorUnits, currency));
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  /** Major-unit representation for display (e.g. 150000 kobo -> 1500.00). */
  toMajorUnits(): number {
    return this.minorUnits / 100;
  }

  equals(other: Money): boolean {
    return this.minorUnits === other.minorUnits && this.currency === other.currency;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}
