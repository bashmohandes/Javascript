'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../battle-tanks/scripts/game');

function match(seed = 12345) { const state = game.createInitialState(seed); game.beginTurn(state); return state; }
function finish(state, limit = 5000, dt = 1 / 120) {
    let hit = null;
    for (let index = 0; index < limit && state.phase === 'projectile-flight'; index += 1) hit = game.stepPhysics(state, dt) || hit;
    return hit;
}

test('a new match puts player one and player two on opposite sides', () => {
    const state = match();
    assert.equal(state.activePlayer, 0); assert.equal(state.phase, 'aiming');
    assert.ok(state.tanks[0].x + game.TANK_W <= state.arena.barrier.x);
    assert.ok(state.tanks[1].x >= state.arena.barrier.x + state.arena.barrier.w);
});

test('movement clamps each tank to its side of the central barrier', () => {
    const state = match();
    game.moveTank(state, 'forward', 10000);
    assert.equal(state.tanks[0].x, state.arena.barrier.x - game.TANK_W);
    state.activePlayer = 1; game.moveTank(state, 'forward', 10000);
    assert.equal(state.tanks[1].x, state.arena.barrier.x + state.arena.barrier.w);
});

test('angle and power controls enforce their documented ranges', () => {
    const state = match(); game.adjustAim(state, -1000); game.adjustPower(state, -1000);
    assert.equal(state.tanks[0].angle, 10); assert.equal(state.tanks[0].power, 20);
    game.adjustAim(state, 1000); game.adjustPower(state, 1000);
    assert.equal(state.tanks[0].angle, 80); assert.equal(state.tanks[0].power, 100);
});

test('gravity bends a projectile through a rising and falling arc', () => {
    const state = match(); state.tanks[0].angle = 80; state.tanks[0].power = 20; game.fireProjectile(state);
    const points = [state.projectile.y];
    for (let index = 0; index < 300 && state.phase === 'projectile-flight'; index += 1) {
        game.stepPhysics(state); if (state.projectile) points.push(state.projectile.y);
    }
    const apex = Math.min(...points), apexIndex = points.indexOf(apex);
    assert.ok(apexIndex > 0 && apexIndex < points.length - 1, 'the apex should occur between launch and landing');
    assert.ok(points[apexIndex - 1] > apex && points[apexIndex + 1] > apex);
});

test('a low shot collides with the central barrier', () => {
    const state = match(), barrier = state.arena.barrier;
    assert.deepEqual(game.collisionAt(state, barrier.x - game.PROJECTILE_R, barrier.y + 20), { type: 'barrier' });
});

test('a sufficiently high shot clears the central barrier', () => {
    const state = match(); state.tanks[0].angle = 45; state.tanks[0].power = 100; game.fireProjectile(state);
    let crossedAboveBarrier = false;
    while (state.phase === 'projectile-flight') {
        game.stepPhysics(state);
        if (state.projectile && state.projectile.x >= state.arena.barrier.x && state.projectile.x <= state.arena.barrier.x + state.arena.barrier.w) {
            crossedAboveBarrier ||= state.projectile.y + game.PROJECTILE_R < state.arena.barrier.y;
        }
    }
    assert.equal(crossedAboveBarrier, true);
});

test('a direct collision applies full explosion damage to the target tank', () => {
    const state = match(), target = state.tanks[1];
    state.projectile = { x: target.x - 20, y: target.y + game.TANK_H / 2, vx: 200, vy: 0, owner: 0 }; state.phase = 'projectile-flight';
    assert.deepEqual(game.stepPhysics(state, 0.2), { type: 'tank', index: 1 });
    assert.deepEqual(state.tanks.map(tank => tank.health), [100, 50]);
    assert.equal(state.lastImpact.type, 'tank'); assert.equal(state.impacts.length, 1);
    assert.deepEqual(state.lastImpact.affected.map(item => [item.tank, item.healthDamage]), [[1, 50]]);
});

test('missed shots leave bounded impact residue in the arena', () => {
    const state = match();
    for (let shot = 0; shot < 18; shot += 1) {
        const x = 250 + shot, ground = game.terrainHeightAt(state.arena, x);
        state.projectile = { x, y: ground - 2, vx: 0, vy: 20, owner: state.activePlayer };
        state.phase = 'projectile-flight'; game.stepPhysics(state);
    }
    assert.equal(state.lastImpact.type, 'terrain');
    assert.equal(state.impacts.length, 14, 'old residue should be discarded to keep rendering bounded');
    assert.equal(state.impactSerial, 18);
});

