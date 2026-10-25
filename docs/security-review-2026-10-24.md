# Security and performance review — 2026-10-24

Reviewed from master `4bf2d39`. The review focuses on the network-facing Node
service, authentication and persistence, static-file isolation, shared browser
runtime and service worker, multiplayer lifecycle, and deployment/dependency
configuration. Game mechanics are covered at their trust boundaries and by the
regression suite; classic games and independent coding-challenge scripts were
not comprehensively audited.

## Fixed findings

| Priority | Finding and impact | Resolution and evidence |
| --- | --- | --- |
| High | Static isolation checked request text before filesystem normalization. Encoded separators could route a nominal game path into private server files or the default database directory. Windows aliases and filesystem links also bypassed the original checks. | Normalize private-path checks, reject ambiguous path syntax, and validate the real destination inside the public root before reads. Unit tests cover aliases and directory links; live HTTP tests deny encoded server, data, and package paths. |
| High | Accepted WebSockets had no `error` listener. One invalid protocol frame emitted an unhandled error and terminated the process. | Install the error handler before routing any game socket. A live test reproduces the original process failure and verifies the fixed server remains healthy after malformed frames on all three endpoints. |
| High | Authentication and profile writes trusted a passcode hash read before awaiting scrypt. Concurrent credential changes could permit an old login or let an older profile write restore the old hash. | Recheck the login credential and condition the transactional profile write on the verified hash. Tests replace credentials while verification is pending and verify both older operations are rejected. |
| Medium | Profile PATCH verified the current passcode without throttling. A valid session allowed repeated credential guesses and expensive scrypt work outside the login budget. | Limit profile verification to ten attempts per account per fifteen minutes, across session rotations, and share login's address-level budget. A live test checks successful rotation, failed attempts, and HTTP 429 with Retry-After. |
| Medium | Tic-tac-toe omitted the socket-ownership guard used by the other games. An action queued on a closing, replaced connection could still mutate the resumed match. | Check current socket ownership before dispatch. A live regression reproduces an unauthorized old-socket move when the guard is removed; the fixed test also completes the resumed match and rematch. |
| Medium | The service worker excluded only literal `/api/` URLs and ignored private/no-store response directives. Encoded API aliases could store account responses in persistent browser cache. | Exclude decoded API paths, honor response privacy directives, and advance the cache to v16 to purge previous entries. Executable worker tests cover encoded aliases, private/no-store responses, public static caching, and old-cache removal. |
| Medium | Room broadcasts queued data without an outbound byte ceiling. Slow receivers could accumulate state snapshots even while responding to heartbeat pings. | Route every room send through a 1 MiB queue ceiling and terminate slow consumers. Tests cover all room managers, UTF-8 byte accounting, arena delivery, and pending result receipts across reconnect. |

## Performance changes

- Static cached buffers now have an 8 MiB LRU budget and a 512 KiB per-file
  ceiling. Larger files stream instead of being read into the cache. Existing
  conditional responses, HEAD requests, and resolved-asset CSP remain intact.
  Tests verify eviction and streaming without `readFile` allocations.
- Save listings select only slot metadata; screenshot retrieval selects only
  image columns. Previously, listing five slots could copy up to roughly
  2.5 MiB of unused state and image payloads into JavaScript.
- An illustrative Node 26.12.1 in-memory SQLite benchmark used five slots with
  240 KiB of state data and 256 KiB screenshots. Across 300 listings, the old
  SELECT-all query plus minimal metadata mapping took 169.4 ms; the revised
  `GameSaves.list` took 16.3 ms. This measures one local workload, not a production
  latency guarantee. Existing save isolation, revision, and storage-budget tests
  still pass.

## Remaining follow-ups

- Profile and leaderboard reads aggregate persisted history. The leaderboard's
  correlated best-result query and expression sort deserve a production-sized
  benchmark before choosing a ranking index, window query, or materialized
  summary. Any new index should ship as the next ordered migration.
- The browser service worker still uses an open-ended runtime cache of public
  URLs. Consider a bounded entry policy and normalization of asset query keys if
  offline storage usage becomes significant.
- In the phone smoke check at 390 × 844, Tic-tac-toe's board extended below the
  initial viewport and New game started around y=1232. Natural scrolling works,
  but a separate visual pass should bring the board and primary controls closer
  together without reducing touch targets.
- Preserve the deployment assumptions: TLS at the reverse proxy, a correctly
  configured TRUST_PROXY boundary, and persistent-data backups. Source review
  does not establish the configuration of an existing deployment. Solo/local
  result facts remain client-authored within server bounds, as accepted by
  ADR 0003; they do not provide replay-proof anti-cheat.

## Verification

- Baseline: 341 passing tests. Final: 359 passing tests on Node 26.12.1 with the
  locked ws 8.22.0 dependency.
- Focused regressions, full `npm test`, `npm run check`, and `git diff --check`.
- `npm audit --omit=dev`: zero reported vulnerabilities in the production
  dependency graph. Locked dependencies installed with `npm ci --ignore-scripts`.
- Live HTTP/WebSocket tests run with temporary databases and ephemeral ports;
  local mechanics and room disconnect/resume/rematch tests remain covered.
- Browser checks loaded the shared shell and Tic-tac-toe, exercised a local
  move, checked phone and desktop navigation, and reported no console warnings
  or errors. Screenshot capture repeatedly timed out, so visual screenshot QA
  is incomplete; phone geometry was inspected through the DOM.
- Docker is unavailable in this environment. The container vulnerability scan
  was not run locally; the existing CI build job performs the pinned scan.

The changes implement the existing security and resource boundaries in ADRs
0005, 0007, 0012, and 0017 without adding a framework, build step, dependency,
schema change, or new subsystem.
