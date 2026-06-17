# =============================================================================
# TradeScore API image (NestJS) — multi-stage.
# Build context is the repository ROOT (see docker-compose.yml) so the whole
# pnpm workspace is available for dependency resolution.
# =============================================================================

FROM node:20-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

# ---- deps: install the full workspace once (cached across app builds) --------
FROM base AS deps
COPY . .
RUN pnpm install

# ---- dev: hot-reloading development server (used by docker-compose) ---------
# Source is bind-mounted at runtime; node_modules come from this image layer.
FROM deps AS dev
EXPOSE 4000
CMD ["pnpm", "--filter", "@tradescore/api", "dev"]

# ---- build: compile the API and its workspace dependencies ------------------
FROM deps AS build
RUN pnpm --filter @tradescore/api... build

# ---- prod: lean runtime image (future AWS target) ---------------------------
FROM base AS prod
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
