# Repository guidance for coding agents

## Project shape

- This is a build-free JavaScript arcade plus one Node.js service. Browser pages load source files directly; do not introduce a bundler or framework without an explicit architectural decision.
- Modern games share accounts, results, achievements, appearance, navigation, and room UI through `arcade.js`, `arcade.css`, `theme-init.js`, and `scripts/`.
- Game-specific browser code lives in each game directory. Keep testable mechanics separate from DOM/rendering code when practical.
- The Node service in `server/` serves static assets, REST APIs, SQLite persistence, and authoritative WebSocket rooms.
- Classic games are intentionally preserved beside modern versions. Avoid broad rewrites of `classic/` directories.
- Coding-challenge directories such as `leetcode/`, `codeforces/`, and `codewars/` are independent scripts, not arcade runtime components.

Read `docs/architecture.md` before changing subsystem boundaries. Review the relevant record in `docs/adr/` for themes, persistence, security, results, online rooms, Battle Tanks, or Tetris. Add an ADR when a change makes a durable architectural choice rather than quietly overriding an accepted decision.

## Working conventions

- Use Node.js 22 or newer.
- Preserve the dependency-light, no-build browser architecture and existing plain JavaScript style.
- Match the formatting of the file being edited. Much of the CSS and browser markup is intentionally compact.
- Keep shared behavior in shared files and game-specific behavior in the game directory. Do not make game scripts branch on named experience themes.
- Experience themes (`playful`, `cabinet`, `calm`) and color modes (`system`, `light`, `dark`) are independent. Theme palettes and layout contracts belong in CSS custom properties and shared theme selectors.
- Maintain accessibility: semantic controls, useful labels, keyboard support, visible focus, live regions for status, and touch targets that remain usable at phone sizes.
- Treat narrow and short viewports as first-class. For mobile game changes, verify the board/canvas and controls together, account for `env(safe-area-inset-*)`, and test at least one phone-sized viewport such as 390 x 844. For layout changes, also check a laptop/desktop viewport and every experience theme affected.
- Keep mechanics deterministic and independently testable. Rendering and client prediction must not become sources of authoritative online state.

## Security and data boundaries

- Never trust client-authored scores. `server/accounts.js` validates bounded result facts and derives scores server-side.
- Online room managers own authoritative multiplayer state. Validate commands, preserve reconnect semantics, and serialize only viewer-safe state.
- Do not expose passcodes, session tokens, resume tokens, concealed opponent state, private implementation files, or database paths.
- Preserve origin checks, payload limits, rate limits, heartbeat handling, and secure cookie behavior when changing HTTP or WebSocket code.
- Add schema changes as the next ordered SQL file in `server/migrations/`. Never edit a migration that may already have shipped.

## Tests and local verification

Run from the repository root:

```sh
npm test
npm run check
```

Use focused tests while iterating, for example:

```sh
node --test tests/tetris.test.js
node --test tests/profile-page.test.js
```

Before handing off a change:

1. Add or update regression tests for the behavior.
2. Run the focused tests, then the full test suite and syntax checks.
3. Run `git diff --check` and review the final diff for unrelated changes.
4. For visual or interaction changes, start `node server/index.js`, open `http://localhost:8080/`, and verify the rendered behavior at relevant desktop and mobile viewports. Reload after source changes because there is no build or hot-reload layer.
5. For online changes, test both local and online paths plus disconnect/resume and rematch behavior where applicable.

## Git hygiene

- Inspect `git status` before editing and preserve user-owned changes.
- Base requested feature/fix branches on the latest `master` unless the user specifies another base.
- Keep commits focused and use concise imperative subjects consistent with the repository history.
- Do not commit, push, rewrite history, or open a pull request unless the user asks.
