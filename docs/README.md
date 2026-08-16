# Architecture documentation

Start with the [architecture map](architecture.md). Decisions are recorded in
[`adr/`](adr/README.md). Online animation details are covered in
[rendering smoothing and prediction](online-rendering.md).


## Battle Tanks

Battle Tanks covers seeded terrain, destructible geometry, radial/self damage,
pickups, timed effects, specialized weapons, viewer-redacted invisibility,
replay-safe acquisition cards, and bounded achievement statistics. Read the
[authoritative simulation ADR](adr/0009-authoritative-battle-tanks-simulation.md),
[component and data-flow overview](architecture.md#battle-tanks-boundaries-and-flow),
[online rendering guidance](online-rendering.md#battle-tanks), and
[player-facing rules](battle-tanks.md).

The boundaries are the mechanics core (`battle-tanks/scripts/game.js`), room
server (`server/battle-tanks-rooms.js`), browser app
(`battle-tanks/scripts/app.js`), result validator (`server/accounts.js`), and
achievement evaluator (`server/achievements.js`). Primary coverage is in
`tests/battle-tanks.test.js`, `tests/battle-tanks-rooms.test.js`,
`tests/battle-tanks-page.test.js`, `tests/accounts.test.js`, and
`tests/achievements.test.js`.
