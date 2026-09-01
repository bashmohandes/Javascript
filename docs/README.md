# Architecture documentation

Start with the [architecture map](architecture.md). Decisions are recorded in
[`adr/`](adr/README.md). Online animation details are covered in
[rendering smoothing and prediction](online-rendering.md).


## Battle Tanks

Battle Tanks covers a trajectory-planning solo CPU, seeded terrain, destructible
geometry, radial/self damage, pickups, timed effects, specialized weapons,
viewer-redacted invisibility, replay-safe acquisition cards, and bounded
achievement statistics. Read the
[authoritative simulation ADR](adr/0009-authoritative-battle-tanks-simulation.md),
[component and data-flow overview](architecture.md#battle-tanks-boundaries-and-flow),
[online rendering guidance](online-rendering.md#battle-tanks), and
[player-facing rules](battle-tanks.md).

The boundaries are the mechanics core (`battle-tanks/scripts/game.js`), solo
planner (`battle-tanks/scripts/ai.js`), room
server (`server/battle-tanks-rooms.js`), browser app
(`battle-tanks/scripts/app.js`), result validator (`server/accounts.js`), and
achievement evaluator (`server/achievements.js`). Primary coverage is in
`tests/battle-tanks.test.js`, `tests/battle-tanks-ai.test.js`,
`tests/battle-tanks-rooms.test.js`, `tests/battle-tanks-page.test.js`,
`tests/accounts.test.js`, and `tests/achievements.test.js`.

## Tetris

Tetris separates its seven-bag/SRS marathon mechanics from DOM presentation,
uses server-derived scores from bounded top-out facts, and keeps the board,
status rail, previews, and touch controls together on phone screens. Read the
[marathon ADR](adr/0010-tetris-marathon-integration.md),
[power-up ADR](adr/0011-tetris-random-power-ups.md),
[architecture overview](architecture.md), and
[player-facing gameplay and mobile-layout guide](tetris.md). Primary coverage
is in `tests/tetris.test.js`, `tests/accounts.test.js`, and
`tests/achievements.test.js`.
