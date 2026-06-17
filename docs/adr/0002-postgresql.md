# ADR-0002: PostgreSQL as the only datastore

- **Status:** Accepted
- **Date:** Stage 1
- **Deciders:** Principal Database Architect, Principal Fintech Systems Architect

## Context

TradeScore's core asset is a trustworthy, auditable reputation graph built from
immutable trade events (see Trust Architecture Review). The data is highly
relational (businesses ↔ trades ↔ confirmations ↔ relationships), requires strong
integrity guarantees and transactions, and will be queried with ad-hoc
aggregates and graph-shaped traversals (counterparty diversity, circular-trade
detection). It will also inform credit decisions, so correctness is paramount.

## Decision

Use **PostgreSQL exclusively**. No MongoDB, no Firebase. We exploit Postgres
features deliberately: transactional integrity for the append-only event model,
`CHECK` constraints mirroring our TypeScript enums, partial unique indexes for
soft-delete-aware uniqueness, JSONB for forward-compatible score metadata
(Trust Architecture Review §4.4), and (later) recursive CTEs / `pg_trgm` for graph
and search workloads.

## Alternatives considered

- **MongoDB:** rejected — weak relational integrity, awkward multi-entity
  transactions, and our access patterns are relational, not document-shaped.
- **Firebase:** rejected — vendor lock-in, limited ad-hoc querying, poor fit for
  auditable financial-adjacent data and self-hosting.
- **Postgres + a graph DB:** premature; recursive CTEs handle our graph needs at
  expected scale without a second datastore to operate and keep consistent.

## Consequences

- (+) One datastore to operate, back up, and reason about.
- (+) Strong integrity + transactions underpin the append-only trust model.
- (+) JSONB gives schema flexibility exactly where scoring needs it, without
  abandoning relational guarantees elsewhere.
- (−) Graph-heavy fraud queries will need careful indexing/optimization at scale
  (revisited in Stage 9 and the final load test).
