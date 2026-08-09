'use strict';

const crypto = require('node:crypto');
const { createGame, startGame, update, setInput, setColor, snapshot } = require('./game');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const token = () => crypto.randomBytes(24).toString('base64url');

class RoomManager {
    constructor({ reconnectMs = 15000, roomTimeoutMs = 30 * 60 * 1000, random = Math.random } = {}) {
        this.rooms = new Map();
        this.reconnectMs = reconnectMs;
        this.roomTimeoutMs = roomTimeoutMs;
        this.random = random;
        this.sequence = 0;
    }

    makeCode() {
        let code;
        do { code = Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)]).join(''); } while (this.rooms.has(code));
        return code;
    }

    create(socket) {
        const code = this.makeCode();
        const player = { id: token(), token: token(), side: 0, socket, connected: true, ready: false, disconnectedAt: null };
        const room = { code, players: [player, null], game: createGame(this.random), createdAt: Date.now(), touchedAt: Date.now(), countdownUntil: null };
        this.rooms.set(code, room);
        return { room, player };
    }

    join(code, socket) {
        const room = this.rooms.get(String(code || '').toUpperCase());
        if (!room) throw new Error('Room not found. Check the code and try again.');
        if (room.players[1]) throw new Error('That room is already full.');
        const player = { id: token(), token: token(), side: 1, socket, connected: true, ready: false, disconnectedAt: null };
        room.players[1] = player;
        room.touchedAt = Date.now();
        return { room, player };
    }

    resume(code, playerToken, socket) {
        const room = this.rooms.get(String(code || '').toUpperCase());
        const player = room?.players.find(candidate => candidate?.token === playerToken);
        if (!room || !player) throw new Error('This game session is no longer available.');
        player.socket?.close(4001, 'Session resumed elsewhere');
        player.socket = socket;
        player.connected = true;
        player.disconnectedAt = null;
        room.touchedAt = Date.now();
        if (room.players.every(candidate => candidate?.connected) && room.game.running) room.game.paused = false;
        return { room, player };
    }

    ready(room, player) {
        player.ready = true;
        if (room.players.every(candidate => candidate?.ready && candidate.connected)) {
            room.players.forEach(candidate => { candidate.ready = false; });
            startGame(room.game);
            return true;
        }
        return false;
    }

    disconnect(room, player) {
        player.connected = false;
        player.socket = null;
        player.disconnectedAt = Date.now();
        room.touchedAt = Date.now();
        if (room.game.running) room.game.paused = true;
    }

    tick(dt, now = Date.now()) {
        for (const [code, room] of this.rooms) {
            const expiredPlayer = room.players.some(player => player && !player.connected && now - player.disconnectedAt > this.reconnectMs);
            if (expiredPlayer || now - room.touchedAt > this.roomTimeoutMs || room.players.every(player => !player?.connected)) {
                this.broadcast(room, { type: 'room-closed', reason: expiredPlayer ? 'An opponent did not reconnect in time.' : 'Room expired.' });
                this.rooms.delete(code);
                continue;
            }
            if (room.game.running && !room.game.paused) room.touchedAt = now;
            update(room.game, dt);
        }
    }

    broadcast(room, message) {
        const body = JSON.stringify(message);
        room.players.forEach(player => { if (player?.socket?.readyState === 1) player.socket.send(body); });
    }

    broadcastStates(serverTime = Date.now()) {
        for (const room of this.rooms.values()) {
            this.sequence += 1;
            this.broadcast(room, { type: 'state', sequence: this.sequence, serverTime, state: snapshot(room.game) });
        }
    }

    input(room, player, message) { setInput(room.game, player.side, message); room.touchedAt = Date.now(); }
    color(room, player, color) { setColor(room.game, player.side, color); room.touchedAt = Date.now(); }
}

module.exports = { RoomManager };