test('all player inputs are ignored during projectile flight', () => {
    const state = match(); game.fireProjectile(state); const tank = { ...state.tanks[0] };
    assert.equal(game.moveTank(state, 'forward'), false); assert.equal(game.adjustAim(state, 5), false); assert.equal(game.adjustPower(state, 5), false); assert.equal(game.fireProjectile(state), false);
    assert.deepEqual(state.tanks[0], tank); assert.equal(state.shots, 1);
});

test('a miss resolves and advances exactly one turn', () => {
    const state = match(); state.projectile = { x: 10, y: 100, vx: -1000, vy: 0, owner: 0 }; state.phase = 'projectile-flight';
    assert.equal(finish(state, 10, 1).type, 'out-of-bounds'); assert.equal(state.activePlayer, 1);
    assert.equal(game.stepPhysics(state, 1), null); assert.equal(state.activePlayer, 1);
});

test('an out-of-bounds miss does not announce damage from the previous impact', () => {
    const state = match(); state.lastImpact = { serial: 1, totalDamage: 50 };
    state.projectile = { x: -10, y: 100, vx: -100, vy: 0, owner: 0 }; state.phase = 'projectile-flight';
    game.resolveShot(state, { type: 'out-of-bounds' });
    assert.equal(state.announcement, "Shot ended. Player 2's turn.");
});

test('lethal damage ends the match without advancing the turn', () => {
    const state = match(), target = state.tanks[1]; state.tanks[1].health = game.DAMAGE; state.projectile = { x: target.x, y: target.y, vx: 0, vy: 0, owner: 0, weapon: game.DEFAULT_WEAPON }; state.phase = 'projectile-flight';
    game.resolveShot(state, { type: 'tank', index: 1 });
    assert.equal(state.phase, 'game-over'); assert.equal(state.winner, 0); assert.equal(state.activePlayer, 0);
});

test('rematch resets match state and counters', () => {
    const state = match(), initial = match(); Object.assign(state, { activePlayer: 1, shots: 9, hits: 2, winner: 1, resultSubmitted: true }); state.tanks[0].x = 3; state.tanks[0].health = 0; state.projectile = {}; state.phase = 'game-over';
    game.resetMatch(state, 12345);
    assert.deepEqual(state.tanks, initial.tanks); assert.equal(state.projectile, null); assert.equal(state.shots, 0); assert.equal(state.hits, 0); assert.equal(state.activePlayer, 0); assert.equal(state.winner, null); assert.equal(state.resultSubmitted, false); assert.equal(state.phase, 'aiming');
});

test('large elapsed-time updates sweep collisions instead of tunneling', () => {
    const state = match(), barrier = state.arena.barrier; state.projectile = { x: barrier.x - 300, y: barrier.y + 30, vx: 1000, vy: 0, owner: 0 }; state.phase = 'projectile-flight';
    assert.equal(game.stepPhysics(state, 0.3).type, 'barrier'); assert.equal(state.activePlayer, 1);
});

test('invalid elapsed-time updates leave a projectile unchanged', () => {
    const state = match(); game.fireProjectile(state); const projectile = { ...state.projectile };
    assert.equal(game.stepPhysics(state, Number.NaN), null); assert.deepEqual(state.projectile, projectile);
    assert.equal(game.stepPhysics(state, -1), null); assert.deepEqual(state.projectile, projectile);
});

test('arena generation is deterministic, bounded, variable, and keeps safe spawn pads', () => {
    assert.deepEqual(game.generateArena('same arena'), game.generateArena('same arena'));
    const arenas = Array.from({ length: 20 }, (_, seed) => game.generateArena(seed));
    assert.ok(new Set(arenas.map(arena => arena.barrier.w)).size > 1);
    assert.ok(new Set(arenas.map(arena => arena.barrier.h)).size > 1);
    for (const arena of arenas) {
        const { barrier } = arena, limits = game.ARENA_LIMITS;
        assert.ok(barrier.w >= limits.barrierWidthMin && barrier.w <= limits.barrierWidthMax);
        assert.ok(barrier.h >= limits.barrierHeightMin && barrier.h <= limits.barrierHeightMax);
        assert.ok(barrier.x >= limits.sideSpaceMin && game.WIDTH - barrier.x - barrier.w >= limits.sideSpaceMin);
        assert.equal(game.terrainHeightAt(arena, 80), game.terrainHeightAt(arena, 320));
        assert.equal(game.terrainHeightAt(arena, game.WIDTH - 320), game.terrainHeightAt(arena, game.WIDTH - 80));
    }
});

