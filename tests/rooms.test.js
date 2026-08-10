'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RoomManager } = require('../server/rooms');

function socket() { return { readyState: 1, messages: [], send(body) { this.messages.push(JSON.parse(body)); }, close() {} }; }

test('creates, joins, readies, and expires a private room', () => {
    const rooms = new RoomManager({ reconnectMs: 100, random: () => 0.1 });
    const host = rooms.create(socket());
    assert.equal(host.room.code.length, 5);
    const guest = rooms.join(host.room.code, socket());
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
    const host = rooms.create(socket());
    rooms.join(host.room.code, socket());
    assert.throws(() => rooms.join(host.room.code, socket()), /full/i);
});
