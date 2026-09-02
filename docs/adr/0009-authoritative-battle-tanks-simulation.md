# ADR 0009: Authoritative deterministic Battle Tanks simulation

## Status

Accepted

## Context

Battle Tanks began with flat terrain, one fixed barrier, cosmetic impact marks,
and fixed damage on direct hits. The expanded game requires seeded hills and
valleys, variable barriers, destructible collision geometry, radial damage,
pickups, timed effects, several weapons, and invisibility that is available only
online. Maintaining separate solo, local, and online rule sets would make outcomes
and bug fixes diverge, so all three modes need one deterministic mechanics core.

Online rooms must remain server-authoritative. In particular, invisibility is
hidden information: removing a tank during canvas rendering is insufficient if
its coordinates have already crossed the network. Hidden fields must be
redacted before serialization. Reconnects and different simulation tick sizes
must not alter an outcome. Acquisition cards are presentation events rather
than gameplay commands, and achievement statistics must arise from gameplay
transitions and authoritative online state, never from UI actions.

## Decision

1. Generated arena data, pickups, effects, weapon state, deformation, bounded
   match statistics, and presentation-event IDs are part of versioned match
   state.
2. Arena generation, pickup scheduling, and randomized power-up values use a
   seeded deterministic random source.
3. The server runs online simulation, collection, weapon behavior, damage,
   healing, shield consumption, and achievement-statistic transitions.
4. Online snapshots are serialized per viewer. They omit invisible opponents
   and conceal projectile origins until disclosure is safe.
5. Terrain samples and barrier cells are collision data. Explosions deform
   those structures; scorch marks and particles remain cosmetic.
6. One damage pipeline handles radial falloff, self-damage, shield absorption,
   and weapon modifiers. Shields are consumed before health.
7. Weapons and power-ups use data-driven registries. Protocol identifiers are
   bounded and validated rather than inferred from labels or array positions.
8. Acquisition cards consume ordered, match-scoped, replay-safe presentation
   events. Each browser keeps its own dismissal guard; only online room/match
   guards persist for reconnect replay protection. Solo and local guards reset
   on page load so reused local event IDs cannot suppress a new acquisition.
   Dismissal cannot mutate the match.
9. Results contain bounded per-player match aggregates, not an unbounded combat
   history. These aggregates drive achievements.
10. Battle Tanks state snapshots and result-detail payloads are versioned.
    Unsupported versions are rejected so incompatible clients fail safely.
11. Solo mode is a browser adapter over the shared mechanics core. Its
    deterministic CPU repositions within legal movement bounds, plans against
    current destructible geometry, and intentionally chooses bounded damaging
    shots and credible near misses rather than maximizing every turn.
12. Solo result aggregation includes only human Player 1 activity. A CPU win
    derives a zero player score, preventing CPU statistics from entering human
    leaderboards.
13. Homing guidance may use a bounded clearance waypoint while intact barrier
    cells block the direct route, then transitions to normal target pursuit.
    Guidance changes steering only; shared collision remains authoritative.
14. Version 3 online snapshots send complete arena geometry when a player joins,
    resumes, starts a match, or observes a new impact revision. Intermediate
    projectile snapshots omit the unchanged arena; the client retains the last
    authoritative geometry and still applies viewer-specific redaction.
15. Solo CPU planning uses a bounded coarse-to-fine search over the shared
    mechanics. Canvas presentation caches the static arena layer and schedules
    frames only while simulation or timed effects are active.

## Considered alternatives

* **Client-generated online arenas.** Rejected because seeds, generators, or
  client versions could disagree and clients could choose favorable geometry.
* **Send complete state and hide opponents in canvas.** Rejected because browser
  tools, logs, and extensions could read concealed coordinates and aim data.
* **Replay the full event history on reconnect.** Rejected because histories
  grow without bound and replay introduces ordering and compatibility risk; a
  current snapshot plus bounded replay-safe presentation events is sufficient.
* **Visual-only crater decals.** Rejected because rendering would disagree with
  projectile, movement, and laser collision.
* **Separate local and online physics.** Rejected because parity and deterministic
  regression testing would be lost.
* **Unrelated conditionals for every weapon.** Rejected because validation,
  ammunition, rendering metadata, and common damage behavior would drift.
* **Client-submitted achievement claims.** Rejected because UI actions are easy
  to forge and are not evidence that a gameplay transition occurred.
* **Pause gameplay until one player dismisses a card.** Rejected because a local
  presentation preference must not block the opponent or authoritative clock.

## Consequences

The design gives deterministic, testable solo/local/online parity and stronger
protection for online hidden information. Its cost is larger, more complex
snapshots plus additional schema validation and compatibility responsibilities.
Destructible terrain and reflected lasers make collision queries more expensive.
Revision-aware arena delivery avoids repeatedly transmitting that large static
portion, while reconnect and match boundaries always restore a complete baseline.

Terrain samples, crater events, laser bounces, pickup histories, match
aggregates, and presentation events must all remain bounded to prevent snapshot
or memory growth. If snapshots become too expensive, compression or
seed-plus-event reconstruction may be needed. Local result statistics remain
less trustworthy than server-produced online statistics unless local play is
eventually hosted by an authoritative server.

## Phased migration

1. Introduce versioned state and deterministic arena generation.
2. Move collision and rendering to match-owned arena geometry.
3. Add deformation and radial damage.
4. Add pickups, inventories, health packs, and shields.
5. Add the acquisition-card event and browser UI queue.
6. Add specialized weapons.
7. Add viewer-specific invisibility redaction.
8. Add result statistics and achievements.
9. Remove legacy constants and compatibility paths after every caller and test
   has migrated.

Each phase keeps the existing playable path working and adds compatibility only
for as long as callers require it.

## Invariants

* The server never accepts client-authored arena, damage, pickup, effect, or
  achievement data.
* A seed produces the same initial arena and pickup schedule.
* Match snapshots never expose concealed opponent coordinates.
* A client receives complete arena geometry before any geometry-omitting delta.
* Damage is applied once per resolved explosion.
* Shield absorption precedes health damage.
* Every acquisition event has a stable match-scoped ID.
* Client-local card dismissal cannot mutate shared match state.
* A fresh solo or local page run cannot inherit a presentation-event watermark
  from an earlier match; online reconnects retain their room/match watermark.
* Solo CPU movement and shots obey the same mechanics bounds as human commands.
* Solo results exclude CPU aggregates, and CPU victories produce zero score.
* Rematches reset deformation, effects, inventories, statistics, and
  presentation-event guards.
* Bounded state prevents unlimited snapshot or memory growth.