test('spawn pads blend into nearby terrain without abrupt tank-height jumps', () => {
    const arena = game.generateArena(97252);
    for (const [from, to] of [[0, 408], [game.WIDTH - 408, game.WIDTH]]) {
        for (let x = from + game.TERRAIN_STEP; x <= to; x += game.TERRAIN_STEP) {
            const change = Math.abs(game.terrainHeightAt(arena, x) - game.terrainHeightAt(arena, x - game.TERRAIN_STEP));
            assert.ok(change < 12, `terrain changed ${change}px between ${x - game.TERRAIN_STEP} and ${x}`);
        }
    }
});

test('barrier bottom reaches the terrain across its complete footprint', () => {
    const state = match(33298), { barrier } = state.arena, bottom = barrier.y + barrier.h;
    for (let x = barrier.x; x <= barrier.x + barrier.w; x += 1) {
        assert.ok(bottom >= game.terrainHeightAt(state.arena, x), `barrier floats above terrain at ${x}`);
    }
    const x = barrier.x + barrier.w / 2;
    assert.deepEqual(game.collisionAt(state, x, bottom - game.PROJECTILE_R), { type: 'barrier' });
});

test('movement follows slopes and terrain collision uses the local height profile', () => {
    const state = match(77), tank = state.tanks[0];
    game.moveTank(state, 'forward', 150);
    assert.equal(tank.y, game.tankYAt(state, tank));
    const x = 330, ground = game.terrainHeightAt(state.arena, x);
    assert.equal(game.collisionAt(state, x, ground - game.PROJECTILE_R + .1).type, 'terrain');
    assert.equal(game.collisionAt(state, x, ground - game.PROJECTILE_R - 1), null);
});

test('snapshots deep-serialize the complete match arena', () => {
    const state = match(987), copy = game.snapshot(state);
    assert.deepEqual(copy.arena, state.arena);
    copy.arena.terrain[0] += 1; copy.arena.barrier.x += 1;
    assert.notDeepEqual(copy.arena, state.arena);
});

test('Battle Tanks snapshots restore deterministic local state and Set-backed statistics', () => {
    const state = match('cloud-save'), tank = state.tanks[0];
    state.pickups = [{ id: 'shield', x: tank.x + game.TANK_W / 2, y: tank.y + game.TANK_H }];
    game.collectPickup(state, 0); const generated = { ...state.acquiredValues[0][0] }; game.adjustAim(state, 4); game.moveTank(state, 'forward', 20);
    const encoded = JSON.parse(JSON.stringify(game.snapshot(state))), restored = game.restoreSnapshot(encoded);
    assert.deepEqual(game.snapshot(restored), encoded); assert.ok(restored.statistics.powerUpTypesUsed[0] instanceof Set); assert.equal(restored.onlineMode, false); assert.equal(restored.resultSubmitted, false);
    game.activatePowerUp(restored, 0, 'shield', () => { throw new Error('restored power-up must not reroll'); });
    assert.equal(restored.activeEffects[0][0].remainingCapacity, generated.capacity); assert.equal(restored.activeEffects[0][0].remainingTurns, generated.durationTurns);
    const invalid = structuredClone(encoded); invalid.tanks[0].health = 101;
    assert.throws(() => game.restoreSnapshot(invalid), /Invalid Battle Tanks save state/);
    const invalidGenerated = structuredClone(encoded); invalidGenerated.acquiredValues[0][0].capacity = 1000;
    assert.throws(() => game.restoreSnapshot(invalidGenerated), /Invalid Battle Tanks save state/);
    const legacy = structuredClone(encoded); delete legacy.acquiredValues; const upgraded = game.restoreSnapshot(legacy);
    assert.deepEqual(upgraded.acquiredValues[0][0], generated); assert.doesNotThrow(() => game.restoreSnapshot(JSON.parse(JSON.stringify(game.snapshot(upgraded)))));
});

test('terrain explosions carve projectile-sized craters in bounded samples', () => {
    const state = match(321), x = 240, before = [...state.arena.terrain];
    game.resolveExplosion(state, { x, y: game.terrainHeightAt(state.arena, x) - game.PROJECTILE_R }, { radius: 24, depth: 30 }, 'terrain');
    const center = Math.round(x / game.TERRAIN_STEP);
    assert.ok(state.arena.terrain[center] > before[center]);
    assert.equal(state.arena.terrain[center - 4], before[center - 4]);
    assert.equal(state.arena.terrain[center + 4], before[center + 4]);
});

test('barrier explosions remove collision material and permit a later projectile', () => {
    const state = match(654), barrier = state.arena.barrier, point = { x: barrier.x + barrier.w / 2, y: barrier.y + 45 };
    assert.equal(game.collisionAt(state, point.x, point.y).type, 'barrier');
    game.resolveExplosion(state, point, { radius: 22, depth: 10 }, 'barrier');
    assert.equal(game.barrierOccupiedAt(barrier, point.x, point.y), false);
    assert.equal(game.collisionAt(state, point.x, point.y), null, 'the next projectile can traverse the authoritative hole');
});

