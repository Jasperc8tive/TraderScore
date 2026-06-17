import { Injectable } from "@nestjs/common";
import { resolveFlags } from "./feature-flags";

/**
 * Effective feature flags = code defaults overridden by `FEATURE_<KEY>` env vars.
 * Read from the process environment so flags can be flipped per deployment without
 * a code change.
 */
@Injectable()
export class FeatureFlagsService {
  getFlags(): Record<string, boolean> {
    return resolveFlags(process.env);
  }

  isEnabled(key: string): boolean {
    return this.getFlags()[key] ?? false;
  }
}
