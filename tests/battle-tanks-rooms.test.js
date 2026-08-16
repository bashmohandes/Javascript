'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BattleTanksRooms } = require('../server/battle-tanks-rooms');
const core = require('../battle-tanks/scripts/game');
const socket = () => ({ readyState: 1, messages: [], send(body) { this.messages.push(JSON.parse(body)); }, close() {} });
function started(options = {}) { const rooms = new BattleTanksRooms({ random: () => 0, ...options }), host = rooms.create(socket(), { visibility: 'public', user: { id: 1, gamertag: 'Host' } }), guest = rooms.join(host.room.code, socket(), '', { id: 2, gamertag: 'Guest' }); rooms.ready(host.room, host.player); rooms.ready(host.room, guest.player); return { rooms, host, guest }; }
const command = (room, type, extra = {}) => ({ type, matchId: room.matchId, turnId: room.turnId, ...extra });

test('predicts smooth projectile positions between authoritative snapshots', () => {
    const projectile = { x: 100, y: 200, vx: 300, vy: -100, owner: 0 };
    assert.deepEqual(core.predictProjectile(projectile, .05), { x: 115, y: 195.2625, vx: 300, vy: -89.5, owner: 0 });
    assert.deepEqual(projectile, { x: 100, y: 200, vx: 300, vy: -100, owner: 0 }, 'render prediction must not mutate authoritative state');
});

test('creates public/private rooms without exposing secrets and rejects full rooms', () => { let value = 0; const rooms = new BattleTanksRooms({ random: () => (value += .01) }); const pub = rooms.create(socket(), { visibility: 'public', user: { gamertag: 'Host' } }); const secret = rooms.create(socket(), { passcode: 'shell7' }); assert.deepEqual(rooms.publicRooms().map(item => item.code), [pub.room.code]); assert.throws(() => rooms.join(secret.room.code, socket(), 'bad'), /passcode/i); rooms.join(pub.room.code, socket()); assert.throws(() => rooms.join(pub.room.code, socket()), /full/i); assert.equal(JSON.stringify(rooms.publicRooms()).includes('shell7'), false); });
test('requires both players and alternates authoritative turns', () => { const rooms = new BattleTanksRooms({ random: () => 0 }), host = rooms.create(socket(), { visibility: 'public' }), guest = rooms.join(host.room.code, socket()); assert.equal(rooms.ready(host.room, host.player), false); assert.equal(rooms.ready(host.room, guest.player), true); assert.throws(() => rooms.command(host.room, guest.player, command(host.room, 'move', { direction: 'forward' })), /turn/i); rooms.command(host.room, host.player, command(host.room, 'move', { direction: 'forward' })); assert.ok(host.room.game.tanks[0].x > 115); rooms.command(host.room, host.player, command(host.room, 'fire')); while (host.room.game.phase === 'projectile-flight') rooms.tick(1 / 60); assert.equal(host.room.game.activePlayer, 1); assert.equal(host.room.turnId, 2); });
test('rejects stale, invalid, and excessive commands', () => { const { rooms, host } = started(); assert.throws(() => rooms.command(host.room, host.player, { type: 'fire', matchId: 0, turnId: 0 }), /stale/i); assert.throws(() => rooms.command(host.room, host.player, command(host.room, 'aim', { angle: Infinity, power: 50 })), /invalid/i); for (let i = 0; i < 29; i += 1) rooms.command(host.room, host.player, command(host.room, 'aim', { angle: 45, power: 60 })); assert.throws(() => rooms.command(host.room, host.player, command(host.room, 'aim', { angle: 45, power: 60 })), /many/i); });
test('pauses on disconnect, resumes securely, and ignores an old socket close', () => { const { rooms, host, guest } = started(); const old = guest.player.socket; rooms.disconnect(host.room, guest.player, old); assert.equal(host.room.paused, true); assert.throws(() => rooms.command(host.room, host.player, command(host.room, 'fire')), /paused/i); const replacement = socket(); rooms.resume(host.room.code, guest.player.token, replacement); assert.equal(host.room.paused, false); assert.equal(rooms.disconnect(host.room, guest.player, old), false); assert.equal(guest.player.connected, true); });
test('expires abandoned rooms after the reconnect grace period', () => { const { rooms, host, guest } = started({ reconnectMs: 10 }); rooms.disconnect(host.room, guest.player); rooms.tick(0, guest.player.disconnectedAt + 11); assert.equal(rooms.rooms.has(host.room.code), false); });
test('records each authenticated online result once from authoritative state', () => { const results = [], { rooms, host } = started({ recordResult: (id, result) => results.push({ id, result }) }); host.room.stats[0].shots = 2; host.room.stats[0].hits = 2; host.room.stats[1].shots = 1; host.room.stats[1].damageTaken = 100; host.room.game.tanks[1].health = 0; host.room.game.winner = 0; host.room.game.phase = 'game-over'; rooms.finish(host.room); rooms.finish(host.room); assert.equal(results.length, 2); assert.deepEqual(results.map(item => item.result.won), [true, false]); assert.ok(results.every(item => item.result.details.mode === 'online')); });
test('server projectile collision broadcasts the resolved state and advances once', () => { const { rooms, host, guest } = started(); const target = host.room.game.tanks[1]; host.room.stats[0].shots = 1; host.room.game.projectile = { x: target.x - 20, y: target.y + core.TANK_H / 2, vx: 200, vy: 0, owner: 0 }; host.room.game.phase = 'projectile-flight'; rooms.tick(.2); assert.equal(target.health, 50); assert.equal(host.room.stats[0].hits, 1); assert.equal(host.room.game.activePlayer, 1); for (const player of [host.player, guest.player]) { const update = player.socket.messages.at(-1); assert.equal(update.type, 'state'); assert.equal(update.state.phase, 'aiming'); assert.equal(update.state.turnId, 2); } const turn = host.room.turnId; rooms.tick(.2); assert.equal(host.room.turnId, turn); });
test('server creates and synchronizes one authoritative arena for both players', () => { const { rooms, host, guest } = started({ random: () => .314159 }); const expected = rooms.state(host.room).arena; rooms.broadcast(host.room, { type: 'state', state: rooms.state(host.room) }); const hostArena = host.player.socket.messages.at(-1).state.arena, guestArena = guest.player.socket.messages.at(-1).state.arena; assert.deepEqual(hostArena, expected); assert.deepEqual(guestArena, expected); assert.deepEqual(expected, core.generateArena(expected.seed)); rooms.command(host.room, host.player, command(host.room, 'aim', { angle: 45, power: 60, arena: { terrain: [0], barrier: { x: 0 } } })); assert.deepEqual(host.room.game.arena, expected); });
test('both clients receive identical authoritative arena deformation', () => { const { rooms, host, guest } = started({ random: () => .2718 }), barrier = host.room.game.arena.barrier; core.resolveExplosion(host.room.game, { x: 200, y: core.terrainHeightAt(host.room.game.arena, 200) }, { radius: 30, depth: 25 }, 'terrain'); core.resolveExplosion(host.room.game, { x: barrier.x + barrier.w / 2, y: barrier.y + 40 }, { radius: 24, depth: 20 }, 'barrier'); rooms.broadcast(host.room, { type: 'state', state: rooms.state(host.room) }); const hostArena = host.player.socket.messages.at(-1).state.arena, guestArena = guest.player.socket.messages.at(-1).state.arena; assert.deepEqual(hostArena, guestArena); assert.deepEqual(hostArena, core.snapshot(host.room.game).arena); assert.ok(hostArena.barrier.cells.includes(0)); });

