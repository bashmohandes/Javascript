# ADR 0011: Deterministic Tetris power-ups with validated scoring

## Status

Accepted

## Context

Tetris needs occasional stack-recovery moments without weakening its testable
mechanics boundary or allowing presentation code to author scores. One power-up
must cut through difficult areas of the stack, while another must use a physical
device shake to settle blocks into gaps. Motion sensors are permission-gated on
some mobile browsers and unavailable to keyboard and many assistive-technology
users, so shaking cannot be the only activation path.

## Decision

1. Power-up selection lives in the mechanics engine and uses the injected random
   source. After a five-piece opening grace period, each locked tetromino has a
   10% chance to trigger one of the two power-ups, with at least six locked
   tetrominoes between power-ups.
2. A magic breaker replaces the next active tetromino with one glowing cell. It
   can move left, right, and down through occupied board cells, erasing each cell
   it enters. Hard drop sweeps the breaker to the bottom and erases every occupied
   cell in that vertical path. It does not enter the seven-bag, hold slot, locked
   piece count, or normal drop-distance score.
3. Every erased cell awards 50 points. Completed results include bounded magic
   acquisition and destroyed-cell counts, and the server derives these points
   with the line-clear and drop score rather than accepting the displayed total.
4. A stack shake arms after a lock, freezes active simulation time and gravity,
   and compacts each board column independently toward the floor while preserving
   block order. Standard line-clear mechanics run immediately after compaction.
5. Device motion uses a threshold and cooldown to reject ambient sensor noise.
   Browsers that require motion permission request it only from the power-up
   button. Pressing <kbd>S</kbd> or choosing **Compact now** provides an equivalent
   keyboard, desktop, denied-permission, and assistive-technology path.
6. Glow, impact, falling-block, and shake presentation remains browser-local and
   non-authoritative. It consumes the scoped `--tetris-magic` theme token and has
   a static reduced-motion treatment.

## Consequences

The mechanics remain deterministic under injected randomness, and compaction can
be regression-tested without a DOM or motion sensor. Cached clients that omit the
new result facts remain valid because the server normalizes them to zero. A local
client can still fabricate plausible aggregates, consistent with the accepted
local-marathon trust boundary in ADR 0010.

Pausing the simulation while a shake is armed prevents the falling tetromino from
intersecting a changing board and gives players time to grant motion permission.
The explicit fallback means physical shaking is an enhancement rather than an
accessibility requirement.

## Invariants

* Power-up randomness and board mutation belong to `tetris/scripts/game.js`.
* Magic points equal exactly 50 times the validated destroyed-cell count.
* Magic blocks never enter the seven-bag, hold slot, or locked-piece aggregates.
* Column compaction preserves the vertical order of occupied cells.
* Shake compaction uses the existing line-clear and level progression rules.
* Motion permission is requested only in response to a user action.
* Reduced-motion users receive clear power-up state without repeated movement.
