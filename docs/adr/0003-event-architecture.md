# ADR-0003: Event-driven core

- **Status:** Accepted
- **Date:** Stage 1
- **Deciders:** Principal Architect, Principal Fraud Prevention Engineer

## Context

Fraud detection and reputation scoring are first-class, evolving subsystems
(Trust Architecture Review §2–§4). They must react to identity and trade changes
without the identity/trade code knowing they exist, and a failure in scoring or
fraud must never roll back a legitimate business action. We also need to keep the
door open to swapping the transport for a durable/distributed one on AWS.

## Decision

Introduce a transport-agnostic **EventBus** interface plus a typed event
catalogue (`@tradescore/events`). Publishers emit typed domain events
(`user.created`, `business.created`, `business.verified`, and later
`trade.confirmed`, ...). Subscribers are decoupled, isolated (one failing handler
cannot break the publisher or peers), and expected to be idempotent. Stage 1
ships an in-memory implementation; a Redis Streams / SNS-SQS implementation can
replace it without touching publishers or subscribers.

## Alternatives considered

- **Direct service calls:** rejected — couples identity/trade code to scoring and
  fraud, and makes failures propagate across concerns.
- **Immediate external broker (Kafka/SQS) in Stage 1:** rejected as premature —
  unnecessary operational weight before product validation; the interface keeps
  the upgrade path open.

## Consequences

- (+) Fraud (Stage 9) and scoring (Stage 5) become additive subscribers, not
  rewrites — the key forward-compatibility win.
- (+) Subscriber isolation protects core transactions.
- (−) In-memory events are not durable across process restarts; acceptable for
  Stage 1, explicitly revisited when the durable transport lands.
- (−) Idempotency becomes a subscriber responsibility (documented in the contract).