test('online statistics use one explosion result for splash hits and damage taken', () => {
    const { rooms, host } = started(), state = host.room.game, target = state.tanks[1], shooter = state.tanks[0];
    shooter.x = target.x - core.TANK_W - 4; shooter.y = target.y; shooter.health = 100; target.health = 100;
    state.projectile = { x: target.x - 20, y: target.y + core.TANK_H / 2, vx: 200, vy: 0, owner: 0, weapon: core.DEFAULT_WEAPON };
    state.phase = 'projectile-flight'; host.room.stats[0].shots = 1;
    rooms.tick(.2);
    const affected = state.lastImpact.affected;
    assert.equal(affected.length, 2, 'one explosion splashes both nearby tanks');
    assert.equal(host.room.stats[0].hits, 1, 'splash counts once per damaging shot, not once per tank');
    assert.equal(host.room.stats[0].damageTaken, affected.find(item => item.tank === 0).healthDamage);
    assert.equal(host.room.stats[1].damageTaken, affected.find(item => item.tank === 1).healthDamage);
});

test('server validates inventory choices, rejects stale activations, and synchronizes pickup state', () => {
    const { rooms, host, guest } = started(); const state = host.room.game;
    state.inventories[0].push('shield'); core.spawnPickup(state, 'health-pack');
    assert.throws(() => rooms.command(host.room, host.player, { ...command(host.room, 'activate', { itemId: 'shield' }), turnId: 0 }), /stale/i);
    rooms.command(host.room, host.player, command(host.room, 'activate', { itemId: 'shield' }));
    const shield = state.activeEffects[0][0]; assert.deepEqual([shield.remainingTurns, shield.remainingCapacity], [1, 40]); assert.equal(host.room.turnId, 2); assert.equal(state.activePlayer, 1);
    rooms.broadcast(host.room, { type: 'state', state: rooms.state(host.room) });
    assert.deepEqual(host.player.socket.messages.at(-1).state.pickups, guest.player.socket.messages.at(-1).state.pickups);
    assert.deepEqual(host.player.socket.messages.at(-1).state.activeEffects, guest.player.socket.messages.at(-1).state.activeEffects);
});

test('online rematch removes authoritative pickup state', () => {
    const { rooms, host } = started(); host.room.game.pickups.push({ id: 'shield', x: 100, y: 400 }); host.room.game.inventories[0].push('shield'); host.room.game.phase = 'game-over'; rooms.rematch(host.room);
    assert.deepEqual(host.room.game.pickups, []); assert.deepEqual(host.room.game.inventories, [[], []]);
});


test('server RNG exclusively selects bounded shield values and expires effects', () => {
    const { rooms, host } = started({ random: () => .999999 });
    host.room.game.inventories[0].push('shield');
    rooms.command(host.room, host.player, command(host.room, 'activate', { itemId: 'shield', remainingTurns: 99, remainingCapacity: 999 }));
    const shield = host.room.game.activeEffects[0][0], config = core.POWER_UP_CATALOG.shield;
    // Activation completes player 1's turn, so one server-selected turn has elapsed.
    assert.equal(shield.remainingTurns, config.durationRange.max - 1);
    assert.equal(shield.remainingCapacity, config.capacityRange.max);
    core.endTurnEffects(host.room.game, 0); core.endTurnEffects(host.room.game, 0); core.endTurnEffects(host.room.game, 0);
    assert.deepEqual(host.room.game.activeEffects[0], []);
});
