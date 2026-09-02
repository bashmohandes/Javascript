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

test('bounds public room listings', () => {
    const rooms = new RoomManager();
    for (let index = 0; index < 4; index += 1) rooms.create(socket(), { visibility: 'public' });
    assert.equal(rooms.publicRooms(2).length, 2);
});

test('requires a valid passcode when creating private rooms', () => {
    const rooms = new RoomManager();
    assert.throws(() => rooms.create(socket()), /4.*32 characters/);
    assert.throws(() => rooms.create(socket(), { passcode: 'abc' }), /4.*32 characters/);
});

test('an old socket closing cannot disconnect a resumed player', () => {
    const rooms = new RoomManager();
    const oldSocket = socket();
    const host = rooms.create(oldSocket, { visibility: 'public' });
    const newSocket = socket();

    rooms.resume(host.room.code, host.player.token, newSocket);

    assert.equal(rooms.disconnect(host.room, host.player, oldSocket), false);
    assert.equal(host.player.connected, true);
    assert.equal(host.player.socket, newSocket);
});

test('rooms retain public gamertags for a matchup', () => {
    const rooms = new RoomManager({ random: () => 0 });
    const host = rooms.create(socket(), { visibility: 'public', gamertag: 'Host_Player' });
    const guest = rooms.join(host.room.code, socket(), '', 'Guest_Player');
    assert.deepEqual(host.room.players.map(player => player.gamertag), ['Host_Player', 'Guest_Player']);
    assert.equal(guest.player.gamertag, 'Guest_Player');
});

test('ready messages cannot reset a match that is already running', () => {
    const rooms = new RoomManager();
    const host = rooms.create(socket(), { visibility: 'public' });
    const guest = rooms.join(host.room.code, socket());
    rooms.ready(host.room, host.player);
    rooms.ready(host.room, guest.player);
    host.room.game.score[0] = 3;

    assert.throws(() => rooms.ready(host.room, host.player), /already in progress/i);
    assert.deepEqual(host.room.game.score, [3, 0]);
});

test('one player becoming ready does not mark the opponent ready', () => {
    const rooms = new RoomManager();
    const host = rooms.create(socket(), { visibility: 'public' });
    const guest = rooms.join(host.room.code, socket());

    assert.equal(rooms.ready(host.room, host.player), false);
    assert.deepEqual(host.room.players.map(player => player.ready), [true, false]);
    assert.equal(rooms.ready(host.room, guest.player), true);
});

test('either connected player can start a rematch for the whole room', () => {
    const rooms = new RoomManager();
    const host = rooms.create(socket(), { visibility: 'public' });
    const guest = rooms.join(host.room.code, socket());
    rooms.ready(host.room, host.player);
    rooms.ready(host.room, guest.player);
    host.room.game.over = true;
    host.room.game.running = false;
    host.room.game.score = [7, 4];

    assert.equal(rooms.rematch(host.room), true);
    assert.equal(host.room.game.running, true);
    assert.equal(host.room.game.over, false);
    assert.deepEqual(host.room.game.score, [0, 0]);

    host.room.game.score[0] = 2;
    assert.equal(rooms.rematch(host.room), true, 'a concurrent second request is accepted');
    assert.deepEqual(host.room.game.score, [2, 0], 'a duplicate request must not reset the new match');
});
