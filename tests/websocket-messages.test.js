'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseMessage, roomStatusMessage, send, sessionMessage } = require('../server/websocket-messages');
const { RoomManager } = require('../server/rooms');
const { TicTacToeRooms } = require('../server/tictactoe-rooms');
const { BattleTanksRooms } = require('../server/battle-tanks-rooms');

test('WebSocket messages require JSON objects', () => {
    assert.deepEqual(parseMessage(Buffer.from('{"type":"ready"}')), { type: 'ready' });
    for (const raw of ['invalid', 'null', '[]', '"ready"']) assert.throws(() => parseMessage(Buffer.from(raw)), /Invalid message/);
});

test('WebSocket room payloads share one stable shape', () => {
    const room = {
        code: 'ROOM1', visibility: 'public',
        players: [
            { id: 'player-1', token: 'token-1', side: 0, gamertag: 'Host', connected: true, ready: false },
            { id: 'player-2', token: 'token-2', side: 1, gamertag: '', connected: false, ready: true }
        ]
    };
    assert.deepEqual(sessionMessage(room, room.players[0]), { type: 'session', roomCode: 'ROOM1', playerToken: 'token-1', side: 0, visibility: 'public', gamertags: ['Host', null] });
    assert.deepEqual(sessionMessage(room, room.players[0], { includePlayerId: true }), { type: 'session', roomCode: 'ROOM1', playerToken: 'token-1', side: 0, visibility: 'public', gamertags: ['Host', null], playerId: 'player-1' });
    assert.deepEqual(roomStatusMessage(room), { type: 'room-status', players: [true, false], ready: [false, true], gamertags: ['Host', null] });
});

test('WebSocket sends only to open sockets', () => {
    const open = { readyState: 1, messages: [], send(body) { this.messages.push(JSON.parse(body)); } };
    const closed = { readyState: 3, send() { throw new Error('should not send'); } };
    send(open, { type: 'state' }); send(closed, { type: 'state' });
    assert.deepEqual(open.messages, [{ type: 'state' }]);
});

test('WebSocket send budgets count UTF-8 bytes and terminate slow consumers', () => {
    const socket = { readyState: 1, bufferedAmount: 1024 * 1024 - 16, terminated: false, send() { throw new Error('must not queue more data'); }, terminate() { this.terminated = true; } };
    assert.equal(send(socket, { text: '✓✓✓' }), false);
    assert.equal(socket.terminated, true);
});

test('all room broadcasts enforce the send budget without interrupting the other player', () => {
    for (const Manager of [RoomManager, TicTacToeRooms, BattleTanksRooms]) {
        const slow = { readyState: 1, bufferedAmount: 1024 * 1024, terminate() { this.readyState = 3; }, send() { throw new Error('must not queue more data'); } };
        const healthy = { readyState: 1, messages: [], send(body) { this.messages.push(JSON.parse(body)); } };
        const rooms = new Manager(), { room } = rooms.create(slow, { visibility: 'public' });
        rooms.join(room.code, healthy);
        rooms.broadcast(room, { type: 'room-status' });
        assert.equal(slow.readyState, 3, Manager.name);
        assert.deepEqual(healthy.messages, [{ type: 'room-status' }], Manager.name);
        if (Manager === BattleTanksRooms) {
            slow.readyState = 1;
            rooms.broadcastState(room);
            assert.equal(slow.readyState, 3);
            assert.equal(room.players[0].arenaVersion, null, 'unsent geometry must be retried on resume');
            assert.equal(healthy.messages.at(-1).type, 'state');
        }
    }
});

test('Pong and tic-tac-toe retain unsent result receipts for reconnect', () => {
    for (const Manager of [RoomManager, TicTacToeRooms]) {
        const rooms = new Manager(), receipt = { id: 12, score: 100 };
        const player = { pendingResult: receipt, socket: { readyState: 1, bufferedAmount: 1024 * 1024, terminate() { this.readyState = 3; }, send() { throw new Error('must not queue more data'); } } };
        rooms.deliverResult(player); assert.deepEqual(player.pendingResult, receipt);
        player.socket = { readyState: 1, send(body) { assert.deepEqual(JSON.parse(body), { type: 'result-recorded', result: receipt }); } };
        rooms.deliverResult(player); assert.equal(player.pendingResult, null);
    }
});
