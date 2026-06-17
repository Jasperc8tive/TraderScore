/**
 * Slug generation for URL-safe, human-readable identifiers (businesses, markets).
 * Deterministic and idempotent: slugify(slugify(x)) === slugify(x).
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "") // strip combining diacritical marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-") // non-alphanumerics -> single hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
}

/** Append a short suffix to disambiguate a slug collision. */
export function slugWithSuffix(input: string, suffix: string): string {
  const base = slugify(input);
  const safeSuffix = slugify(suffix);
  return safeSuffix ? `${base}-${safeSuffix}` : base;
}
