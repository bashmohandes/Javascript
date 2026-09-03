# Battle Tanks gameplay rules

This is the player-facing source of truth for Battle Tanks rules. The
[architecture decision](adr/0009-authoritative-battle-tanks-simulation.md)
governs implementation boundaries.

## Arena, turns, and damage

Each seeded arena has generated hills and valleys and a variable central
barrier. Tanks stay on their side but may drive over pickups. Explosions carve
terrain and remove barrier cells; later movement, shells, homing missiles, and
laser rays collide with the changed geometry.

Every tank starts at 100 health. Explosive damage falls linearly from the
weapon's maximum at the center to zero at the blast edge. All explosions can
damage their shooter. A shield absorbs damage before health and expires when
its generated capacity is spent or after its displayed number of that player's
completed turns. A health pack restores up to 35 health, never above 100.
Damage from one resolved explosion is applied only once. If one resolution
destroys both tanks the match is a draw; otherwise the surviving tank wins.

## Pickups, effects, and weapons

Pickups are scheduled deterministically every three completed turns through
turn 18, with at most three on the arena and three items in each inventory.
Drive over one to collect it. Acquisition cards describe the collected item;
dismissal (including <kbd>Escape</kbd>) is local to that browser. Online matches
remember dismissed event IDs for that room and match so reconnects do not replay
old cards. Solo and local matches start with a fresh in-memory dismissal guard
on every page load, so a newly acquired item is never hidden by an ID saved from
an earlier match. Dismissing a card never mutates shared match state.

Stable power-up IDs are `health-pack`, `shield`, `invisibility`,
`weapon-wide-blast`, `weapon-heavy-shell`, `weapon-homing`, `weapon-laser`,
`damage-boost`, and `blast-radius-boost`. Shields have 40–60 capacity for 2–4
turns. Invisibility lasts 1–3 of the activating player's turns and is available
only online. Damage and blast boosts last two turns. Activating or equipping any
power-up preserves the current turn, so the player may still move, aim, or fire.

Stable weapon IDs are `shell`, `wide-blast`, `heavy-shell`, `homing`, and
`laser`. The standard shell has unlimited ammunition. Each weapon pickup grants
two rounds. Wide blast trades peak damage for a 130-unit radius, compared with
the standard shell's 52-unit radius. Heavy shells are
slower but inflict greater damage and deformation. Homing missiles begin
ballistically, climb toward a clearance waypoint while an intact central wall
blocks the route, then pursue a visible opponent with a bounded turn rate. They
cannot lock onto an invisible tank. With no wall cells remaining, they acquire
the opponent directly after the normal short delay and range check.
Lasers reflect from collision surfaces, lose energy on every reflection, and
stop after five bounces, 1,800 arena units, insufficient energy, or a tank hit.
Reflected lasers can damage their shooter.

Projectile launches and impacts use deliberately prominent trails, flashes,
particles, screen shake, and damage callouts. Reduced-motion preferences retain
clear static feedback without the large movement effects. Acquisition and winner
cards are sized against the dynamic viewport and safe areas so their information
and actions remain available without page scrolling, including on short screens.

## Invisibility and online play

Local matches share the mechanics core but cannot activate invisibility.
Online, the server owns the arena, random values, commands, simulation,
collisions, collection, effects, damage, results, and statistics. While an
opponent is invisible, snapshots omit their coordinates and aim. Their fired
projectile is also omitted until it crosses the central disclosure boundary;
it then appears at its current authoritative position. The browser does not
reconstruct or reveal its concealed launch path.

## Controls

Single player puts you in the Player 1 tank against the CPU. The CPU evaluates
legal weapon, angle, and power combinations against the current destructible
arena, repositions before every shot, and deliberately mixes partial-damage
shots with credible near misses. Its choices are deterministic for the match
and use the same movement and combat mechanics as local players. It is designed
to remain fallible rather than maximize damage on every turn.
Local 2-player keeps both tanks under shared keyboard, pointer, or touch control.

Use <kbd>A</kbd>/<kbd>D</kbd> or <kbd>←</kbd>/<kbd>→</kbd> to move,
<kbd>W</kbd>/<kbd>S</kbd> or <kbd>↑</kbd>/<kbd>↓</kbd> to aim, and
<kbd>Q</kbd>/<kbd>E</kbd>, <kbd>−</kbd>/<kbd>+</kbd>, or the on-screen controls
to change power. Press <kbd>Space</kbd> or **Fire** to shoot. Pointer and touch
players can use all visible buttons; in solo or local mode they may also drag the active
tank horizontally. The weapon selector chooses available ammunition. **Enter
full screen** adds movement, aim, power, weapon, fire, and exit controls. In
landscape, those controls move into a compact side deck so the 16:9 battlefield
can use nearly the full screen height without covering either tank.

## Results and achievements

Battle Tanks result details use a versioned schema. Common fields are `mode`,
`winner`, `turns`, `shots`, `hits`, derived `accuracy`, `seconds`, and
`damageTaken`. Bounded optional aggregates are `weapons`, `splashDamage`,
`healing`, `powerUps`, `powerUpsAcquired`, `powerUpsUsed`,
`powerUpTypesUsed`, `shieldDamageAbsorbed`, `healthRestored`,
`invisibilityActivations`, `laserRicochetHits`, `laserSelfDamage`,
`homingHits`, `heavyProjectileMaxDamage`, and `poweredHits`. Weapon and
power-up keys use the stable IDs above. In `solo` results, `shots`, `hits`,
accuracy, weapons, and power-up statistics belong only to the human Player 1;
CPU victories score zero. Online values are produced by the room server; solo
and local values are validated but inherently less trusted.

Most Battle Tanks achievements are per-match milestones: finishing or winning,
accuracy, no damage, online play, acquisition and variety, shield absorption,
healing, invisibility, specialized-weapon hits, and powered hits. Their stable
IDs are `tanks-first`, `tanks-win`, `tanks-accurate`, `tanks-untouched`,
`tanks-online`, `tanks-power-first`, `tanks-power-variety`,
`tanks-shield-break`, `tanks-second-wind`, `tanks-invisible-win`,
`tanks-laser-ricochet`, `tanks-laser-self-hit`, `tanks-homing-hit`,
`tanks-heavy-hit`, and `tanks-powered-win`. `tanks-power-collector` is
cumulative: acquire a power-up in ten completed matches. Achievement progress
is evaluated from normalized result aggregates, not acquisition-card actions.
