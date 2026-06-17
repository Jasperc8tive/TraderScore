import { Module, type MiddlewareConsumer, type NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { InfrastructureModule } from "./infrastructure.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { BusinessesModule } from "./businesses/businesses.module";
import { MarketClustersModule } from "./market-clusters/market-clusters.module";
import { TradesModule } from "./trades/trades.module";
import { ConfirmationsModule } from "./confirmations/confirmations.module";
import { ReputationModule } from "./reputation/reputation.module";
import { DiscoveryModule } from "./discovery/discovery.module";
import { DisputesModule } from "./disputes/disputes.module";
import { AdminModule } from "./admin/admin.module";
import { FraudModule } from "./fraud/fraud.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { BillingModule } from "./billing/billing.module";
import { FeatureFlagsModule } from "./feature-flags/feature-flags.module";
import { RequestContextMiddleware } from "./common/request-context.middleware";
import { JwtAuthGuard } from "./common/auth/jwt-auth.guard";
import { PermissionsGuard } from "./common/auth/permissions.guard";

/**
 * Root module.
 *
 * Global guards run on every route: JwtAuthGuard authenticates (unless @Public),
 * then PermissionsGuard enforces RBAC (unless no @RequirePermissions). Resource
 * ownership is enforced in services. Feature modules slot in without changing the
 * foundation.
 */
@Module({
  imports: [
    InfrastructureModule,
    HealthModule,
    AuthModule,
    BusinessesModule,
    MarketClustersModule,
    TradesModule,
    ConfirmationsModule,
    ReputationModule,
    DiscoveryModule,
    DisputesModule,
    AdminModule,
    FraudModule,
    NotificationsModule,
    AnalyticsModule,
    BillingModule,
    FeatureFlagsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
