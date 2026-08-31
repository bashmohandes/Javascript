# ADR 0008: Separate experience themes from color modes

## Status

Accepted

## Context

The arcade originally stored `system`, `light`, or `dark` in a single
`arcade-theme` preference. That supported palette changes, but it could not
describe themes that also change typography, density, navigation, cards, and
page layout. Treating every experience and color combination as a separate
theme would create duplicated CSS and an increasingly large selector.

The site is build-free and must initialize its appearance synchronously before
the page renders. Anonymous users also need the same feature as signed-in
users, and games that render to canvas need a stable notification contract.

## Decision

We model appearance as two independent preferences:

- **Experience theme**: `field-manual`, `playful`, `cabinet`, or `calm`.
- **Color preference**: `system`, `light`, or `dark`.

The root element exposes the selected experience as `data-arcade-theme` and
the resolved light/dark value as `data-color-mode`. During migration it also
sets the legacy `data-theme` attribute for existing game-specific styles.

`theme-init.js` owns the immutable registry, storage keys, migration, and the
flash-free initial attributes. `arcade.js` owns the appearance dialog, live
updates, cross-tab synchronization, browser theme color, public API, and the
`arcade:theme` event. CSS is layered into experience tokens, shared components,
page layouts, and game-specific rendering.

Theme-owned game rendering values are exposed as CSS custom properties in the
theme styles. Canvas code reads that interface from computed styles and must
not select an experience or contain per-theme palettes. A new experience can
therefore implement game-specific tokens alongside its shared tokens without
requiring a game-code branch.

This contract applies to every modern game. DOM-rendered games (Tic-tac-toe,
Sudoku, and Minesweeper) consume the CSS cascade directly. Canvas-rendered games
(Pong and Battle Tanks) expose scoped `.game-pong` and `.game-battle-tanks`
token interfaces and refresh their computed values on `arcade:theme`. Player
colors and synchronized gameplay colors are game state, not experience-theme
palettes, and remain independent so matches render consistently for all peers.

The application anatomy is shared across themes: a desktop utility rail, a
program-directory homepage, compact game identity/status bands, play-first game
layouts, and a ledger-style profile. Themes may change shell width, density,
typography, spacing, borders, and material treatment inside that anatomy. They
must preserve semantic DOM order, keyboard focus order, game rules, required
controls, and responsive access to the play area.

Old `arcade-theme` values migrate to `arcade-color-preference`; the experience
defaults to `field-manual`. Field Manual uses indexed rows, ruled geometry,
hard-edged controls, and a small ink/cobalt/signal palette. The original
`playful` id again names the bright, rounded experience, so existing explicit
Playful preferences remain meaningful while the new default has its own stable
identifier.

## Consequences

- New experiences do not need duplicated light and dark selection logic.
- Users can follow their operating-system palette while retaining a chosen
  layout experience.
- Shared semantic tokens reduce page-specific palette duplication over time.
- Canvas games must consume the richer event detail rather than assuming the
  theme name is a light/dark value.
- The temporary `data-theme` compatibility attribute can be removed only after
  every game-specific stylesheet has migrated to `data-color-mode`.
- Every new theme requires registry metadata, token definitions, responsive
  layout QA, accessibility checks, and automated contract coverage.
