# 0021: Share online room identity and message contracts

## Status

Accepted. This record refines ADR 0004's server-side room boundary; room
managers remain authoritative for lifecycle and game state.

## Context

Pong, tic-tac-toe, and Battle Tanks independently implemented the same room
code generation, opaque resume-token creation, passcode normalization, incoming
WebSocket parsing, session payload, and room-status payload. The copies had
already drifted in validation and field construction, making security-sensitive
identity behavior and client-facing message compatibility harder to review.

These common mechanics are transport and identity contracts, not game rules.
Moving them into shared modules must not give generic code authority over room
lifecycle, command validation, state simulation, result recording, or
viewer-specific redaction.

## Decision

Use `server/room-identity.js` for the common five-character room-code alphabet,
24-byte base64url room tokens, and whitespace-trimmed passcodes. Each room
manager continues to decide when identities are created, how passcodes are
validated, and when rooms or resume tokens expire.

Use `server/websocket-messages.js` to require incoming messages to be JSON
objects, send JSON only to open sockets, and construct the fields shared by
session and room-status messages. Socket handlers and game-specific room
managers retain message routing, membership checks, command validation,
authoritative state, and viewer-safe serialization. Game-specific fields remain
explicit options; in particular, Pong's existing `playerId` is not added to the
other games' session payloads.

Preserve the existing wire and identity formats during this consolidation:
readable five-character room codes, 32-character base64url tokens, trimmed
passcodes, the `Invalid message.` error for malformed input, and the established
session and room-status fields. Changes to these shared helpers are cross-game
compatibility changes and require regression coverage for every affected
consumer.

## Consequences

- Security-sensitive identity primitives and common payload shapes have one
  reviewable implementation.
- All online games reject non-object JSON messages consistently.
- Room managers remain the authoritative boundary described by ADR 0004 and do
  not move game policy into generic helpers.
- A shared-helper change can affect every online game, so compatibility tests
  and focused room-manager tests are required before changing these contracts.