test('tanks settle down when a crater removes their support', () => {
    const state = match(777), tank = state.tanks[0], oldY = tank.y, x = tank.x + game.TANK_W / 2;
    game.resolveExplosion(state, { x, y: game.terrainHeightAt(state.arena, x) - game.PROJECTILE_R }, { radius: 40, depth: 26 }, 'terrain');
    assert.ok(tank.y > oldY);
    assert.equal(tank.y, game.tankYAt(state, tank));
});

test('edge craters clamp deformation to valid arena samples', () => {
    const state = match(888), length = state.arena.terrain.length;
    assert.doesNotThrow(() => game.resolveExplosion(state, { x: -10, y: 450 }, { radius: 40, depth: 1000 }, 'terrain'));
    assert.equal(state.arena.terrain.length, length);
    assert.ok(state.arena.terrain.every(height => height >= 0 && height <= game.HEIGHT));
    assert.equal(Object.hasOwn(state.arena.terrain, '-1'), false);
});

test('reset creates an explicit boundary that discards all deformation', () => {
    const state = match(999), original = game.generateArena(999), barrier = state.arena.barrier;
    game.resolveExplosion(state, { x: 120, y: game.terrainHeightAt(state.arena, 120) }, { radius: 30, depth: 30 }, 'terrain');
    game.resolveExplosion(state, { x: barrier.x + barrier.w / 2, y: barrier.y + 30 }, { radius: 24, depth: 20 }, 'barrier');
    game.resetMatch(state, 999);
    assert.deepEqual(state.arena, original);
    assert.equal(state.impacts.length, 0);
    assert.equal(state.impactSerial, 0);
});


test('near misses fall off and the blast-radius edge deals no damage', () => {
    const state = match(), target = state.tanks[1], radius = 50;
    const near = game.resolveExplosion(state, { x: target.x - 25, y: target.y + game.TANK_H / 2, type: 'tank' }, { owner: 0, weapon: { ...game.DEFAULT_WEAPON, blastRadius: radius } });
    assert.ok(near.affected[0].healthDamage > 0 && near.affected[0].healthDamage < game.DAMAGE);
    const health = target.health;
    const edge = game.resolveExplosion(state, { x: target.x - radius, y: target.y + game.TANK_H / 2, type: 'tank' }, { owner: 0, weapon: { ...game.DEFAULT_WEAPON, blastRadius: radius } });
    assert.equal(edge.affected.length, 0); assert.equal(target.health, health);
});

test('splash damages the shooter and records detailed distances', () => {
    const state = match(), shooter = state.tanks[0];
    const result = game.resolveExplosion(state, { x: shooter.x + game.TANK_W + 10, y: shooter.y + game.TANK_H / 2, type: 'terrain' }, { owner: 0, weapon: game.DEFAULT_WEAPON });
    assert.ok(shooter.health < game.STARTING_HEALTH);
    assert.deepEqual(Object.keys(result.affected[0]).sort(), ['absorbedDamage', 'attemptedDamage', 'distance', 'healthDamage', 'source', 'tank']);
    assert.equal(result.affected[0].tank, 0); assert.equal(result.affected[0].distance, 10);
});

test('weapon strength changes damage independently of aiming power', () => {
    const weakState = match(), strongState = match(), weakTank = weakState.tanks[1], strongTank = strongState.tanks[1];
    const point = tank => ({ x: tank.x, y: tank.y, type: 'tank' });
    const weak = game.resolveExplosion(weakState, point(weakTank), { vx: 100, owner: 0, weapon: { ...game.DEFAULT_WEAPON, baseDamage: 20 } });
    const strong = game.resolveExplosion(strongState, point(strongTank), { vx: 100, owner: 0, weapon: { ...game.DEFAULT_WEAPON, baseDamage: 40 } });
    assert.equal(weak.totalDamage, 20); assert.equal(strong.totalDamage, 40);
    weakState.tanks[0].power = 20; strongState.tanks[0].power = 100;
    assert.equal(weak.weapon.powerMultiplier, strong.weapon.powerMultiplier);
});

