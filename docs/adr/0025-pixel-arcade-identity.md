# ADR 0025: Use a code-native pixel identity for the modern arcade

## Status

Accepted

## Context

The modern arcade shared bright colors and card layouts, while its Cabinet
experience added a compact dark palette. The result remained closer to a
contemporary editorial site than a cohesive game identity. The project is
build-free, supports multiple appearance experiences, and includes DOM and
canvas games that must stay responsive and accessible.

## Decision

The existing `playful` experience id becomes the user-facing **Pixel** default.
Its stored id is retained so existing preferences need no migration. Cabinet
uses the same pixel grammar in a denser coin-op treatment, while Calm remains a
restrained alternative and classic p5.js editions retain their historical art.

Pixel presentation uses a locally hosted open-license display font, CSS custom
properties, SVG, DOM decoration, and canvas primitives. It does not introduce a
bundler, theme-name branches in game controllers, or raster sprite dependencies.
Long text keeps a readable monospace stack; the display face is reserved for
headings, scores, labels, and controls.

Each modern game receives a distinct accent and board treatment through shared
tokens and scoped game styles. Canvas palettes remain CSS-owned and refresh via
`system:theme-changed`. Player-selected colors, mechanics, authority, semantic
order, keyboard behavior, and touch targets remain independent from presentation.
Animation is short and stepped, with equivalent static states under reduced
motion.

## Consequences

- The modern arcade has one recognizable default identity without invalidating
  saved appearance preferences.
- New visual assets must remain crisp, local, cacheable, and usable without a
  build step.
- Theme and game tests must protect canvas-token ownership, reduced motion,
  classic-edition isolation, and responsive access to controls.
- The local font license ships beside the font and both are available offline.
