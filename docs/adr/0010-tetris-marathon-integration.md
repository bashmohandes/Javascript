# ADR 0010: Build-free Tetris marathon with scoped themes and validated results

## Status

Accepted

## Context

Tetris joins the arcade as a modern single-player game. It must work on the
static-hosted site without a build step while also participating in accounts,
leaderboards, player history, top-score notifications, result sharing, and
catalog-driven achievements when served by the Node process.

The shared appearance system requires game code to remain independent of named
experience themes. Tetris also needs deterministic, directly testable mechanics
without tying piece movement or scoring to DOM rendering. Because the initial
mode is an endless local marathon, the browser owns gameplay and a run ends on
top-out rather than producing a win or loss.

## Decision

1. Tetris ships as an endless single-player marathon with a 10×20 visible board,
   hidden spawn rows, seven-bag generation, five-piece preview, hold, ghost
   piece, SRS rotation and wall kicks, level-based gravity, and bounded lock
   delay resets.
2. A build-free mechanics module owns board state, randomization, collision,
   rotation, locking, line clearing, counters, and scoring. The browser
   controller owns DOM rendering, input, timing, accessibility, and sharing.
3. Completed top-outs are recorded as played sessions with `won: false`.
   Restarts, abandoned games, and unfinished page sessions are not persisted.
4. The result payload contains bounded aggregate facts: duration, lines, level,
   locked pieces, clear counts, and soft/hard-drop distances. The server rejects
   inconsistent aggregates and derives the stored score; it does not accept a
   client-authored score.
5. Tetris uses the existing result flow for history, leaderboard ranking,
   top-score detection, and achievement evaluation. Profile totals replace the
   meaningless wins metric with cumulative cleared lines.
6. Achievements are evaluated only from normalized recorded results. The
   initial catalog covers the first completed run, a four-line clear, level 10,
   and five completed runs.
7. Experience-owned rendering values are exposed through a scoped
   `.game-tetris` `--tetris-*` custom-property interface in the shared theme
   stylesheet. DOM rendering consumes the cascade directly. The share-image
   adapter reads the same properties with `getComputedStyle` and refreshes on
   `arcade:theme`.
8. Tetris JavaScript must not inspect theme attributes, branch on registered
   theme names, or embed experience palettes. A new theme supports Tetris by
   implementing the existing token interface.
9. At mobile widths, the board and information rail remain side by side in an
   approximately 70/30 split. Dynamic-viewport and safe-area constraints keep
   the board, score, high score, lines, level, hold, next queue, actions, and
   existing touch controls available together.
10. A line-clear mechanics event drives an intentionally prominent but
    non-blocking presentation layer. Its flash, recoil, streaks, sparks, and
    clear count scale with the number of lines; reduced-motion users receive a
    prominent static alternative. Presentation timers never delay mechanics.
11. The browser displays and updates the local high score throughout a run.
    Crossing the best score triggers an in-game announcement and persistent
    run-time highlight without pausing play or changing submitted result facts.

## Considered alternatives

* **Canvas-only gameplay.** Rejected because a DOM grid provides straightforward
  responsive styling and accessibility while keeping mechanics equally testable.
* **A finite 150-line win condition.** Rejected for the initial release in favor
  of familiar high-score marathon play; the profile explicitly treats runs as
  played sessions rather than losses.
* **Accept the displayed score from the browser.** Rejected because it would
  violate the arcade's server-derived scoring boundary.
* **Store every piece and movement event.** Rejected because histories would be
  unnecessarily large; bounded aggregates are sufficient for scores and the
  initial achievement catalog.
* **Put theme palettes in the Tetris controller.** Rejected because it couples
  mechanics and sharing to the current theme registry and makes new experiences
  require game-code changes.
* **Persist unfinished runs.** Rejected for the initial version to keep lifecycle
  and compatibility behavior small; only completed top-outs enter account data.

## Consequences

The mechanics core is fast to test and remains usable on static hosting. Signed-in
runs integrate with the same account surfaces and notification queue as other
games, and theme additions remain CSS-owned. Client-produced local aggregates
are plausibility-checked rather than authoritative, so a determined client can
still fabricate a local result; authoritative play would require moving the
simulation server-side.

The narrow layout deliberately gives the board most of the horizontal space
while preserving a compact information rail and the established touch-control
placement. Clear and record effects add presentation state to the controller,
but do not enter the mechanics or result schemas.

Scoring, result fields, achievement rules, and the database game constraint must
be changed together. Any future mode must define its completion semantics and
validation separately instead of overloading the marathon payload.

## Invariants

* Gameplay and the server use the same documented scoring formula.
* Line counts equal the weighted sum of single, double, triple, and four-line
  clear counts.
* Level equals `floor(lines / 10) + 1`.
* Only top-outs are recorded, always with `won: false`.
* Top-score and achievement notifications use the shared sequential queue.
* Tetris rendering code does not select or identify an experience theme.
* Every experience theme exposes the complete scoped Tetris token contract.
* Mobile layout keeps live statistics and previews visible beside the board
  without removing the touch controls.
* Clear and record celebrations never pause or alter gameplay state.
* Reduced-motion preferences preserve visible feedback without large movement.
