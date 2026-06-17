import { type Result, ok, err, ValidationError } from "@tradescore/shared";

/**
 * Phone normalization to E.164.
 *
 * Phone is the primary identity for the trader audience, so normalization must be
 * deterministic: "0801 234 5678", "+2348012345678", and "2348012345678" must all
 * collapse to one canonical value, otherwise the unique-phone guarantee (and
 * Sybil defenses keyed on phone) leak. Defaults to Nigeria (+234); the default
 * country is a parameter so the same code serves other African markets later.
 */
const DEFAULT_COUNTRY_CODE = "234";

export function normalizePhone(
  raw: string,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE,
): Result<string, ValidationError> {
  const trimmed = raw.trim();
  // Keep only digits and a single leading '+'.
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  if (digits.length === 0) {
    return err(new ValidationError("Phone number is empty"));
  }

  if (!hasPlus) {
    // Local format starting with a trunk '0' (e.g. 0801...) → national number.
    if (digits.startsWith("0")) {
      digits = defaultCountryCode + digits.slice(1);
    } else if (!digits.startsWith(defaultCountryCode)) {
      // Bare national number without trunk prefix.
      digits = defaultCountryCode + digits;
    }
  }

  // E.164 allows up to 15 digits; require a sane minimum.
  if (digits.length < 10 || digits.length > 15) {
    return err(new ValidationError("Phone number has an invalid length", { digits: digits.length }));
  }

  return ok(`+${digits}`);
}

export function isValidPhone(raw: string, defaultCountryCode?: string): boolean {
  return normalizePhone(raw, defaultCountryCode).ok;
}
