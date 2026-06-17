# =============================================================================
# TradeScore Web image (Next.js 15) — multi-stage.
# Build context is the repository ROOT (see docker-compose.yml).
# =============================================================================

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---- deps -------------------------------------------------------------------
FROM base AS deps
COPY . .
RUN pnpm install

# ---- dev: hot-reloading Next dev server (used by docker-compose) ------------
FROM deps AS dev
EXPOSE 3000
CMD ["pnpm", "--filter", "@tradescore/web", "dev"]

# ---- build: produce the Next standalone output ------------------------------
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=true
RUN pnpm --filter @tradescore/web build

# ---- prod: minimal standalone runtime (future AWS target) -------------------
FROM base AS prod
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