test('wide blast damages tanks well outside the standard shell radius', () => {
    const standardState = match(), wideState = match(), standardTarget = standardState.tanks[1], wideTarget = wideState.tanks[1];
    const impact = tank => ({ x: tank.x - 90, y: tank.y + game.TANK_H / 2, type: 'terrain' });
    game.fireProjectile(standardState); Object.assign(standardState.projectile, impact(standardTarget)); game.resolveShot(standardState, { type: 'terrain' });
    wideState.weaponAmmo[0]['wide-blast'] = 1; game.selectWeapon(wideState, 0, 'wide-blast'); game.fireProjectile(wideState); Object.assign(wideState.projectile, impact(wideTarget));
    assert.equal(wideState.projectile.weapon.id, 'wide-blast'); assert.equal(wideState.projectile.weapon.blastRadius, game.WEAPON_REGISTRY['wide-blast'].blastRadius);
    game.resolveShot(wideState, { type: 'terrain' });
    assert.equal(standardState.lastImpact.totalDamage, 0);
    assert.ok(wideState.lastImpact.totalDamage > 0);
    assert.ok(wideTarget.health < game.STARTING_HEALTH);
});

test('applyDamage fully absorbs damage and itemizes its source', () => {
    const state = match(); state.activeEffects[1].push({ id: 'shield', effect: 'absorb', remainingTurns: 2, remainingCapacity: 30 });
    const result = game.applyDamage(state, 1, 20, 'falling debris');
    assert.deepEqual(result, { tank: 1, source: 'falling debris', attemptedDamage: 20, absorbedDamage: 20, healthDamage: 0 });
    assert.equal(state.tanks[1].health, 100); assert.equal(state.activeEffects[1][0].remainingCapacity, 10);
});

test('applyDamage sends shield overflow to health and removes exhausted capacity', () => {
    const state = match(); state.activeEffects[1].push({ id: 'shield', effect: 'absorb', remainingTurns: 2, remainingCapacity: 30 });
    const result = game.applyDamage(state, 1, 50, { type: 'explosion', owner: 0 });
    assert.equal(result.absorbedDamage, 30); assert.equal(result.healthDamage, 20);
    assert.equal(state.tanks[1].health, 80); assert.deepEqual(state.activeEffects[1], []);
});

test('applyDamage consumes multiple active shields before damaging health', () => {
    const state = match();
    state.activeEffects[1].push(
        { id: 'shield-1', effect: 'absorb', remainingTurns: 3, remainingCapacity: 10 },
        { id: 'shield-2', effect: 'absorb', remainingTurns: 2, remainingCapacity: 30 }
    );
    const result = game.applyDamage(state, 1, 25, 'combined shields');
    assert.deepEqual(result, { tank: 1, source: 'combined shields', attemptedDamage: 25, absorbedDamage: 25, healthDamage: 0 });
    assert.equal(state.tanks[1].health, 100);
    assert.deepEqual(state.activeEffects[1], [{ id: 'shield-2', effect: 'absorb', remainingTurns: 2, remainingCapacity: 15 }]);
});

test('simultaneous destruction is an explicit draw', () => {
    const state = match(), left = state.tanks[0], right = state.tanks[1];
    right.x = left.x + game.TANK_W + 2; right.y = left.y; left.health = 10; right.health = 10;
    state.projectile = { x: left.x + game.TANK_W + 1, y: left.y + game.TANK_H / 2, vx: 0, vy: 0, owner: 0, weapon: game.DEFAULT_WEAPON }; state.phase = 'projectile-flight';
    game.resolveShot(state, { type: 'tank', index: 1 });
    assert.equal(state.phase, 'game-over'); assert.equal(state.draw, true); assert.equal(state.winner, null);
});

test('fired projectiles carry an immutable complete weapon payload', () => {
    const state = match(); game.fireProjectile(state);
    assert.equal(Object.isFrozen(state.projectile.weapon), true);
    for (const key of ['baseDamage', 'blastRadius', 'terrainDamage', 'powerMultiplier', 'velocityMultiplier']) assert.equal(Number.isFinite(state.projectile.weapon[key]), true);
    assert.throws(() => { state.projectile.weapon.baseDamage = 999; }, TypeError);
});

test('power-up spawning is seeded, bounded, and uses valid exposed terrain', () => {
    const left = match('pickups'), right = match('pickups');
    for (let turn = 0; turn < 30; turn += 1) { game.advancePickupSchedule(left); game.advancePickupSchedule(right); }
    assert.deepEqual(left.pickups, right.pickups);
    assert.ok(left.pickups.length <= game.MAX_PICKUPS);
    left.pickups.forEach(item => assert.equal(game.isValidPickupPosition({ ...left, pickups: left.pickups.filter(other => other !== item) }, item.x), true));
});

test('local pickup scheduling excludes online-only items and continues in long matches', () => {
    const state = match('long-local-match');
    assert.equal(game.spawnPickup(state, 'invisibility'), null);
    for (let turn = 0; turn < 60; turn += 1) {
        const pickup = game.advancePickupSchedule(state);
        if (pickup) {
            assert.notEqual(pickup.id, 'invisibility');
            state.pickups.length = 0;
        }
    }
    assert.ok(state.spawnSerial > 6, 'pickups should continue spawning after the old 18-turn limit');
});

