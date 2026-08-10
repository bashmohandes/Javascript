'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RoomManager } = require('../server/rooms');

function socket() { return { readyState: 1, messages: [], send(body) { this.messages.push(JSON.parse(body)); }, close() {} }; }

test('creates, joins, readies, and expires a private room', () => {
    const rooms = new RoomManager({ reconnectMs: 100, random: () => 0.1 });
    const host = rooms.create(socket(), { passcode: 'rally7' });
    assert.equal(host.room.code.length, 5);
    assert.throws(() => rooms.join(host.room.code, socket(), 'wrong'), /passcode/i);
    const guest = rooms.join(host.room.code, socket(), 'rally7');
    assert.equal(guest.player.side, 1);
    assert.equal(rooms.ready(host.room, host.player), false);
    assert.equal(rooms.ready(host.room, guest.player), true);
    assert.equal(host.room.game.running, true);
    rooms.disconnect(host.room, guest.player);
    rooms.tick(0.016, guest.player.disconnectedAt + 101);
    assert.equal(rooms.rooms.has(host.room.code), false);
});

test('rejects unknown and full rooms', () => {
    const rooms = new RoomManager({ random: () => 0.2 });
    assert.throws(() => rooms.join('NOPE1', socket()), /not found/i);
    const host = rooms.create(socket(), { visibility: 'public' });
    rooms.join(host.room.code, socket());
    assert.throws(() => rooms.join(host.room.code, socket()), /full/i);
});

test('lists only open public rooms without exposing private rooms', () => {
    const rooms = new RoomManager();
    const publicRoom = rooms.create(socket(), { visibility: 'public' });
    rooms.create(socket(), { visibility: 'private', passcode: 'secret' });
    assert.deepEqual(rooms.publicRooms().map(room => room.code), [publicRoom.room.code]);
    rooms.join(publicRoom.room.code, socket());
    assert.deepEqual(rooms.publicRooms(), []);
});

test('requires a valid passcode when creating private rooms', () => {
    const rooms = new RoomManager();
    assert.throws(() => rooms.create(socket()), /4.*32 characters/);
    assert.throws(() => rooms.create(socket(), { passcode: 'abc' }), /4.*32 characters/);
});
