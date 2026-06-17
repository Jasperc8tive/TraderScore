# ADR-0001: Monorepo with pnpm + Turborepo

- **Status:** Accepted
- **Date:** Stage 1
- **Deciders:** Principal Architect

## Context

TradeScore has two deployables (a Next.js web app and a NestJS API) that share a
large amount of code: domain types, the trust/role model, error contracts, config
schemas, the event catalogue. The API contract must stay in lockstep with the web
client. We need cross-cutting changes (e.g. adding an event, changing an error
code) to be atomic and type-checked end to end.

## Decision

Use a single repository managed as a **pnpm workspace** with **Turborepo** for
task orchestration and caching. Shared code lives in `packages/*`; deployables
live in `apps/*`. Packages are consumed via `workspace:*` and built with
TypeScript project references.

## Alternatives considered

- **Polyrepo:** rejected — forces versioned internal packages and a publish step
  for every shared change; the web/api contract drifts easily.
- **npm/yarn workspaces:** workable, but pnpm's content-addressed store is faster
  and stricter about phantom dependencies (a real correctness benefit).
- **Nx:** more powerful than Turborepo but heavier; Turborepo's caching covers
  our needs with far less configuration.

## Consequences

- (+) Atomic cross-cutting changes; shared types guarantee web/api agreement.
- (+) Fast incremental builds/tests via Turborepo caching.
- (−) Docker builds must use the repo root as context (handled in our Dockerfiles).
- (−) Stricter dependency hygiene required (pnpm forbids phantom deps) — a net
  positive but an adjustment.
