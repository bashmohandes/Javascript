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
dismissal (including <kbd>Escape</kbd>) is local to that browser and never pauses
shared gameplay.

Stable power-up IDs are `health-pack`, `shield`, `invisibility`,
`weapon-wide-blast`, `weapon-heavy-shell`, `weapon-homing`, `weapon-laser`,
`damage-boost`, and `blast-radius-boost`. Shields have 40–60 capacity for 2–4
turns. Invisibility lasts 1–3 of the activating player's turns and is available
only online. Damage and blast boosts last two turns.

Stable weapon IDs are `shell`, `wide-blast`, `heavy-shell`, `homing`, and
`laser`. The standard shell has unlimited ammunition. Each weapon pickup grants
two rounds. Wide blast trades peak damage for a larger radius. Heavy shells are
slower but inflict greater damage and deformation. Homing missiles begin
ballistically, acquire a visible opponent after a short delay when in range,
then steer with bounded turn rate; they cannot lock onto an invisible tank.
Lasers reflect from collision surfaces, lose energy on every reflection, and
stop after five bounces, 1,800 arena units, insufficient energy, or a tank hit.
Reflected lasers can damage their shooter.

## Invisibility and online play

Local matches share the mechanics core but cannot activate invisibility.
Online, the server owns the arena, random values, commands, simulation,
collisions, collection, effects, damage, results, and statistics. While an
opponent is invisible, snapshots omit their coordinates and aim. Their fired
projectile is also omitted until it crosses the central disclosure boundary;
it then appears at its current authoritative position. The browser does not
reconstruct or reveal its concealed launch path.

## Controls

Use <kbd>A</kbd>/<kbd>D</kbd> or <kbd>←</kbd>/<kbd>→</kbd> to move,
<kbd>W</kbd>/<kbd>S</kbd> or <kbd>↑</kbd>/<kbd>↓</kbd> to aim, and
<kbd>Q</kbd>/<kbd>E</kbd>, <kbd>−</kbd>/<kbd>+</kbd>, or the on-screen controls
to change power. Press <kbd>Space</kbd> or **Fire** to shoot. Pointer and touch
players can use all visible buttons; in local mode they may also drag the active
tank horizontally. The weapon selector chooses available ammunition. **Enter
full screen** adds movement, aim, power, weapon, fire, and exit controls over
the arena.

## Results and achievements

Battle Tanks result details use a versioned schema. Common fields are `mode`,
`winner`, `turns`, `shots`, `hits`, derived `accuracy`, `seconds`, and
`damageTaken`. Bounded optional aggregates are `weapons`, `splashDamage`,
`healing`, `powerUps`, `powerUpsAcquired`, `powerUpsUsed`,
`powerUpTypesUsed`, `shieldDamageAbsorbed`, `healthRestored`,
`invisibilityActivations`, `laserRicochetHits`, `laserSelfDamage`,
`homingHits`, `heavyProjectileMaxDamage`, and `poweredHits`. Weapon and
power-up keys use the stable IDs above. Online values are produced by the room
server; local values are validated but inherently less trusted.

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
