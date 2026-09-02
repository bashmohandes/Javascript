# 0024: Isolate Pong online client lifecycle

## Status

Accepted. ADR number 0023 is reserved by the concurrent Sudoku mechanics change.

## Context

The Pong browser controller mixed canvas rendering and local simulation with
WebSocket creation, opaque resume-token storage, sequence rejection, reconnect
timers, coalesced pointer input, and socket replacement. The authoritative room
manager remained correct, but browser lifecycle changes required reasoning about
the entire canvas controller and could not be tested without a live DOM and
WebSocket server.

The shared online-room contract already validates messages and stored sessions.
Pong still needs game-specific message presentation and must not move online
simulation or result authority into the browser.

## Decision

Use `pong/scripts/online-client.js` as the Pong WebSocket lifecycle adapter. It
owns the active-socket identity, connect/send/leave behavior, opaque room resume
credentials, reconnect timer, coalesced pointer sender, and monotonically
increasing snapshot sequence within a room. Starting a non-resume connection
resets the sequence watermark so a new room cannot inherit the previous room's
higher sequence number.

The adapter consumes `scripts/online-rooms.js` for shared message parsing and
input coalescing. Browser dependencies and presentation callbacks are injected,
which permits direct tests with fake sockets, storage, and timers. The Pong app
continues to own room controls, status and overlay text, snapshot rendering,
audio-domain events, invitation URLs, and result display. The server remains the
only authority for online physics and results under ADRs 0004 and 0016.

The module follows the build-free UMD pattern: `PongOnlineClient` in the browser
and CommonJS exports in Node.

## Consequences

- Socket replacement, reconnect, storage cleanup, stale-snapshot rejection, and
  new-room sequence reset have deterministic regression coverage.
- Canvas and local-game changes no longer need to modify WebSocket lifecycle
  code in the same controller.
- The adapter remains Pong-specific; shared room input and message shapes stay
  in `scripts/online-rooms.js` rather than growing another generic abstraction.
- Online snapshots and result receipts still originate from the authoritative
  server and are only presented by the browser.
