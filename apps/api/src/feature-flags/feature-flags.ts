/**
 * Runtime feature flags. Code defaults, overridable per environment via
 * `FEATURE_<KEY>=true|false`. Pure + testable; the service layer can additionally
 * merge per-plan entitlement flags.
 */
export const DEFAULT_FLAGS: Record<string, boolean> = {
  DISPUTES_ENABLED: true,
  REFERRALS_ENABLED: true,
  FRAUD_SCAN_ENABLED: true,
  PREMIUM_BADGES: true,
  SUBSCRIPTIONS_ENABLED: true,
};

export function parseEnvFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

/**
 * Resolve effective flags: defaults overridden by `FEATURE_<KEY>` env values.
 * Unknown env vars are ignored; malformed values fall through to the default.
 */
export function resolveFlags(
  env: Record<string, string | undefined>,
  defaults: Record<string, boolean> = DEFAULT_FLAGS,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const [key, def] of Object.entries(defaults)) {
    const override = parseEnvFlag(env[`FEATURE_${key}`]);
    result[key] = override ?? def;
  }
  return result;
}
