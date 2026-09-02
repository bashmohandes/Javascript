# 0022: Share deterministic Tic-tac-toe mechanics

## Status

Accepted. This record refines ADR 0004 for Tic-tac-toe without moving online
authority into the browser.

## Context

The Tic-tac-toe browser controller and room manager each carried their own copy
of the eight winning lines and terminal-state logic. The browser also embedded a
mutable minimax implementation that temporarily wrote trial marks into the live
board. Rule fixes could therefore drift between solo, local, and authoritative
online play, and AI behavior was difficult to test without loading the DOM
controller.

The arcade remains build-free, so a shared mechanics boundary must work as a
plain browser global and as a CommonJS module on the server. Online clients must
still send only cell intent; the room manager must remain responsible for turn,
membership, lifecycle, and result validation.

## Decision

Use `tictactoe/scripts/game.js` as the deterministic mechanics core. It owns the
board shape, marks, winning lines, terminal evaluation, legal transitions,
available moves, and deterministic minimax selection. Transitions return a new
board and never mutate their input.

The browser controller owns difficulty and randomness policy, presentation,
input, audio-domain events, and local result submission. Easy and some medium
moves select randomly from the core's legal moves; hard decisions use its
deterministic minimax result.

The server room manager owns room identity, readiness, turn authorization,
reconnects, rematches, colors, authoritative result recording, and broadcast
state. After those checks, it applies moves through the same mechanics core and
uses the returned terminal state.

The module uses the repository's build-free UMD pattern: `TicTacToeGame` in the
browser and `require('../tictactoe/scripts/game')` on the server. It contains no
DOM, transport, storage, account, or presentation behavior.

## Consequences

- Solo, local, and online play share one definition of legal moves, wins, and
  draws.
- Minimax can be tested directly and cannot leak temporary marks into live state.
- The browser still cannot author online outcomes; only the room manager accepts
  intent and advances authoritative state.
- Mechanics changes affect every mode and require direct core tests plus focused
  room and browser verification.
