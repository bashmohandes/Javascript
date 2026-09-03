# Arcade audio

The six modern games synthesize all music and effects in the browser through the
Web Audio API. No recordings, audio samples, MIDI files, or third-party audio
libraries are shipped. Audio starts after the first gameplay interaction and can
be muted or mixed from the shared arcade controls.

## Musical approach

Normal gameplay uses procedural arrangements written for this arcade. Lead
phrases are original except for Tetris, which uses a documented public-domain
folk melody. Each game combines its lead with moving bass, chord changes, subtle
swing, and synthesized percussion while the shared experience theme changes its
timbre:

- **Playful** uses rounded plucks, bells, and warm triangle voices.
- **Cabinet** uses compact pulse and sawtooth voices.
- **Calm** uses softer sine and triangle voices with fewer notes.

Music reacts lightly to progress, pace, or danger. It does not affect mechanics,
online state, results, or scoring.

In Tetris, the music shifts into a faster tension tempo when the locked tower
rises above two-thirds of the playfield, then returns to its normal tempo after
line clears or power-ups bring the tower back down.

## Public-domain quotations

The following note sequences are manually encoded in `scripts/audio.js`.
Only the composition and a public-domain typeset score are used; no audio or MIDI
from the source is included.

| Cue | Encoded passage | Source and status |
|---|---|---|
| Sudoku completion | Opening C-major arpeggio, eight notes from the first measure of J. S. Bach's BWV 846 Prelude | [Mutopia edition](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=5), marked Public Domain |
| General victory | Opening fifteen-note melody from Beethoven's “Ode to Joy” | [Mutopia edition](https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=528), marked Public Domain |
| Four-line Tetris clear | Five-note opening turn from Mozart's “Rondo Alla Turca” | [Mutopia score](https://www.mutopiaproject.org/ftp/MozartWA/KV331/KV331_3_RondoAllaTurca/KV331_3_RondoAllaTurca-let.pdf), placed in the public domain by the typesetter |
| Tetris background | Opening eight-bar melody of the traditional Russian folk song “Korobeiniki,” transposed from E minor to A minor; accompaniment is original | [Wikimedia Commons 1861 score](https://commons.wikimedia.org/wiki/File:Korobeiniki.svg), marked Public Domain |

Future quotations must identify the exact passage, use a verified public-domain
score, and be reviewed independently from any modern recording or arrangement.

## Player behavior

- The topbar **Sound** button opens a mixer with Quiet, Balanced, and Bold
  starting points, separate percentage sliders, master mute, and an effects
  preview.
- Music and effects default to 60% and 80%, respectively, with extra calibrated
  headroom available at the top of each slider.
- Master mute and both levels persist across modern games and browser tabs.
- Music pauses in hidden tabs and while non-audio dialogs are open; the sound
  mixer remains audible so changes can be judged immediately.
- A browser without Web Audio remains silent and exposes disabled controls.
- The system reduced-motion preference does not mute audio; sound has its own
  explicit controls.
