# ADR 0028: Bound cloud-save request and storage resources

**Status:** Accepted

## Context

Per-request payload and per-game slot limits do not bound the work required to
assemble a heavily fragmented HTTP body or the aggregate storage consumed by
many registered accounts. Either path can deny service to unrelated arcade
features even though every individual save is valid.

## Decision

1. JSON request parsing rejects an oversized declared `Content-Length` before
   reading the body and counts the bytes in each incoming chunk exactly once.
2. Save creation and full-state replacement run in immediate SQLite
   transactions and calculate their payload delta before writing.
3. Each account has a 16 MiB save-payload budget and the service has a 512 MiB
   aggregate budget by default. `SAVE_MAX_BYTES_PER_USER` and
   `SAVE_MAX_TOTAL_BYTES` may lower or raise those limits for the deployed
   volume. A write that would cross either limit fails with
   `SAVE_STORAGE_FULL`; existing saves remain readable and deletable.
4. Budgets count UTF-8 state JSON and decoded screenshot bytes. The account
   default accommodates all thirty slots at their individual maxima, while the
   aggregate default provides a hard ceiling independent of registration rate.

## Consequences

Fragmented requests remain linear in body size, and concurrent writers cannot
race quota checks. Operators must size the aggregate limit below the persistent
volume's usable capacity and monitor rejected writes; reaching the global limit
preserves database availability but prevents new or larger saves until storage
is freed or the configured budget changes.
