# ADR 0027: Versioned private cloud game saves

**Status:** Accepted

## Context

Modern local games can outlast a browser session, but their controllers and
mechanics use different state shapes. Players need resumable progress on every
signed-in device without weakening authoritative online rooms or treating a
client-authored checkpoint as a trusted result.

## Decision

1. Signed-in users receive five SQLite-backed slots per modern game. A slot
   contains bounded, versioned JSON state, private screenshot bytes, optional
   title, mode, elapsed time, display-only score text, timestamps, and a
   per-creation generation and revision used together for optimistic concurrency.
2. A shared browser manager owns authentication continuation, slot allocation,
   management UI, leave warnings, and Quick Save & Exit. It derives its
   page-local dirty flag from the existing semantic game-event stream; capture
   and persistence remain direct operations. Each game supplies a narrow
   adapter for eligibility, pause/resume, strict state import/export, metadata,
   and a screenshot canvas.
3. Only unfinished solo and local multiplayer state is saveable. Online games
   retain their server-authoritative room and reconnect lifecycle and never
   export viewer state to cloud slots.
4. Save payloads remain client-authored and private. They never contribute to
   leaderboards, achievements, online authority, or trusted result recording.
   The server validates the bounded envelope and image; each current game
   version validates its own state before applying it.
5. The first save atomically selects the lowest empty slot. Later saves update
   the active slot. Conflicting device generations or revisions fail rather than
   silently overwrite newer progress, including when a slot was deleted and
   recreated, and terminal completion clears the active slot.
6. Browser-native close and reload warnings remain generic. The custom Quick
   Save & Exit choice is available for same-origin navigation, where the page
   can safely complete an authenticated screenshot and state upload first.

## Consequences

All modern controllers gain explicit persistence boundaries while the arcade
stays build-free. State schema changes require a new adapter version or a
compatible importer. SQLite storage grows with private screenshots but remains
bounded to thirty slots per account. This decision supersedes ADR 0010's
initial choice not to persist unfinished Tetris runs; completed results keep
their existing server-derived validation path.
