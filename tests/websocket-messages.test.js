'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseMessage, roomStatusMessage, send, sessionMessage } = require('../server/websocket-messages');

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
