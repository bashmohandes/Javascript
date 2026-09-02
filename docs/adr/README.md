# Architecture decision records

All records describe the current system retrospectively and have status
**Accepted**.

1. [Build-free browser clients and one Node service](0001-build-free-monolith.md)
2. [SQLite persistence with ordered migrations](0002-sqlite-and-migrations.md)
3. [Server-derived scores and catalog-driven achievements](0003-results-and-achievements.md)
4. [Authoritative, ephemeral online rooms](0004-authoritative-rooms.md)
5. [Opaque account and room sessions](0005-session-boundaries.md)
6. [Preserve classic games beside modern games](0006-classic-and-modern.md)
7. [Same-origin deployment and layered HTTP security](0007-same-origin-security.md)

8. [Separate experience themes from color modes](0008-experience-theming-system.md)
9. [Authoritative deterministic Battle Tanks simulation](0009-authoritative-battle-tanks-simulation.md) — **Accepted**; one versioned mechanics core powers solo CPU, local play, and viewer-redacted, server-authoritative online rooms.
10. [Build-free Tetris marathon with scoped themes and validated results](0010-tetris-marathon-integration.md) — **Accepted**; a testable local mechanics core feeds server-derived scores, shared account surfaces, achievements, responsive mobile presentation, and an encapsulated theme-token interface.
11. [Deterministic Tetris power-ups with validated scoring](0011-tetris-random-power-ups.md) — **Accepted**; random magic destruction and motion-assisted stack compaction stay testable, accessible, theme-scoped, and server-scored.
12. [Shared browser-aware app-install surface](0012-shared-app-install-surface.md) — **Accepted**; the modern arcade uses one manifest identity, native install prompts when available, and platform-specific manual guidance otherwise.
13. [Procedural, presentation-only arcade audio](0013-procedural-arcade-audio.md) — **Accepted**; modern games synthesize original music and effects through one bounded Web Audio runtime with shared controls and documented public-domain milestone fragments.