test('movement collects overlapping pickups up to the inventory limit', () => {
    const state = match(4), tank = state.tanks[0];
    for (let index = 0; index < 4; index += 1) state.pickups.push({ serial: index, id: 'health-pack', x: tank.x + game.TANK_W / 2, y: tank.y + game.TANK_H });
    game.moveTank(state, 'forward', 0);
    assert.equal(state.inventories[0].length, game.INVENTORY_LIMIT);
    assert.equal(state.pickups.length, 1);
});

test('activation caps healing and tracks turn-based effects and absorption', () => {
    const state = match(5); state.tanks[0].health = 90; state.inventories[0].push('health-pack', 'shield', 'invisibility');
    assert.equal(game.activatePowerUp(state, 0, 'health-pack').consumesTurn, false); assert.equal(state.tanks[0].health, 100);
    game.activatePowerUp(state, 0, 'shield', () => 0); const shield = state.activeEffects[0].find(item => item.effect === 'absorb'); assert.deepEqual([shield.remainingTurns, shield.remainingCapacity], [2, 40]);
    game.activatePowerUp(state, 0, 'invisibility', () => .5); assert.equal(state.activeEffects[0].find(item => item.effect === 'invisible').remainingTurns, 2);
    game.beginTurnEffects(state, 0); game.beginTurnEffects(state, 0);
    assert.equal(state.activeEffects[0].some(item => item.effect === 'invisible'), false);
});

test('every power-up preserves the active turn', () => {
    for (const id of Object.keys(game.POWER_UP_CATALOG)) {
        const state = match(`turn-preserving-${id}`); state.inventories[0].push(id);
        const result = game.activatePowerUp(state, 0, id, () => 0);
        assert.equal(result.consumesTurn, false, `${id} should not consume the turn`);
        assert.equal(state.activePlayer, 0); assert.equal(state.phase, 'aiming'); assert.equal(state.completedTurns, 0);
    }
});

test('shield duration expires after the protected player completes turns', () => {
    const state = match(); state.activeEffects[0].push({ id: 'shield', effect: 'absorb', remainingTurns: 2, remainingCapacity: 50 });
    game.endTurnEffects(state, 1); assert.equal(state.activeEffects[0][0].remainingTurns, 2);
    game.endTurnEffects(state, 0); assert.equal(state.activeEffects[0][0].remainingTurns, 1);
    game.endTurnEffects(state, 0); assert.deepEqual(state.activeEffects[0], []);
});

test('self-damage and repeated damage sources share the shield capacity', () => {
    const state = match(); state.activeEffects[0].push({ id: 'shield', effect: 'absorb', remainingTurns: 3, remainingCapacity: 25 });
    const first = game.applyDamage(state, 0, 15, { type: 'explosion', owner: 0 });
    const second = game.applyDamage(state, 0, 20, { type: 'environment', event: 'debris' });
    assert.equal(first.absorbedDamage, 15); assert.equal(second.absorbedDamage, 10); assert.equal(second.healthDamage, 10); assert.equal(state.tanks[0].health, 90);
});

test('rematch clears every pickup, inventory, weapon, and active effect', () => {
    const state = match(6); state.pickups.push({ id: 'shield', x: 200, y: 400 }); state.inventories[0].push('shield'); state.equippedWeapons[0] = 'weapon-heavy-shell'; state.activeEffects[0].push({ id: 'shield', effect: 'absorb', remainingTurns: 1, remainingCapacity: 10 }); state.effectSerial = 8;
    game.resetMatch(state, 6);
    assert.deepEqual([state.pickups, state.inventories, state.equippedWeapons, state.activeEffects], [[], [[], []], [null, null], [[], []]]); assert.equal(state.effectSerial, 0);
});

