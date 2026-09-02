# 0013: Procedural, presentation-only arcade audio

## Status

Accepted. ADR 0015 amends the open-dialog lifecycle rule for the dedicated
sound mixer; all other decisions in this record remain current.

## Context

The six modern games need music and action feedback without adding copyrighted
recordings, large media downloads, a build step, or a dependency that hides the
browser audio lifecycle. Browsers also prevent audible Web Audio playback until
a page has received a qualifying user interaction. Online games receive repeated
authoritative snapshots, so presentation code must not turn every snapshot into
a repeated sound.

## Decision

`scripts/audio.js` owns one lazily created Web Audio graph for modern game pages.
It synthesizes every voice, noise source, envelope, and music sequence at runtime;
the repository ships no audio recording, sample, or MIDI asset. Separate music
and effects buses feed a bounded master graph. The shared shell owns persistent
mute and volume controls. Game controllers publish semantic domain facts through
`scripts/game-events.js`; audio independently maps those facts to cues, scene
intensity, and pause state. Audio never participates in mechanics, transport,
scoring, or authoritative room state. See ADR 0014 for the event boundary.

Background scores are original procedural patterns. A small number of manually
transcribed public-domain note fragments may be used for milestones when their
source edition and encoded passage are recorded in `docs/audio.md`. No recording
or third-party arrangement is copied. The shared engine changes timbres for the
playful, cabinet, and calm experience themes; game scripts do not branch on theme
names.

The graph is created or resumed only from player interaction. Music suspends for
hidden documents and open dialogs, and transient sources have finite lifetimes
and a shared voice ceiling. Online controllers trigger sounds from new transition
or serial identifiers so reconnect and snapshot replay stay silent.

## Consequences

- Modern games gain a small, offline-capable audio system with no new dependency.
- Players receive master mute plus independent music and effects levels.
- Unsupported browsers keep fully functional silent gameplay.
- Classic p5.js experiments remain unchanged and silent.
- New music quotations require provenance review and documentation.
- Game controllers remain independent from audio and can support additional
  presentation consumers without new direct integrations.
