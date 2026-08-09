# JavaScript Playground

A small collection of browser games and coding exercises, built for fun and
learning. Everything runs directly in the browser—no application build step is
required.

## Games

| Game | About | Play |
| --- | --- | --- |
| **Sudoku** | The refreshed, responsive version with notes, hints, keyboard controls, and an animated backtracking solver. | [Play modern Sudoku](https://bashmohandes.github.io/Javascript/Sudoku/) |
| **Sudoku Classic** | The original p5.js experiment, preserved alongside the new game. | [Play Sudoku Classic](https://bashmohandes.github.io/Javascript/Sudoku/classic/) |
| **Minesweeper** | A canvas-based take on the classic mine-clearing puzzle. | [Play Minesweeper](https://bashmohandes.github.io/Javascript/Minesweeper/) |
| **Pong** | Responsive solo, couch co-op, and private online multiplayer Pong. | [Play Pong](https://bashmohandes.github.io/Javascript/pong/) |

The repository also contains solutions and experiments from LeetCode,
Codeforces, and Codewars.

## Online Pong on a NAS

Online Pong uses a small authoritative Node.js WebSocket server. The server owns
the ball, paddles, power-ups, and score so both players always receive the same
match state. Rooms are private, in memory, and disappear after all players leave
or the inactivity timeout expires.

### Docker Compose (recommended)

From the repository root:

```sh
docker compose up -d --build
```

Open `http://YOUR_NAS_IP:8080/pong/`, select **Online**, and create a room. The
host can copy the invitation link or give the five-character code to a friend.
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

The container exposes `GET /healthz` and runs as an unprivileged user. Game
rooms are intentionally ephemeral, so no volume is required.

### Reverse proxy and HTTPS

For play outside your LAN, put the container behind your NAS reverse proxy and
enable HTTPS. Forward normal HTTP traffic and WebSocket upgrades for `/ws` to
the same container and port. Most NAS proxy interfaces have an **Enable
WebSocket** option; otherwise ensure they forward the `Upgrade` and `Connection`
headers. Invitation links use the browser's current public host and automatically
choose `wss://` when the page is served over HTTPS.

Optionally restrict accepted browser origins in `.env` with a comma-separated
allowlist:

```dotenv
ALLOWED_ORIGINS=https://pong.example.com
RECONNECT_GRACE_MS=15000
ROOM_TIMEOUT_MS=1800000
```

Do not publish the plain HTTP port directly to the internet. Use HTTPS/WSS and
your NAS firewall or access controls.

### Run without Docker

Node.js 22 or newer is required:

```sh
npm install
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
3. Wait for the forwarded **Game preview** port to open.
4. Open `/Sudoku/` for the new game or `/Sudoku/classic/` for the original.

### Local preview

From the repository root, start a static server:

```sh
python3 -m http.server 8000
```

Then open one of these URLs:

- Modern Sudoku: <http://localhost:8000/Sudoku/>
- Classic Sudoku: <http://localhost:8000/Sudoku/classic/>

## Sudoku controls

- Select a square and use the on-screen number pad or keyboard keys `1`–`9`.
- Press `N` to toggle notes and use arrow keys to move around the board.
- Use **Hint** for a nudge or **Auto solve** to watch the backtracking solver.
- During auto-solve, select **Stop solve** to return to your board.

## License

See [LICENSE](LICENSE).