test('weapon registry defines complete, id-driven launch, damage, terrain, ammo, and strategies', () => {
    const expected = { shell: 'ballistic', 'wide-blast': 'ballistic', 'heavy-shell': 'ballistic', homing: 'homing', laser: 'ray' };
    for (const [id, strategy] of Object.entries(expected)) {
        const weapon = game.WEAPON_REGISTRY[id];
        assert.equal(weapon.id, id); assert.equal(weapon.strategy, strategy);
        assert.ok(Number.isFinite(weapon.launch.mass)); assert.ok(Number.isFinite(weapon.baseDamage));
        assert.ok(Number.isFinite(weapon.blastRadius)); assert.ok(Number.isFinite(weapon.terrainDamage));
        assert.equal(typeof weapon.ammo.unlimited, 'boolean');
    }
    const standard = game.WEAPON_REGISTRY.shell, wide = game.WEAPON_REGISTRY['wide-blast'], heavy = game.WEAPON_REGISTRY['heavy-shell'];
    assert.ok(wide.blastRadius >= standard.blastRadius * 2); assert.ok(wide.baseDamage < standard.baseDamage);
    assert.ok(heavy.launch.mass > standard.launch.mass); assert.ok(heavy.launch.powerSpeed < standard.launch.powerSpeed);
    assert.ok(heavy.baseDamage > standard.baseDamage); assert.ok(heavy.blastRadius > standard.blastRadius); assert.ok(heavy.terrainDamage > standard.terrainDamage);
    assert.equal(heavy.launch.maximumPower, 100);
});

test('homing steering is bounded and refuses invisible targets', () => {
    const state = match(); state.weaponAmmo[0].homing = 1; game.selectWeapon(state, 0, 'homing'); game.fireProjectile(state);
    const before = Math.atan2(state.projectile.vy, state.projectile.vx), rate = game.WEAPON_REGISTRY.homing.homing.turnRate;
    state.projectile.age = game.WEAPON_REGISTRY.homing.homing.lockDelay; state.projectile.x = state.tanks[1].x - 200; state.projectile.y = state.tanks[1].y - 100;
    game.stepPhysics(state, 1 / 120); const after = Math.atan2(state.projectile.vy, state.projectile.vx);
    assert.ok(Math.abs(Math.atan2(Math.sin(after - before), Math.cos(after - before))) <= rate / 120 + 1e-9);
    const hidden = match(); hidden.weaponAmmo[0].homing = 1; hidden.activeEffects[1].push({ effect: 'invisible', remainingTurns: 1 }); game.selectWeapon(hidden, 0, 'homing'); game.fireProjectile(hidden); hidden.projectile.age = 1; game.stepPhysics(hidden, 1 / 120); assert.equal(hidden.projectile.target, null);
});

test('homing missiles clear an intact barrier from either side before pursuing the target', () => {
    for (const seed of [1, 123]) for (const side of [0, 1]) for (const [angle, power] of [[10, 20], [45, 60], [80, 20], [80, 100]]) {
        const state = match(seed); game.beginTurn(state, side); state.tanks[side].angle = angle; state.tanks[side].power = power; state.weaponAmmo[side].homing = 1; game.selectWeapon(state, side, 'homing'); game.fireProjectile(state);
        let clearedAbove = false;
        for (let step = 0; step < 2400 && state.phase === 'projectile-flight'; step += 1) { const projectile = state.projectile, barrier = state.arena.barrier; if (projectile.x >= barrier.x - game.PROJECTILE_R && projectile.x <= barrier.x + barrier.w + game.PROJECTILE_R && projectile.y + game.PROJECTILE_R < barrier.y) clearedAbove = true; game.stepPhysics(state, 1 / 120); }
        assert.equal(clearedAbove, true, `side ${side} should clear seed ${seed} at ${angle}°/${power}%`);
        assert.equal(state.lastImpact?.type, 'tank'); assert.ok(state.tanks[1 - side].health < game.STARTING_HEALTH);
    }
});

test('homing missiles pursue directly when no barrier cells remain', () => {
    const state = match(9); state.arena.barrier.cells.fill(0); state.weaponAmmo[0].homing = 1; game.selectWeapon(state, 0, 'homing'); game.fireProjectile(state);
    for (let step = 0; step < 2400 && state.phase === 'projectile-flight'; step += 1) game.stepPhysics(state, 1 / 120);
    assert.equal(state.lastImpact?.type, 'tank'); assert.ok(state.tanks[1].health < game.STARTING_HEALTH);
});

test('laser snapshots preserve bounded authoritative segments and reflections', () => {
    const state = match(1); state.weaponAmmo[0].laser = 1; state.tanks[0].angle = 31; game.selectWeapon(state, 0, 'laser'); game.fireProjectile(state);
    const path = state.laserPath, config = game.WEAPON_REGISTRY.laser.ray;
    assert.ok(path.segments.length <= config.maxBounces + 1); assert.ok(path.totalDistance <= config.maxDistance + 1e-6);
    const copy = game.snapshot(state); assert.deepEqual(copy.laserPath, path); if (copy.laserPath.segments.length) { copy.laserPath.segments[0].from.x += 1; assert.notEqual(copy.laserPath.segments[0].from.x, path.segments[0].from.x); }
    assert.ok(path.segments.every(segment => segment.hit && Number.isFinite(segment.energy)));
    assert.ok(path.segments.length > 1, 'the generated arena produces at least one reflected segment');
});

