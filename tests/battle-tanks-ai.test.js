'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../battle-tanks/scripts/game');
const ai = require('../battle-tanks/scripts/ai');

test('solo CPU repositions by a meaningful bounded distance without mutating planning state', () => {
    const state = core.createInitialState(123); core.beginTurn(state, 1); state.shots = 1;
    const before = core.snapshot(state), move = ai.planMove(state, 1), bounds = core.tankBounds(state, 1);
    assert.ok(move); assert.ok(move.amount >= 48 && move.amount <= 104); assert.notEqual(move.targetX, move.startX);
    assert.ok(move.targetX >= bounds.min && move.targetX <= bounds.max);
    assert.deepEqual(core.snapshot(state), before, 'movement planning must not mutate the live match');
    assert.equal(ai.planMove(state, 1).targetX, move.targetX, 'the same turn should choose the same position');
    core.moveTank(state, move.direction, move.amount);
    assert.equal(state.tanks[1].x, move.targetX);
});

test('solo CPU movement changes across turns and reverses safely at arena edges', () => {
    const state = core.createInitialState(789); core.beginTurn(state, 1); const choices = [];
    for (let shots = 1; shots < 12; shots += 2) { state.shots = shots; choices.push(ai.planMove(state, 1)); }
    assert.ok(new Set(choices.map(move => `${move.direction}:${move.amount}`)).size >= 3);
    const bounds = core.tankBounds(state, 1); state.tanks[1].x = bounds.max; state.shots = 3;
    const fromRightEdge = ai.planMove(state, 1); assert.equal(fromRightEdge.direction, 'forward'); assert.ok(fromRightEdge.targetX < bounds.max);
    state.tanks[1].x = bounds.min; state.shots = 5;
    const fromLeftEdge = ai.planMove(state, 1); assert.equal(fromLeftEdge.direction, 'backward'); assert.ok(fromLeftEdge.targetX > bounds.min);
});

test('solo CPU prioritizes the nearest reachable pickup while inventory has space', () => {
    const state = core.createInitialState(321); core.beginTurn(state, 1); const tank = state.tanks[1], before = core.snapshot(state);
    const pickupY = x => core.terrainHeightAt(state.arena, x);
    state.pickups.push(
        { serial: 1, id: 'health-pack', x: tank.x - 280, y: pickupY(tank.x - 280) },
        { serial: 2, id: 'shield', x: tank.x + core.TANK_W / 2 + 70, y: pickupY(tank.x + core.TANK_W / 2 + 70) }
    );
    const aiming = core.snapshot(state), move = ai.planMove(state, 1);
    assert.equal(move.reason, 'pickup'); assert.equal(move.pickupSerial, 2); assert.equal(move.pickupId, 'shield');
    assert.equal(move.direction, 'backward'); assert.equal(move.amount, 70); assert.equal(move.targetX, tank.x + 70);
    assert.deepEqual(core.snapshot(state), aiming, 'pickup planning must not mutate the live match');
    assert.notDeepEqual(aiming, before);
    state.inventories[1].push('shield', 'shield', 'shield');
    assert.equal(ai.planMove(state, 1).reason, 'reposition', 'a full inventory should stop pickup pursuit');
});

test('solo CPU ignores pickups stranded above deformed terrain', () => {
    const state = core.createInitialState(322); core.beginTurn(state, 1); const tank = state.tanks[1], pickupX = tank.x + core.TANK_W / 2 + 50;
    state.pickups.push({ serial: 1, id: 'shield', x: pickupX, y: core.terrainHeightAt(state.arena, pickupX) - core.TANK_H * 2 });
    const move = ai.planMove(state, 1);
    assert.equal(move.reason, 'reposition');
    assert.notEqual(move.pickupSerial, 1);
});

test('solo CPU plans useful inventory activations without wasting or stacking effects', () => {
    const state = core.createInitialState(654); core.beginTurn(state, 1); state.tanks[1].health = 70;
    state.inventories[1].push('health-pack', 'health-pack', 'shield', 'damage-boost', 'weapon-wide-blast', 'blast-radius-boost');
    const before = core.snapshot(state);
    assert.deepEqual(ai.planPowerUps(state, 1), ['health-pack', 'shield', 'damage-boost', 'weapon-wide-blast', 'blast-radius-boost']);
    assert.deepEqual(core.snapshot(state), before, 'power-up planning must not mutate the live match');
    state.tanks[1].health = core.STARTING_HEALTH; state.activeEffects[1].push({ id: 'shield', effect: 'absorb', remainingTurns: 2, remainingCapacity: 40 }, { id: 'damage-boost', effect: 'damage', multiplier: 1.35, remainingTurns: 2 });
    assert.deepEqual(ai.planPowerUps(state, 1), ['weapon-wide-blast', 'blast-radius-boost']);
    assert.deepEqual(ai.planPowerUps(state, 0), []);
});

test('solo CPU plans a bounded grazing shot without mutating the live match', () => {
    const state = core.createInitialState(123), before = core.snapshot(state);
    core.beginTurn(state, 1); const aiming = core.snapshot(state), plan = ai.planShot(state, 1);
    assert.ok(plan); assert.ok(plan.angle >= 10 && plan.angle <= 80); assert.ok(plan.power >= 20 && plan.power <= 100);
    assert.equal(plan.intent, 'hit'); assert.ok(plan.targetDamage >= 15 && plan.targetDamage <= 38, 'the CPU should graze instead of always taking maximum damage');
    assert.deepEqual(core.snapshot(state), aiming, 'planning must not mutate the live match');
    assert.notDeepEqual(aiming, before, 'the fixture should begin on the CPU turn');
});

test('solo CPU deterministically mixes credible hits and misses', () => {
    const state = core.createInitialState(123); core.beginTurn(state, 1); const plans = [];
    for (let shots = 1; shots < 20; shots += 2) { state.shots = shots; plans.push(ai.planShot(state, 1)); }
    const hits = plans.filter(plan => plan.intent === 'hit'), misses = plans.filter(plan => plan.intent === 'miss');
    assert.ok(hits.length >= 3 && hits.length <= 8); assert.ok(misses.length >= 2);
    assert.ok(hits.every(plan => plan.targetDamage > 0 && plan.targetDamage <= 38)); assert.ok(misses.every(plan => plan.targetDamage === 0));
    state.shots = 1; assert.deepEqual(ai.planShot(state, 1), plans[0], 'the same match state should produce the same CPU decision');
});

test('solo CPU respects ammunition and refuses to plan outside its turn', () => {
    const state = core.createInitialState(456); core.beginTurn(state, 1);
    assert.equal(ai.planMove(state, 0), null);
    assert.deepEqual(ai.planPowerUps(state, 0), []);
    assert.equal(ai.planShot(state, 0), null);
    const plan = ai.planShot(state, 1); assert.equal(plan.weaponId, 'shell');
    state.weaponAmmo[1].homing = 1; assert.ok(['shell','homing'].includes(ai.planShot(state, 1).weaponId));
});
