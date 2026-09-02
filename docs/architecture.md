# Current architecture

The arcade is a build-free browser application plus one Node.js process. The
process serves the same files used by static hosting, exposes the account API,
and hosts optional online matches. Classic games are intentionally standalone.

## System topology

```mermaid
flowchart LR
  B[Browser] -->|HTTPS: pages, assets, REST| N[Node HTTP server]
  B <-->|WSS: online matches| N
  N --> S[(SQLite /app/data/arcade.sqlite)]
  N --> P[In-memory Pong rooms]
  N --> T[In-memory Tic-tac-toe rooms]
  N --> BT[In-memory Battle Tanks rooms]
  GH[Static host / GitHub Pages] -->|local and solo play only| B
  RP[HTTPS reverse proxy] --> N
```

```mermaid
flowchart TB
  subgraph Browser
    Pages[Home, profile, game pages]
    Arcade[arcade.js: account, appearance, results, achievements]
    Events[game-events.js: browser domain events]
    Shared[room UI, colors, sharing]
    Games[game-specific controllers and engines]
    Store[localStorage: preferences/best times\nsessionStorage: room resume tokens]
    Pages --> Arcade
    Pages --> Events
    Games --> Events --> Shared
    Arcade --> Games
    Games --> Store
  end
  subgraph Node_process[Node process]
    HTTP[HTTP routing + static files + security]
    Accounts[Accounts + result validation/scoring]
    Achievements[Achievement rules/progress]
    Rooms[Three room managers]
    Engines[Pong and Battle Tanks engines]
    DB[Migration runner]
    HTTP --> Accounts --> Achievements
    HTTP --> Rooms --> Engines
    Accounts --> DB
    Achievements --> DB
  end
  Arcade <-->|JSON REST| HTTP
  Games <-->|JSON WebSocket| Rooms
```

## Appearance system

`theme-init.js` applies appearance before first paint and publishes the shared
theme registry. Experience (`playful`, `cabinet`, or `calm`) is independent
from the `system`/`light`/`dark` color preference. `arcade.js` renders the
appearance dialog, persists changes, synchronizes tabs, and emits the
`system:theme-changed` domain event for DOM and canvas games. Shared component and layout
tokens live in `arcade.css` and `styles/modern-game.css`; homepage and profile
styles consume the same root attributes for their page-specific layouts.

The shared shell also owns the progressive-web-app install surface. It points
modern pages at the root arcade manifest, uses the browser's native install
prompt when offered, provides platform-specific manual steps on Apple and
Android browsers, and suppresses the hint when already installed. Its root
service worker uses network-first static caching while excluding APIs. See
[ADR 0012](adr/0012-shared-app-install-surface.md).

See [ADR 0008](adr/0008-experience-theming-system.md) for the decision and
extension constraints.

## Audio system

Modern game pages load `scripts/game-events.js` and then `scripts/audio.js`
before the shared shell. Game controllers publish gameplay facts and lifecycle
state without referencing audio. The audio adapter subscribes to those facts,
creates a Web Audio graph only after gameplay interaction, and synthesizes all
music and effects without media assets. `arcade.js` owns the persistent master
mute, discoverable sound presets, and independently persistent music/effects
levels. Experience themes select shared timbres;
individual game scripts never branch on theme names. Hidden pages and non-audio
dialogs suspend background music, and online clients deduplicate transition
events independently from authoritative state. See [ADR 0013](adr/0013-procedural-arcade-audio.md), the
[audio design](audio-design.md), the [player-facing audio guide](audio.md), and
[ADR 0015](adr/0015-audible-sound-mixer.md) for the audible mixer exception.

## Browser event system

`scripts/game-events.js` provides a synchronous, page-local semantic event bus
for optional browser features. Games publish accepted actions and lifecycle
facts; audio and shared shell features subscribe without entering the mechanics
boundary. The shell also publishes theme, account, validated achievement,
validated top-score, and audio-preference changes. Events are immutable
notifications, not commands or trusted records. Server-derived results,
achievement progress, and authoritative online rooms remain outside this bus.
See [ADR 0014](adr/0014-browser-domain-event-bus.md) and the
[extension guide and event contract](game-events.md).

## Games and components

