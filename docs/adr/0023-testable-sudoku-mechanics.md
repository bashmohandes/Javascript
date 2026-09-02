# 0023: Separate testable Sudoku mechanics

## Status

Accepted.

## Context

The modern Sudoku page kept board generation, placement rules, peer-note
updates, and the animated backtracking algorithm inside its DOM controller.
Those mechanics could only be exercised by loading the page, and changes to
the solver were coupled to timers, status messages, and rendering. The classic
p5.js Sudoku remains intentionally separate under ADR 0006.

The arcade is build-free, so the modern mechanics boundary must load directly
in a browser while remaining importable by Node's test runner. Puzzle generation
must preserve the existing difficulty clue counts and allow deterministic tests
without making seeded puzzles part of the product contract.

## Decision

Use `Sudoku/scripts/game.js` as the modern game's mechanics core. It owns grid
validation and cloning, randomized valid-solution generation, difficulty-based
clue removal, row/column/box placement rules, note-peer updates, and the
stepwise backtracking state machine used by auto solve.

Randomness is supplied as an optional function so tests can reproduce generated
boards; the browser continues to use `Math.random`. Solver steps expose semantic
accepted, rejected, backtrack, complete, and unsolvable results. The browser
controller owns timers and animation pacing, DOM state, accessibility messages,
input, sharing, domain events, and result recording.

The module follows the build-free UMD pattern: `SudokuGame` in the browser and
CommonJS exports in Node. The existing generator removes the configured number
of clues but does not promise a unique solution; uniqueness would be a separate
game-design decision.

## Consequences

- Mechanics receive direct deterministic regression coverage without a DOM.
- Auto-solve presentation can change without rewriting the backtracking state
  machine, and solver changes can be tested without real timers.
- Invalid or sparse grids fail at the core boundary rather than producing
  misleading solver results.
- Modern Sudoku behavior remains separate from the preserved classic version.
