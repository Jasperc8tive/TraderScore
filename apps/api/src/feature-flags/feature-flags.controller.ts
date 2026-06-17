import { Controller, Get } from "@nestjs/common";
import { FeatureFlagsService } from "./feature-flags.service";
import { Public } from "../common/auth/auth.decorators";

/**
 * Effective feature flags for clients to gate UI. Public: flags drive rendering and
 * are not secrets.
 */
@Controller("feature-flags")
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Public()
  @Get()
  get(): { flags: Record<string, boolean> } {
    return { flags: this.flags.getFlags() };
  }
}
