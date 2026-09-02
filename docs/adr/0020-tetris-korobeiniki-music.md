# 0020: Use Korobeiniki for Tetris background music

## Status

Accepted. This record amends ADR 0013's requirement that normal-gameplay lead
phrases be original. Its procedural-audio, presentation, and provenance rules
remain current.

## Context

The Tetris experience should use the recognizable “Korobeiniki” melody during
active play. The melody is a traditional Russian folk song published in the
nineteenth century, but modern recordings and arrangements can carry separate
rights. The arcade also intentionally ships no audio or MIDI assets.

## Decision

The Tetris track in `scripts/audio.js` manually transcribes the opening eight
bars from the public-domain 1861 score linked in `docs/audio.md` and transposes
them from E minor to A minor for the existing synthesizer range. The bass,
harmony, percussion, timbres, and intensity response remain an original
procedural arrangement. No notes, audio, MIDI, or production choices are copied
from a modern Tetris soundtrack or another arrangement.

The shared audio scheduler may honor explicit multi-step note lengths for this
phrased track. All sound remains presentation-only, begins after player
interaction, uses the shared mixer and voice ceiling, and suspends under the
existing lifecycle rules.

## Consequences

- Tetris active play has a familiar melodic identity across experience themes.
- The arcade retains its build-free, offline-capable, asset-free audio system.
- Provenance is reviewable independently from any copyrighted recording or
  modern arrangement.
- Other games continue using their original procedural lead phrases.
