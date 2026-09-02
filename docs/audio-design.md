# Procedural audio design

## Goals and boundaries

The audio system gives each modern game a continuous musical identity and clear
action feedback while preserving the build-free browser architecture. It must:

- create every audible signal in the browser without media assets;
- begin only after a qualifying player interaction;
- remain optional, accessible, bounded, and silent when unsupported;
- treat audio as non-authoritative presentation in local and online games; and
- keep theme selection in shared code rather than game controllers.

The classic p5.js pages, server, mechanics engines, result schemas, and room wire
formats are outside this design.

## Runtime and signal graph

`scripts/audio.js` exposes one frozen `window.ArcadeAudio` object per modern game
page. Loading the script performs no audio work. `activate()` lazily constructs an
`AudioContext` and resumes it from a gameplay gesture.

```text
procedural music voices ──> music gain ──┐
                                        ├─> dynamics compressor ─> master gain ─> destination
action/noise voices ──────> effects gain ┘
```

Music, effects, and master gains use short ramps so preference changes do not
click. Oscillators and generated noise buffers always receive a scheduled stop,
disconnect after completion, and share a 32-voice ceiling. The compressor is a
safety boundary for overlapping action cues, not a substitute for conservative
voice gains.

## Public controller contract

Game controllers use semantic methods and never manipulate audio nodes:

| Method | Responsibility |
|---|---|
| `activate()` | Create/resume the context from player interaction. |
| `cue(name, detail?)` | Play a finite action or milestone sound. Details carry presentation values such as damage, weapon, side, or clear count. |
| `setScene(scene, detail?)` | Select `idle`, `active`, or `complete` music state and provide normalized `intensity` and `danger`. |
| `setPaused(value)` | Stop scheduling music while a game is paused. |
| Preference methods | Read or update master mute and the music/effects buses. |

Calling any method in an unsupported browser is safe. Scene and cue calls do not
change game state or return mechanics decisions.

## Sequencing and adaptation

Each game owns an original scale, bass cycle, melody-index pattern, base tempo,
and root pitch in the shared catalog. A 45 ms timer schedules roughly 160 ms
ahead against `AudioContext.currentTime`, keeping note timing stable without an
audio worklet. `intensity` adds melodic and pulse layers and may increase tempo by
at most 10 BPM. `danger` adds a restrained high pulse; it never rewrites game
timing.

Theme profiles change oscillator types, brightness, envelope shape, density, and
gain. The active composition remains recognizable across themes. Theme changes
affect newly scheduled voices and do not require controllers to know theme names.

## Lifecycle and preferences

First-time defaults are master unmuted, music 35%, and effects 70%. The three
values use independent local-storage keys and synchronize through the browser
`storage` event. The topbar exposes a quick master toggle; labelled sliders live
in the shared appearance-and-sound dialog.

The scheduler runs only when the context is activated, the document is visible,
no dialog is open, the master/music buses are audible, the game is not paused,
and the scene is `active`. Hiding the document suspends the context. Returning to
the page resumes only a context that the player previously activated. Dialogs
duck the master and stop background scheduling so account, achievement, sharing,
and settings surfaces remain comfortable.

## Game integration and online deduplication

Controllers emit cues only after successful actions. Flood fills, held controls,
and continuous simulations summarize or throttle their feedback rather than
creating a voice for every mechanics step.

Online audio is derived from transitions between accepted viewer states:

- Pong tracks score values, running state, and local collision presentation.
- Tic-tac-toe compares board cells and ignores the first state received during a
  resume handshake.
- Battle Tanks uses existing impact and acquisition serial identifiers and phase
  transitions.

Resume snapshots establish the new presentation watermark without playing old
events. No audio identifiers or preferences enter WebSocket messages.

## Failure and test strategy

- Missing Web Audio support produces a frozen no-op surface and disabled controls.
- Context resume rejection leaves gameplay silent and retryable on the next input.
- Invalid stored levels fall back to defaults; setters clamp values to `[0, 1]`.
- Unit tests use a fake context to verify lazy construction, routing, bounded
  scheduling, preference behavior, and cleanup.
- Static integration tests require all modern pages and semantic game hooks while
  prohibiting audio media files and named-theme branches in game code.
- Browser verification covers interaction activation, tab visibility, dialogs,
  full-screen modes, touch/keyboard input, all experience themes, and long-session
  clipping or node accumulation.