| Game | Browser modes / components | Online authority | Platform integration |
|---|---|---|---|
| Sudoku | Modern controller with generated boards, notes, hints and solver; separate p5.js classic (`board`, `cell`, `builder`, `solver`, `sketch`) | None | Modern results, scores and achievements |
| Minesweeper | Modern controller plus tile/grid engine; separate p5.js classic (`sketch`, `tile`) | None | Modern results, browser best times, scores and achievements |
| Pong | Modern canvas controller + motion prediction; solo, couch duo, online; separate p5.js classic (`board`, `ball`, `sketch`) | Server engine at 60 Hz; snapshots at 30 Hz | Modern results, scores and achievements |
| Tic-tac-toe | Modern controller, minimax AI, couch duo and online | Room manager validates turns, cells and wins | Results, scores and achievements |
| Battle Tanks | Shared deterministic engine + canvas controller; solo CPU, local duo and online | Server validates commands and owns physics, damage, turns and online result recording | Results, scores and achievements |
| Tetris | Modern DOM controller plus testable seven-bag/SRS mechanics engine; endless solo marathon | None | Results, scores, history and achievements |

Tetris keeps mechanics independent from DOM presentation, submits bounded
top-out aggregates for server-derived scoring, and consumes a scoped theme-token
interface. At phone widths, the controller's board and status rail use an
approximately 70/30 viewport-aware layout while the touch controls remain
available. Line-clear and live-record celebrations are non-authoritative,
non-blocking presentation driven by mechanics events and local best-score state.
Random magic breakers and motion-assisted stack compaction are mechanics-owned,
use validated score facts, and retain keyboard and button fallbacks for sensor
access. See [ADR 0010](adr/0010-tetris-marathon-integration.md),
[ADR 0011](adr/0011-tetris-random-power-ups.md), and the
[player guide](tetris.md).

The coding-challenge folders (`leetcode/`, `codeforces/`, `codewars/`) are
independent scripts, not arcade games or runtime components.

```mermaid
flowchart LR
  Shared[Shared browser shell] --> SU[Sudoku modern]
  Shared --> MS[Minesweeper modern]
  Shared --> PO[Pong modern]
  Shared --> TT[Tic-tac-toe]
  Shared --> BT[Battle Tanks]
  Shared --> TE[Tetris]
  P5[p5.js CDN] --> SUC[Sudoku classic]
  P5 --> MSC[Minesweeper classic]
  P5 --> POC[Pong classic]
  PO --> WR[Pong room manager + engine]
  TT --> TR[Tic-tac-toe room manager]
  BT --> BR[Battle Tanks room manager + shared engine]
```

## Accounts, scores and achievements

```mermaid
sequenceDiagram
  participant G as Modern game
  participant A as arcade.js
  participant H as HTTP API
  participant AC as Accounts
  participant AH as Achievements
  participant DB as SQLite
  G->>A: record(game, won, details)
  A->>H: POST /api/results + session cookie
  H->>AC: record(userId, result)
  AC->>AC: validate fields and derive score
  AC->>DB: insert game_results
  AC->>AH: process(result event)
  AH->>DB: upsert achievement_progress
  AC-->>A: score, topScore, unlocked[]
  A-->>G: toast notifications
```

Registration/login uses scrypt passcode hashes. A random session token is sent
only in an HttpOnly, SameSite=Strict cookie; only its SHA-256 hash is stored.
Profile changes revoke existing sessions and rotate the current one. Public
leaderboards and achievement catalogs are readable without login; history,
result recording, and profile updates require a session. API inputs are bounded,
rate-limited, origin-checked, normalized, and scored by the server.

```mermaid
erDiagram
  USERS ||--o{ SESSIONS : has
  USERS ||--o{ GAME_RESULTS : records
  USERS ||--o{ ACHIEVEMENT_PROGRESS : earns
  USERS { integer id PK
    text gamertag UK
    text passcode_hash
  }
  SESSIONS { text token_hash PK
    integer user_id FK
    text expires_at
  }
  GAME_RESULTS { integer id PK
    integer user_id FK
    text game
    integer score
    integer won
    text details
  }
  ACHIEVEMENT_PROGRESS { integer user_id PK,FK
    text achievement_id PK
    integer progress
    text unlocked_at
  }
```

## Online gaming

```mermaid
sequenceDiagram
  participant C1 as Player 1
  participant API as Room-list REST API
  participant WS as Game WebSocket endpoint
  participant RM as In-memory room manager
  participant C2 as Player 2
  C1->>WS: create-room(public/private, passcode)
  WS->>RM: create
  WS-->>C1: room code + opaque resume token
  C2->>API: list public rooms
  API-->>C2: open public rooms
  C2->>WS: join-room(code, passcode?)
  WS->>RM: join
  WS-->>C2: side + opaque resume token
  C1->>WS: ready
  C2->>WS: ready
  loop match
    C1->>WS: input / move / aim / fire
    WS->>RM: validate and advance authoritative state
    RM-->>C1: state
    RM-->>C2: state
  end
  C2--xWS: disconnect
  C2->>WS: resume(code, token)
  WS-->>C1: peer reconnected
```

