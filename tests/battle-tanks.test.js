'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const game = require('../battle-tanks/scripts/game');

function match() { const state = game.createInitialState(); game.beginTurn(state); return state; }
function finish(state, limit = 5000, dt = 1 / 120) {
    let hit = null;
    for (let index = 0; index < limit && state.phase === 'projectile-flight'; index += 1) hit = game.stepPhysics(state, dt) || hit;
    return hit;
}

test('a new match puts player one and player two on opposite sides', () => {
    const state = match();
    assert.equal(state.activePlayer, 0); assert.equal(state.phase, 'aiming');
    assert.ok(state.tanks[0].x + game.TANK_W <= game.barrier.x);
    assert.ok(state.tanks[1].x >= game.barrier.x + game.barrier.w);
});

test('movement clamps each tank to its side of the central barrier', () => {
    const state = match();
    game.moveTank(state, 'forward', 10000);
    assert.equal(state.tanks[0].x, game.barrier.x - game.TANK_W);
    state.activePlayer = 1; game.moveTank(state, 'forward', 10000);
    assert.equal(state.tanks[1].x, game.barrier.x + game.barrier.w);
});

test('angle and power controls enforce their documented ranges', () => {
    const state = match(); game.adjustAim(state, -1000); game.adjustPower(state, -1000);
    assert.equal(state.tanks[0].angle, 10); assert.equal(state.tanks[0].power, 20);
    game.adjustAim(state, 1000); game.adjustPower(state, 1000);
    assert.equal(state.tanks[0].angle, 80); assert.equal(state.tanks[0].power, 100);
});

test('gravity bends a projectile upward and then downward', () => {
    const state = match(); game.fireProjectile(state);
    const initialVelocity = state.projectile.vy, initialY = state.projectile.y;
    game.stepPhysics(state, 0.25);
    assert.ok(state.projectile.y < initialY); assert.ok(state.projectile.vy > initialVelocity);
});

test('a low shot collides with the central barrier', () => {
    const state = match(); state.tanks[0].angle = 10; state.tanks[0].power = 100; game.fireProjectile(state);
    assert.equal(finish(state).type, 'barrier');
});

test('a sufficiently high shot clears the central barrier', () => {
    const state = match(); state.tanks[0].angle = 45; state.tanks[0].power = 100; game.fireProjectile(state);
    assert.notEqual(finish(state).type, 'barrier');
});

test('a direct collision damages only the target tank', () => {
    const state = match(); state.projectile = { x: 0, y: 0, vx: 0, vy: 0, owner: 0 }; state.phase = 'projectile-flight';
    game.resolveShot(state, { type: 'tank', index: 1 });
    assert.deepEqual(state.tanks.map(tank => tank.health), [100, 50]);
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
    game.resetMatch(state);
    assert.deepEqual(state.tanks, initial.tanks); assert.equal(state.projectile, null); assert.equal(state.shots, 0); assert.equal(state.hits, 0); assert.equal(state.activePlayer, 0); assert.equal(state.winner, null); assert.equal(state.resultSubmitted, false); assert.equal(state.phase, 'aiming');
});

test('large elapsed-time updates sweep collisions instead of tunneling', () => {
    const state = match(); state.projectile = { x: 300, y: 300, vx: 1000, vy: 0, owner: 0 }; state.phase = 'projectile-flight';
    assert.equal(game.stepPhysics(state, 0.3).type, 'barrier'); assert.equal(state.activePlayer, 1);
});
