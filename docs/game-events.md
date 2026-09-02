# Browser game events

## Purpose and boundary

`scripts/game-events.js` is the browser-side coordination boundary between game
controllers and optional presentation features. Controllers publish facts that
already happened; audio, visual effects, accessibility helpers, tutorials, and
future telemetry can observe those facts without being imported by game code.

The bus is deliberately small, synchronous, dependency-free, and in-memory. It
is not a command bus, durable event log, WebSocket protocol, or trust boundary.
Events must never decide mechanics or be accepted as proof of scores,
achievements, purchases, or authoritative online actions.

## Loading and API

Load the bus before `audio.js`, `arcade.js`, and the game controller:

```html
<script src="../scripts/game-events.js"></script>
<script src="../scripts/audio.js"></script>
<script src="../arcade.js"></script>
<script src="scripts/app.js"></script>
```

Producers call `emit(type, detail?, options?)`. Consumers call `on`, or `once`
when only the next occurrence matters. `on` returns an unsubscribe function and
also accepts an `AbortSignal`.

```js
ArcadeEvents.emit('tetris:lines-cleared', { count: 4, rows: [16, 17, 18, 19] });

const stop = ArcadeEvents.on('tetris:lines-cleared', event => {
    console.log(event.detail.count);
});
stop();
```

`on('*', listener)` observes every event and is intended for diagnostics and
generic presentation adapters. A failing listener is reported to the console
and cannot interrupt the producer or another listener.

## Event envelope

Every listener receives a shallow-frozen envelope:

| Field | Meaning |
|---|---|
| `version` | Envelope schema version, currently `1`. |
| `id` | Monotonic page-local sequence number. It is not durable or globally unique. |
| `type` | Lowercase namespace and fact name, such as `pong:paddle-hit`. |
| `game` | Normalized game id inferred from the page, or `null` on shared pages. |
| `source` | Producer category; defaults to `client`, while the shared shell uses `shell`. |
| `timestamp` | Page-local high-resolution time when available. |
| `detail` | Shallow-frozen event-specific facts. |

Event types must match `namespace:fact-name`. Use past-tense facts for completed
actions and state nouns for shared changes. Do not encode a consumer in the
name: prefer `pong:paddle-hit` over `audio:play-hit`.

## Shared lifecycle vocabulary

| Event | Required/typical detail | Meaning |
|---|---|---|
| `game:started` | `mode`, normalized `intensity`, `danger` | A fresh local or accepted online match began. |
| `game:progressed` | normalized `intensity`, `danger`; optional `progress` | Meaningful state changed during active play. High-frequency games may coalesce this. |
| `game:paused` | `paused` | The effective pause state changed or was synchronized. |
| `game:stopped` | `reason` | Play ended or returned to an idle/waiting state without producing a competitive result, such as entering an online lobby or using an auto-solver. |
| `game:completed` | `outcome`: `win`, `loss`, or `draw`; bounded summary facts | A newly observed match completed. Resume snapshots must not emit it. |
| `system:theme-changed` | theme and resolved color fields | Shared appearance changed. |
| `account:user-changed` | `user` | The shell established a signed-in user or anonymous state. |
| `achievement:unlocked` | server-returned achievement | A validated unlock entered the notification queue. |
| `score:top` | server-returned top-score comparison | A validated top score entered the notification queue. |
| `audio:preferences-changed` | mute, levels, availability, activation | Audio preference or lifecycle state changed. |

Game-specific events live under the normalized game id (`sudoku`,
`minesweeper`, `pong`, `tictactoe`, `battletanks`, or `tetris`).

| Game | Events and primary detail |
|---|---|
| Sudoku | `cell-selected` (`row`, `column`, `given`); `note-entered` (`number`, `present`); `entry-accepted`; `entry-rejected` (`mistakes`); `cell-erased`; `hint-used` (`number`, `remaining`). |
| Minesweeper | `cells-revealed` (`count`, summarized flood fill); `flag-changed` (`index`, `flagged`); `mine-triggered` (`index`, effect-strength `damage`). |
| Tic-tac-toe | `mark-placed` (`cell`, numeric `side`). |
| Pong | `served` (`angle` when local); `wall-hit` (`speed`); `paddle-hit` (`side`, `speed`); `point-scored` (`side` when local, copied `score`); `power-up-spawned`; `power-up-activated` (`type`, `side`). |
| Battle Tanks | `power-up-acquired` (bounded acquisition presentation fields); `impact-resolved` (`damage`, `serial`); `shot-fired` (`weapon`, `side`); `tank-moved` (`action`); `control-adjusted` (`action`). |
| Tetris | `power-up-presented`; `power-up-activated`; `blocks-destroyed` (`count`, `points`, effect-strength `damage`); `stack-compacted` (`count`); `lines-cleared` (`count`, copied `rows`); `local-record-broken`; `piece-locked` (`pieces`); `piece-manipulated` (`action`). |

The table records the stable public meaning, not every optional field. New event
types must be added here when they are intended for consumers beyond one
feature. Additive bounded fields are compatible; consumers must tolerate fields
they do not use.

## Producer rules

1. Emit only after the action was accepted or the transition was observed.
2. Include facts, identifiers, and bounded measurements—not DOM nodes, mutable
   game state, functions, secrets, resume tokens, or desired presentation.
3. Keep mechanics independent. A listener return value must never affect the
   game decision that caused the event.
4. Summarize bursts. Minesweeper emits one reveal event for a flood fill rather
   than an event for every cell; held controls may be throttled.
5. Establish online watermarks from a resume snapshot without emitting historic
   events. Emit only later transitions or new monotonic server event ids.
6. Treat detail as immutable. The bus shallow-freezes it; producers should copy
   nested arrays or objects that could otherwise change later.

## Consumer rules

Consumers must be optional and failure-isolated. They may update presentation,
schedule work, or maintain disposable client state, but they must not mutate the
mechanics object or assume events can be replayed. Store and invoke the returned
unsubscribe function when a consumer has a shorter lifetime than the page.

Audio is the first complete adapter: it maps domain facts to synthesized cues,
music scenes, and pause state. The shared shell also uses the bus for appearance,
account, achievement, top-score, and audio-control notifications.

## Achievements and other trusted features

Browser events can coordinate an achievement animation or refresh, but cannot
award progress. Existing achievements remain derived from server-normalized
result facts in `server/accounts.js` and `server/achievements.js`. If future
achievements need mid-match facts, the authoritative mechanics or room manager
must produce and validate those facts server-side before persistence. A similarly
named browser event may mirror the transition for presentation only.

Result submission remains a direct async request through `Arcade.record` because
the caller needs a success/failure result and the server response contains the
validated score and unlocks. Turning that request into a fire-and-forget browser
event would hide errors and weaken the trust boundary.

## Testing and evolution

Unit-test event ordering, `once`, unsubscribe, wildcard observation, listener
failure isolation, payload validation, and page-local metadata. Integration tests
should assert that game controllers publish facts without importing presentation
consumers. When changing an established payload incompatibly, introduce a new
event type or increment the envelope version and update every consumer together.
The bus intentionally keeps no history; features that need replay or persistence
require a separate, explicitly designed store.