| Concern | Pong | Tic-tac-toe | Battle Tanks |
|---|---|---|---|
| Endpoint | `/ws` | `/ws/tictactoe` | `/ws/battle-tanks` |
| Client command | continuous paddle input | discrete cell move | versioned move/aim/fire command |
| State delivery | 30 Hz snapshots | after actions | 60 Hz physics; projectile snapshots capped at 25 Hz (typically about 20 Hz because the 40 ms throttle is sampled by a 60 Hz timer) |
| Result source | room manager records authenticated players | room manager records authenticated players | room manager records authenticated players |
| Shared lifecycle | public/private five-character rooms, ready, rematch, invitation, resume token, reconnection grace, inactivity expiry, heartbeat |

Rooms and resume tokens are ephemeral and vanish on expiry/restart. Account
sessions are separate from room identity: login adds a gamertag to a room, and
all room managers also associate the user id for trusted online result recording.
The public result API rejects browser submissions claiming an online mode; each
room persists its terminal state at most once per match.
See [online rendering](online-rendering.md) for snapshot smoothing, client-side
prediction, safeguards, and alternatives.

## Battle Tanks boundaries and flow

Battle Tanks uses one deterministic mechanics core with deliberately narrow adapters:

| Component | Responsibility |
|---|---|
| `battle-tanks/scripts/game.js` | Versioned match state, seeded generation, fixed-step mechanics, collision and deformation, registry-driven weapons and power-ups, obstacle-aware homing guidance, damage/effects, and bounded transition statistics. It contains no DOM, transport, or account trust decisions. |
| `battle-tanks/scripts/ai.js` | Deterministic browser-side movement and trajectory planning for the solo CPU. It repositions within shared movement bounds, evaluates legal shots from the new position, selects bounded grazes or near misses at a human-like rate, and never participates in online authority. |
| `server/battle-tanks-rooms.js` | Authoritative online command validation and orchestration, fixed-step ticking, room lifecycle, trusted result creation, and viewer-specific serialization/redaction. |
| `battle-tanks/scripts/app.js` | Canvas rendering, prominent projectile/impact feedback, local input/simulation, solo orchestration, bounded visual prediction, room commands, accessibility, controls, viewport-contained result/acquisition layers, and replay-safe presentation-event handling. Card dismissal remains browser-local; only online room/match watermarks persist across reconnects. |
| `server/accounts.js` | Result-schema trust boundary: rejects invalid modes, identifiers, bounds, and untrusted online submissions, then normalizes versioned result details. |
| `server/achievements.js` | Declarative evaluator for normalized result transitions and cumulative progress; it does not accept UI-authored claims. |

```mermaid
sequenceDiagram
  participant C as Browser app
  participant R as Battle Tanks room
  participant G as Mechanics core
  participant A as Accounts
  participant H as Achievements
  C->>R: bounded move / aim / power / select / use / fire command
  R->>R: validate room, side, phase, turn, ID and sequence
  loop fixed simulation steps
    R->>G: advance authoritative match
  end
  R->>R: serialize separately for each viewer
  R-->>C: redacted versioned snapshot + ordered acquisition events
  Note over R,C: concealed projectile remains omitted until crossing the disclosure boundary
  C--xR: disconnect
  C->>R: resume with opaque room token
  R-->>C: current snapshot and bounded replay-safe events
  G-->>R: completion and bounded per-player aggregates
  R->>A: trusted online result
  A->>A: validate and normalize result schema
  A->>H: normalized result event
  H->>H: evaluate per-match and cumulative rules
```

Reconnect sends current state, not a full event-history replay. The same core
runs solo and local matches in the browser, but only the room server is
authoritative for online state and statistics. Solo result aggregation excludes
CPU activity and assigns no player score to a CPU victory. See
[ADR 0009](adr/0009-authoritative-battle-tanks-simulation.md)
and the [player-facing rules](battle-tanks.md).

## Deployment and boundaries

```mermaid
flowchart LR
  Internet --> TLS[Reverse proxy: TLS + WebSocket upgrade]
  subgraph Container[Single unprivileged container]
    C[Node service on port 8080]
    Static[Static assets]
    API[REST API]
    WS[WebSocket server]
    Health[healthz endpoint]
    C --> Static
    C --> API
    C --> WS
    C --> Health
  end
  TLS --> C
  C --> V[(arcade-data volume)]
```

The server blocks private source/data paths, applies response security headers
and a resolved-asset-aware Content Security Policy,
checks HTTP/WebSocket origins, caps JSON and WebSocket payloads, and uses a
heartbeat. WebSocket admission also bounds connections, messages, lobby
actions, active rooms, and public listings before unauthenticated work can grow
without limit. Startup applies ordered SQL migrations transactionally. Graceful
shutdown closes sockets and SQLite. See the [decision index](adr/README.md) for
the trade-offs behind these boundaries.