test('expanded arena and crates use the high-resolution world dimensions', () => {
    assert.equal(game.WIDTH, 1440); assert.equal(game.HEIGHT, 810);
    assert.ok(game.PICKUP_SIZE >= 48); assert.ok(game.ARENA_LIMITS.sideSpaceMin >= 570);
});

test('laser resolution uses the fired projectile damage modifiers', () => {
    const state = match(); state.tanks[1] = { ...state.tanks[1], x: 550, y: 100 };
    state.projectile = { x: 500, y: 110, vx: 1, vy: 0, owner: 0, weapon: { ...game.DEFAULT_WEAPON, id: 'laser', baseDamage: 51 } };
    state.phase = 'projectile-flight';
    game.resolveLaser(state, state.projectile);
    assert.equal(state.tanks[1].health, 49);
    assert.equal(state.lastImpact.affected[0].attemptedDamage, 51);
});

test('acquisition events are monotonic, bounded, generated, safe, and reset with a match', () => {
    const state = match('acquisitions'), tank = state.tanks[0];
    for (let index = 0; index < game.ACQUISITION_HISTORY_LIMIT + 3; index += 1) {
        state.inventories[0].length = 0;
        state.pickups = [{ serial: index, id: index === 0 ? 'shield' : 'health-pack', x: tank.x + game.TANK_W / 2, y: tank.y + game.TANK_H }];
        game.collectPickup(state, 0);
    }
    assert.equal(state.acquisitionEventId, game.ACQUISITION_HISTORY_LIMIT + 3);
    assert.equal(state.acquisitionEvents.length, game.ACQUISITION_HISTORY_LIMIT);
    assert.deepEqual(state.acquisitionEvents.map(event => event.eventId), [4, 5, 6, 7, 8, 9, 10, 11]);
    const shieldState = match('shield-event'); shieldState.pickups = [{ id: 'shield', x: shieldState.tanks[0].x + game.TANK_W / 2, y: shieldState.tanks[0].y + game.TANK_H }]; game.collectPickup(shieldState, 0);
    const event = shieldState.acquisitionEvents[0]; assert.ok(event.generatedValues.capacity >= 40 && event.generatedValues.capacity <= 60); assert.ok(event.generatedValues.durationTurns >= 2 && event.generatedValues.durationTurns <= 4); assert.equal('x' in event, false);
    game.resetMatch(state); assert.equal(state.acquisitionEventId, 0); assert.deepEqual(state.acquisitionEvents, []);
});

test('collecting homing ammo emits the complete announcement event as well as inventory', () => {
    const state = match('homing-acquisition'), tank = state.tanks[0];
    state.pickups = [{ id: 'weapon-homing', x: tank.x + game.TANK_W / 2, y: tank.y + game.TANK_H }];
    assert.deepEqual(game.collectPickup(state, 0), ['weapon-homing']); assert.deepEqual(state.inventories[0], ['weapon-homing']);
    assert.deepEqual(state.acquisitionEvents[0], { eventId: 1, player: 0, powerUpType: 'weapon-homing', displayName: 'Homing missile ammo', effectDescription: 'adds homing missile ammunition', iconKey: 'homing', rarity: 'rare', theme: 'weapon', generatedValues: { ammunition: 2 } });
});

test('authoritative power-up statistics credit successful mechanics and reset', () => {
    const state = match(), tank = state.tanks[0];
    state.pickups = [{ id: 'health-pack', x: tank.x + game.TANK_W / 2, y: game.terrainHeightAt(state.arena, tank.x + game.TANK_W / 2) }];
    game.collectPickup(state, 0); assert.equal(state.statistics.powerUpsAcquired[0], 1); assert.equal(state.statistics.powerUpsAcquired[1], 0);
    tank.health = 80; game.activatePowerUp(state, 0, 'health-pack'); assert.equal(state.statistics.healthRestored[0], 20); assert.deepEqual([...state.statistics.powerUpTypesUsed[0]], ['health-pack']);
    state.activeEffects[1].push({ id: 'shield', effect: 'absorb', remainingTurns: 2, remainingCapacity: 50 }); game.applyDamage(state, 1, 30); assert.equal(state.statistics.shieldDamageAbsorbed[1], 30);
    assert.equal(state.statistics.homingHits[0], 0, 'equipping or missing never credits a hit');
    game.resetMatch(state, 123); for (const values of Object.values(state.statistics)) for (const value of values) assert.equal(value instanceof Set ? value.size : typeof value === 'object' ? Object.keys(value).length : value, 0);
});
