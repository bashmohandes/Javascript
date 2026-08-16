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

test('a direct collision damages only the target tank', () => {
    const state = match(), target = state.tanks[1];
    state.projectile = { x: target.x - 20, y: target.y + game.TANK_H / 2, vx: 200, vy: 0, owner: 0 }; state.phase = 'projectile-flight';
    assert.deepEqual(game.stepPhysics(state, 0.2), { type: 'tank', index: 1 });
    assert.deepEqual(state.tanks.map(tank => tank.health), [100, 50]);
    assert.equal(state.lastImpact.type, 'tank'); assert.equal(state.impacts.length, 0);
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

test('lethal damage ends the match without advancing the turn', () => {
    const state = match(); state.tanks[1].health = game.DAMAGE; state.projectile = {}; state.phase = 'projectile-flight';
    game.resolveShot(state, { type: 'tank', index: 1 });
    assert.equal(state.phase, 'game-over'); assert.equal(state.winner, 0); assert.equal(state.activePlayer, 0);
});

test('rematch resets match state and counters', () => {
    const state = match(), initial = match(); Object.assign(state, { activePlayer: 1, shots: 9, hits: 2, winner: 1, resultSubmitted: true }); state.tanks[0].x = 3; state.tanks[0].health = 0; state.projectile = {}; state.phase = 'game-over';
    game.resetMatch(state, 12345);
    assert.deepEqual(state.tanks, initial.tanks); assert.equal(state.projectile, null); assert.equal(state.shots, 0); assert.equal(state.hits, 0); assert.equal(state.activePlayer, 0); assert.equal(state.winner, null); assert.equal(state.resultSubmitted, false); assert.equal(state.phase, 'aiming');
});

test('large elapsed-time updates sweep collisions instead of tunneling', () => {
    const state = match(); state.projectile = { x: 300, y: 300, vx: 1000, vy: 0, owner: 0 }; state.phase = 'projectile-flight';
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
        assert.equal(game.terrainHeightAt(arena, 80), game.terrainHeightAt(arena, 220));
        assert.equal(game.terrainHeightAt(arena, 740), game.terrainHeightAt(arena, 880));
    }
});

test('spawn pads blend into nearby terrain without abrupt tank-height jumps', () => {
    const arena = game.generateArena(97252);
    for (const [from, to] of [[0, 320], [640, game.WIDTH]]) {
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
