# Tetris gameplay and responsive layout

Tetris is an endless single-player marathon. The
[architecture decision](adr/0010-tetris-marathon-integration.md) defines its
mechanics, result, theme, and presentation boundaries.

## Rules and controls

The game uses a 10×20 visible board, a seven-bag piece sequence, five-piece next
preview, hold slot, ghost piece, SRS rotation and wall kicks, progressive
gravity, and bounded lock-delay resets. A run ends when the stack tops out.

Use the arrow keys to move and soft drop, <kbd>Z</kbd>/<kbd>X</kbd> or the up
arrow to rotate, <kbd>Space</kbd> for a hard drop, <kbd>C</kbd> to hold, and
<kbd>P</kbd> or <kbd>Escape</kbd> to pause. The visible touch controls provide
the same actions on mobile.

## Mobile layout

At phone widths, the board and information rail remain side by side in an
approximately 70/30 split. The rail keeps the current score, lines, level, high
score, held piece, next-piece queue, pause, and new-game actions visible while
the existing touch controls remain below the play area. Board height is also
limited by the dynamic viewport and bottom safe area so the board and controls
fit together without hiding the status information.

## Clears and high scores

Line clears trigger an intentionally theatrical, non-blocking presentation:
the affected rows streak, the board flashes and recoils, sparks burst outward,
and a large clear count appears. Larger clears increase the intensity. Players
who prefer reduced motion receive a prominent static flash and count instead.

The high-score value is visible throughout the run and updates immediately when
the current score exceeds it. Breaking the standing record triggers a large
in-game announcement and keeps the high-score panel highlighted while play
continues. The browser stores this local best score independently of signed-in
leaderboard results.

## Results and achievements

Only completed top-outs are submitted. Restarts, abandoned games, and unfinished
page sessions are not recorded. The result contains bounded aggregate facts such
as duration, lines, level, locked pieces, clear counts, and drop distances; the
server validates those facts and derives the stored score rather than accepting
a client-authored score. Signed-in results feed history, leaderboards,
top-score notifications, and the Tetris achievement catalog.
