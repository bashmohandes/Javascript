# JavaScript Playground

A small collection of browser games and coding exercises, built for fun and
learning. The modern games share optional arcade accounts, persistent play
history, profiles, and leaderboards. No browser build step is required.

## Documentation

See the diagram-first [architecture overview](docs/architecture.md) for the game
topology and subsystem flows. Architectural decisions are indexed in
[the ADR directory](docs/adr/README.md), with a dedicated guide to
[online rendering smoothing and prediction](docs/online-rendering.md) and an
operator-focused [release process](docs/release-process.md).

## Games

| Game | About | Play |
| --- | --- | --- |
| **Sudoku** | The refreshed, responsive version with notes, hints, keyboard controls, and an animated backtracking solver. | [Play modern Sudoku](https://bashmohandes.github.io/Javascript/Sudoku/) |
| **Sudoku Classic** | The original p5.js experiment, preserved alongside the new game. | [Play Sudoku Classic](https://bashmohandes.github.io/Javascript/Sudoku/classic/) |
| **Minesweeper** | A responsive mine-clearing puzzle with three field sizes, flags, keyboard controls, and saved best times. | [Play modern Minesweeper](https://bashmohandes.github.io/Javascript/Minesweeper/) |
| **Minesweeper Classic** | The original p5.js experiment, preserved alongside the new game. | [Play Minesweeper Classic](https://bashmohandes.github.io/Javascript/Minesweeper/classic/) |
| **Pong** | Responsive solo, couch co-op, and public or private online multiplayer Pong. | [Play Pong](https://bashmohandes.github.io/Javascript/pong/) |
| **Battle Tanks** | Solo CPU, local, and authoritative online artillery duels across generated, destructible arenas with pickups, effects, and specialized weapons. | [Play Battle Tanks](https://bashmohandes.github.io/Javascript/battle-tanks/) |
| **Tetris** | An endless single-player marathon with seven-bag pieces, hold, ghost previews, progressive speed, scores, and achievements. | [Play Tetris](https://bashmohandes.github.io/Javascript/tetris/) |

## Battle Tanks controls and online play

Battle Tanks generates seeded hills, valleys, and variable barriers. Explosions
change terrain and deal distance- and weapon-based splash damage, including
self-damage. Collect pickups by driving over them, then use the inventory for
health packs, shields, temporary boosts, online-only invisibility, or ammunition
for wide-blast, heavy, homing, and reflected-laser weapons; the default shell is
unlimited. Acquisition cards are replay-safe notifications. Online reconnects
do not replay dismissed cards, while every fresh solo or local page run
announces newly acquired items. Winner and acquisition panels keep their
content and actions inside the viewport on short screens.

Use `A`/`D` or arrow keys to move, `W`/`S` or up/down to aim, `Q`/`E` or
minus/plus to change power, and Space to fire. Pointer and touch users can use
the on-screen controls and, during local play, drag the active tank. The weapon
selector and full-screen overlay expose weapon, fire, movement, aim, power, and
exit controls.

Solo, local, and online modes use the same deterministic mechanics core. The
solo CPU moves before each shot, evaluates trajectories in the browser, and
mixes credible hits with near misses while controlling Player 2. Solo scores use
only the human player's statistics, and a CPU victory produces no player score.
Online rooms are server-authoritative and redact invisible opponents and
concealed projectile origins; solo and local modes are browser-authoritative
and do not permit invisibility.
See the [complete Battle Tanks gameplay rules](docs/battle-tanks.md),
[architecture](docs/architecture.md#battle-tanks-boundaries-and-flow), and
[ADR 0009](docs/adr/0009-authoritative-battle-tanks-simulation.md).

## Tetris controls and mobile play

Tetris keeps the current score, high score, lines, level, hold, and next-piece
queue beside the board on mobile in an approximately 70/30 layout, with the
touch controls still visible below. Line clears use prominent flashes, recoil,
sparks, and a large clear count; breaking the standing high score is announced
and highlighted while the run continues. See the
[Tetris gameplay and responsive-layout guide](docs/tetris.md) and
[ADR 0010](docs/adr/0010-tetris-marathon-integration.md).

The repository also contains solutions and experiments from LeetCode,
Codeforces, and Codewars.

## Online Pong on a NAS

Online Pong uses a small authoritative Node.js WebSocket server. The server owns
the ball, paddles, power-ups, and score so both players always receive the same
match state. Public rooms appear in the in-game room browser, while private rooms
require a 4–32 character passcode. All rooms live in memory and disappear after
all players leave or the inactivity timeout expires.

### Docker Compose (recommended)

From the repository root:

```sh
docker compose up -d --build
```

Open `http://YOUR_NAS_IP:8080/pong/`, select **Online**, and join an available
public room or create a new one. A host can list a public room for anyone to join,
or create a passcode-protected private room and share its invitation link or
five-character code with a friend.
Set a different host port in a `.env` file if port 8080 is occupied:

```dotenv
JSPG_PORT=8090
```

Useful operations:

```sh
docker compose ps
docker compose logs -f js-playground
docker compose pull
docker compose up -d --build
docker compose down
```

The container exposes `GET /healthz` and runs as an unprivileged user. Online
Pong rooms remain ephemeral, while accounts and results are stored in SQLite.
Both Compose files mount the named `arcade-data` volume at `/app/data`, with the
database at `/app/data/arcade.sqlite`, so account data survives restarts and
deployments. Back up that volume as part of the NAS backup routine. To use a
bind mount, replace the volume source with a NAS directory such as
`/volume1/docker/javascript-playground:/app/data` and ensure the container user can
write to it.

Versioned migrations live in `server/migrations`. Unapplied `.sql` files run in
filename order inside a transaction at startup and are recorded in
`schema_migrations`. Add future changes as the next zero-padded migration rather
than editing a migration that has already shipped.

### Release and publish images with GitHub Actions

The [release-process guide](docs/release-process.md) is the source of truth for
the branch model, promotion diagram, release notes, retries, and separate stable
and alpha NAS deployments.

The `Test and publish alpha container` workflow tests the application and builds
the container for every pull request. Each successful push to `master` publishes
the movable `alpha` image and an immutable `sha-...` image to Docker Hub. Daily
scheduled runs rebuild and scan without publishing. Alpha is intended for early
testing; `latest` never follows `master` directly.

Stable releases come only from the protected `release` branch. Prepare the next
release on `master` by updating `package.json`, `package-lock.json`, and the
newest entry in `releases.json` to the same semantic version. After testing the
alpha image, merge a promotion pull request from `master` into `release`. In
**Actions → Publish stable release**, select the `release` branch and enter the
matching version without a `v` prefix. The workflow repeats every quality gate,
then publishes `latest`, the full version, the major/minor version, and the
release commit tag. It also creates the immutable `v...` Git tag and a GitHub
Release from the curated notes.

If a release fails after its immutable tag is created, rerun the stable workflow
from that matching `v...` tag with the same version. This remains safe even when
the `release` branch has advanced; a version tag pointing at any other commit is
rejected. A tag-based retry republishes only the immutable full-version and
commit tags and never moves `latest`, the major/minor tag, or GitHub's latest
release marker backward.

Published images support AMD64 and ARM64 NAS devices and include provenance and
an SBOM. The embedded version and release channel appear at the bottom of every
modern page. Stable release notes open once per version in each browser and can
always be reopened from that version button. Local Compose builds use the `dev`
channel by default; set both `BUILD_VERSION` and `BUILD_CHANNEL` only when
testing other build metadata.

The workflow's third-party actions and Node container base are pinned to
immutable revisions. Update those pins deliberately after reviewing upstream
release notes; the adjacent version comments identify the human-readable action
releases. Dependabot checks Actions, Docker, and npm every day and proposes
reviewable version and security updates without weakening those pins.
Every container build is also scanned for fixable high or critical
vulnerabilities with a digest-pinned Trivy image. A daily scheduled run repeats
the test, build, and scan against current vulnerability data without publishing
an image.

Set up Docker Hub once:

1. Create a public or private Docker Hub repository named `js-playground`.
2. In Docker Hub, create a personal access token with **Read & Write** access.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions**.
4. Add `DOCKERHUB_USERNAME` with your Docker Hub username.
5. Add `DOCKERHUB_TOKEN` with the access token—not your Docker Hub password.
6. Merge to `master` to publish alpha, or follow the stable promotion process
   above to publish `latest` and versioned images.

Create a `release` branch from `master` before the first promotion. Protect both
branches with required pull requests and CI, and block force pushes and branch
deletion. Protect `v*` tags against updates and deletion while allowing the
stable release workflow to create them. Urgent fixes still merge through
`master`, prove out on `alpha`, and use the same promotion path.

Pulls and deployments should use an immutable version tag where possible. On
the NAS, save the following as `.env` beside `compose.nas.yaml`:

```dotenv
JSPG_IMAGE=YOUR_DOCKERHUB_USERNAME/js-playground:1.0.0
JSPG_CONTAINER_NAME=javascript-playground
JSPG_PORT=8080
ALLOWED_ORIGINS=https://js-playground.tail01f640.ts.net
COOKIE_SECURE=true
TRUST_PROXY=true
WS_MAX_CONNECTIONS_PER_IP=20
ROOM_MAX_PER_IP=5
HTTP_BODY_MAX_IN_FLIGHT_BYTES=16777216
HTTP_BODY_MAX_IN_FLIGHT_BYTES_PER_IP=4194304
HTTP_BODY_TIMEOUT_MS=30000
SAVE_MAX_BYTES_PER_USER=16777216
SAVE_MAX_TOTAL_BYTES=536870912
```

The container defaults to `javascript-playground` when
`JSPG_CONTAINER_NAME` is omitted. To run stable and alpha deployments side by
side, give them distinct container names, ports, and Compose project names (for
example, `javascript-playground-stable` with `-p jspg-stable` and
`javascript-playground-alpha` with `-p jspg-alpha`). The different project
names keep their `arcade-data` volumes isolated.

`TRUST_PROXY=true` is appropriate when the container is reachable only through
the trusted NAS reverse proxy; it lets authentication throttling use the
proxy-adjacent forwarded client address and origin checks use the forwarded
protocol. Leave it false if clients can connect directly to the container port
and supply their own forwarding headers.

The production image always marks session cookies `Secure`; this cannot be
disabled with `COOKIE_SECURE=false`. The local Compose profile defaults to
`NODE_ENV=development` so authentication remains available over localhost HTTP.
Set `COOKIE_SECURE=true` to opt a non-production HTTPS environment into secure
cookies.

Authentication attempts are throttled by client address and gamertag, and
passcode hashing runs asynchronously so it does not block game simulation.
Scores are derived by the server from validated result fields rather than
accepted from the browser. Profile changes require the current passcode, revoke
all existing sessions, and rotate the active session cookie.

WebSockets default to 250 concurrent connections globally and 20 per client
address. Each socket may send 300 messages per ten seconds; each address may
create 10 rooms and attempt 60 joins per minute. Active rooms are capped at 200
globally, 100 per game, and 5 per address, while public room responses return at
most 50 entries. Override these with `WS_MAX_CONNECTIONS`,
`WS_MAX_CONNECTIONS_PER_IP`, `WS_MESSAGES_PER_10S`,
`WS_ROOM_CREATES_PER_MINUTE`, `WS_JOINS_PER_MINUTE`, `ROOM_MAX_TOTAL`,
`ROOM_MAX_PER_GAME`, `ROOM_MAX_PER_IP`, and `PUBLIC_ROOM_LIMIT`. Proxy-level
limits are still recommended for internet-facing deployments.

Cloud-save payloads default to 16 MiB per account and 512 MiB across the
service. Override `SAVE_MAX_BYTES_PER_USER` and `SAVE_MAX_TOTAL_BYTES` to fit
the persistent volume; keep the aggregate budget below its usable capacity.
Incoming JSON bodies also reserve at most 16 MiB service-wide and 4 MiB per
client address, with a 30-second deadline. The corresponding `HTTP_BODY_*`
variables tune those limits for the proxy and host capacity.

Then deploy or update without cloning the source repository:

```sh
docker compose -f compose.nas.yaml pull
docker compose -f compose.nas.yaml up -d
docker compose -f compose.nas.yaml ps
```

For a private Docker Hub repository, first run `docker login` on the NAS. Do not
create release tags manually; the stable workflow creates the tag only after
the image has passed validation and has been published.

### Reverse proxy and HTTPS

For play outside your LAN, put the container behind your NAS reverse proxy and
enable HTTPS. Forward normal HTTP traffic and WebSocket upgrades for `/ws` to
the same container and port. Most NAS proxy interfaces have an **Enable
WebSocket** option; otherwise ensure they forward the `Upgrade` and `Connection`
headers. Invitation links use the browser's current public host and automatically
choose `wss://` when the page is served over HTTPS.

Browser HTTP and WebSocket requests must use the site's own origin by default.
To permit additional trusted front-end origins, provide a comma-separated
allowlist in `.env`:

```dotenv
ALLOWED_ORIGINS=https://pong.example.com
RECONNECT_GRACE_MS=15000
ROOM_TIMEOUT_MS=1800000
COOKIE_SECURE=true
```

Do not publish the plain HTTP port directly to the internet. Use HTTPS/WSS and
your NAS firewall or access controls.

### Run without Docker

Node.js 22 or newer is required:

```sh
npm install
npm run audit
npm start
```

Then open <http://localhost:8080/pong/>. The original static preview still works
for solo and local two-player modes, but online rooms require the Node server.

## Preview changes before merging

### GitHub Codespaces

The included development container makes it possible to try a branch or pull
request without publishing it to the production GitHub Pages site:

1. Open the pull request on GitHub.
2. Select **Code → Codespaces → Create codespace on this branch**.
3. Wait for forwarded port **8080**, labeled **Game preview (online Pong)**, to open.
4. Open `/pong/` for Pong, `/Sudoku/` for modern Sudoku, or `/Minesweeper/`
   for modern Minesweeper. The original games remain in their `classic/` folders.

The development container installs dependencies once and starts the Node server
automatically. Do not also run `python3 -m http.server`: the static Python server
does not provide Pong's `/ws` WebSocket endpoint. If the codespace was created
before online Pong was added, run **Codespaces: Rebuild Container** from the
command palette so the new port and startup lifecycle are applied. The server
log is available at `/tmp/javascript-games-preview.log`.

### Local preview

From the repository root, start a static server:

```sh
python3 -m http.server 8000
```

Then open one of these URLs:

- Modern Sudoku: <http://localhost:8000/Sudoku/>
- Classic Sudoku: <http://localhost:8000/Sudoku/classic/>
- Modern Minesweeper: <http://localhost:8000/Minesweeper/>
- Classic Minesweeper: <http://localhost:8000/Minesweeper/classic/>

## Sudoku controls

- Select a square and use the on-screen number pad or keyboard keys `1`–`9`.
- Press `N` to toggle notes and use arrow keys to move around the board.
- Use **Hint** for a nudge or **Auto solve** to watch the backtracking solver.
- During auto-solve, select **Stop solve** to return to your board.

## Minesweeper controls

- Click or tap a tile to reveal it. The first tile and its neighbours are safe.
- Right-click or press and hold to place a flag; touch players can also enable
  **Flag mode**.
- Use the arrow keys to move, <kbd>Enter</kbd> to reveal, and <kbd>F</kbd> to flag.

## Battle Tanks controls and rules

Battle Tanks supports keyboard, pointer, touch, and full-screen controls. Its
seeded arenas, radial damage, destructible geometry, pickup inventory, timed
effects, ammunition, specialized weapons, draw behavior, and online hidden
information rules are defined in the
[Battle Tanks gameplay rules](docs/battle-tanks.md). Detailed constants live in
that player-facing source of truth rather than being duplicated here.

## License

See [LICENSE](LICENSE).
