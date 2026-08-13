# JavaScript Playground

A small collection of browser games and coding exercises, built for fun and
learning. The modern games share optional arcade accounts, persistent play
history, profiles, and leaderboards. No browser build step is required.

## Documentation

See the diagram-first [architecture overview](docs/architecture.md) for the game
topology and subsystem flows. Architectural decisions are indexed in
[the ADR directory](docs/adr/README.md), with a dedicated guide to
[online rendering smoothing and prediction](docs/online-rendering.md).

## Games

| Game | About | Play |
| --- | --- | --- |
| **Sudoku** | The refreshed, responsive version with notes, hints, keyboard controls, and an animated backtracking solver. | [Play modern Sudoku](https://bashmohandes.github.io/Javascript/Sudoku/) |
| **Sudoku Classic** | The original p5.js experiment, preserved alongside the new game. | [Play Sudoku Classic](https://bashmohandes.github.io/Javascript/Sudoku/classic/) |
| **Minesweeper** | A responsive mine-clearing puzzle with three field sizes, flags, keyboard controls, and saved best times. | [Play modern Minesweeper](https://bashmohandes.github.io/Javascript/Minesweeper/) |
| **Minesweeper Classic** | The original p5.js experiment, preserved alongside the new game. | [Play Minesweeper Classic](https://bashmohandes.github.io/Javascript/Minesweeper/classic/) |
| **Pong** | Responsive solo, couch co-op, and public or private online multiplayer Pong. | [Play Pong](https://bashmohandes.github.io/Javascript/pong/) |
| **Battle Tanks** | Turn-based local and authoritative online artillery duels with movement, aiming, and a central barrier. | [Play Battle Tanks](https://bashmohandes.github.io/Javascript/battle-tanks/) |

## Battle Tanks controls and online play

Use A/D to move, W/S to aim, Q/E to change power, and Space to fire. Tanks remain on their own side of the central barrier and alternate turns after each projectile resolves. Online matches use the same public/private room, invitation, ready, reconnection, and rematch flow as Pong and Tic-tac-toe. The Node server owns movement bounds, projectile physics, collisions, damage, turns, and results; a static GitHub Pages preview supports local play only.

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
PONG_PORT=8090
```

Useful operations:

```sh
docker compose ps
docker compose logs -f pong
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
`/volume1/docker/javascript-arcade:/app/data` and ensure the container user can
write to it.

Versioned migrations live in `server/migrations`. Unapplied `.sql` files run in
filename order inside a transaction at startup and are recorded in
`schema_migrations`. Add future changes as the next zero-padded migration rather
than editing a migration that has already shipped.

### Publish the image with GitHub Actions

The `Test and publish container` workflow tests the application and builds the
container for every pull request. Pushes to `main` or `master` publish `latest`
and immutable `sha-...` tags to Docker Hub. Tags such as `v1.2.3` additionally
publish `1.2.3` and `1.2`. Published images support both AMD64 and ARM64 NAS
devices and include provenance and an SBOM. The matching immutable tag (`sha-...`
for commits or the semantic version for releases) is embedded in the image and
shown at the bottom of every page. For a local build, set `BUILD_VERSION` before
running Docker Compose; the same value is used for both the image tag and the
displayed build version.

Set up Docker Hub once:

1. Create a public or private Docker Hub repository named `javascript-pong`.
2. In Docker Hub, create a personal access token with **Read & Write** access.
3. In the GitHub repository, open **Settings → Secrets and variables → Actions**.
4. Add `DOCKERHUB_USERNAME` with your Docker Hub username.
5. Add `DOCKERHUB_TOKEN` with the access token—not your Docker Hub password.
6. Open **Actions → Test and publish container → Run workflow**, or merge a
   change into the default branch.

Pulls and deployments should use an immutable version tag where possible. On
the NAS, save the following as `.env` beside `compose.nas.yaml`:

```dotenv
PONG_IMAGE=YOUR_DOCKERHUB_USERNAME/javascript-pong:1.0.0
PONG_PORT=8080
ALLOWED_ORIGINS=https://js-playground.tail01f640.ts.net
COOKIE_SECURE=true
TRUST_PROXY=true
```

`TRUST_PROXY=true` is appropriate when the container is reachable only through
the trusted NAS reverse proxy; it lets authentication throttling use the
proxy-adjacent forwarded client address and origin checks use the forwarded
protocol. Leave it false if clients can connect directly to the container port
and supply their own forwarding headers.

Authentication attempts are throttled by client address and gamertag, and
passcode hashing runs asynchronously so it does not block game simulation.
Scores are derived by the server from validated result fields rather than
accepted from the browser. Profile changes require the current passcode, revoke
all existing sessions, and rotate the active session cookie.

Then deploy or update without cloning the source repository:

```sh
docker compose -f compose.nas.yaml pull
docker compose -f compose.nas.yaml up -d
docker compose -f compose.nas.yaml ps
```

For a private Docker Hub repository, first run `docker login` on the NAS. To
publish a version, create and push a matching Git tag:

```sh
git tag v1.0.0
git push origin v1.0.0
```

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

- Player 1 and Player 2 alternate turns on the same device. Use the on-screen controls, or use `A`/`D` to move, `W`/`S` to aim, `Q`/`E` to change power, and <kbd>Space</kbd> to fire.
- On a touch or pointer device, drag the active tank horizontally within its side of the arena.
- Each tank starts with 100 health. A direct hit removes 50 health; terrain, the central barrier, and missed shots end the turn without damage. The first player to reduce the other tank to zero wins.

## License

See [LICENSE](LICENSE).
