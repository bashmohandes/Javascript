# 0015: Keep the sound mixer audible while tuning

## Status

Accepted. This record amends ADR 0013's open-dialog lifecycle rule; the rest of
ADR 0013 remains current.

## Context

ADR 0013 suspends background music whenever a dialog is open. That is appropriate
for account, achievement, sharing, and appearance tasks, where ongoing music can
distract from the surface. It also meant that players could not hear music-level
changes inside the dedicated sound mixer, and the shared ducking gain made its
effects preview too quiet to judge. A sound control that cannot be evaluated
while it is being adjusted does not meet the mixer's purpose.

## Decision

The dedicated `.arcade-audio-dialog` is the sole exception to the open-dialog
music-suspension rule. While it is open, an already active gameplay scene may
continue scheduling music at the selected level, and the effects preview uses
the normal effects bus. Opening the mixer is an explicit sound interaction and
may satisfy browser user-activation requirements.

Every other open dialog continues to duck the master bus and stop music
scheduling. The exception changes presentation lifecycle only: game controllers,
domain events, mechanics, online authority, scoring, and persistence remain
unaffected.

## Consequences

- Players can compare presets and fine-tune both buses with immediate feedback.
- Music may continue behind the modal sound mixer, but not behind other dialogs.
- Future dialogs are blocking by default and require another architectural
  decision before becoming audible.
- Automated and browser tests must cover the exception, mute state, previews,
  and responsive mixer controls.
