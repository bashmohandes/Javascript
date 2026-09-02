'use strict';

const crypto = require('node:crypto');
const { createGame, startGame, update, setInput, setColor, snapshot } = require('./game');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const token = () => crypto.randomBytes(24).toString('base64url');
const normalizePasscode = value => String(value || '').trim();

class RoomManager {
    constructor({ reconnectMs = 15000, roomTimeoutMs = 30 * 60 * 1000, random = Math.random, recordResult = null } = {}) {
        this.rooms = new Map();
        this.reconnectMs = reconnectMs;
        this.roomTimeoutMs = roomTimeoutMs;
        this.random = random;
        this.recordResult = recordResult;
        this.sequence = 0;
    }

    makeCode() {
        let code;
        do { code = Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(this.random() * CODE_ALPHABET.length)]).join(''); } while (this.rooms.has(code));
        return code;
    }

    makePlayer(socket, side, user, gamertag = '') {
        return { id: token(), token: token(), side, userId: user?.id || null, gamertag: user?.gamertag || String(gamertag || ''), socket, connected: true, ready: false, disconnectedAt: null, pendingResult: null };
    }

    create(socket, { visibility = 'private', passcode = '', gamertag = '', user = null } = {}) {
        const isPublic = visibility === 'public';
        const normalizedPasscode = normalizePasscode(passcode);
        if (!isPublic && (normalizedPasscode.length < 4 || normalizedPasscode.length > 32)) throw new Error('Private room passcodes must be 4–32 characters.');
        const code = this.makeCode();
        const player = this.makePlayer(socket, 0, user, gamertag);
        const room = { code, visibility: isPublic ? 'public' : 'private', passcode: isPublic ? '' : normalizedPasscode, players: [player, null], game: createGame(this.random), matchId: 0, recorded: false, createdAt: Date.now(), touchedAt: Date.now(), countdownUntil: null };
        this.rooms.set(code, room);
        return { room, player };
    }

    join(code, socket, passcode = '', gamertag = '', user = null) {
        const room = this.rooms.get(String(code || '').toUpperCase());
        if (!room) throw new Error('Room not found. Check the code and try again.');
        if (room.players[1]) throw new Error('That room is already full.');
        if (room.visibility === 'private' && normalizePasscode(passcode) !== room.passcode) throw new Error('That passcode is incorrect.');
        const player = this.makePlayer(socket, 1, user, gamertag);
        room.players[1] = player;
        room.touchedAt = Date.now();
        return { room, player };
    }

    publicRooms() {
        return Array.from(this.rooms.values())
            .filter(room => room.visibility === 'public' && !room.players[1])
            .sort((left, right) => right.createdAt - left.createdAt)
            .map(room => ({ code: room.code, players: room.players.filter(player => player?.connected).length, createdAt: room.createdAt }));
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
        this.deliverResult(player);
        if (room.players.every(candidate => candidate?.connected) && room.game.running) room.game.paused = false;
        return { room, player };
    }

    ready(room, player) {
        if (room.game.running && !room.game.over) throw new Error('The match is already in progress.');
        player.ready = true;
        if (room.players.every(candidate => candidate?.ready && candidate.connected)) {
            room.players.forEach(candidate => { candidate.ready = false; });
            this.start(room);
            return true;
        }
        return false;
    }

    rematch(room) {
        // Both clients can act on the same finished-state snapshot before the
        // first rematch update reaches them. Treat that second request as an
        // idempotent success instead of showing an error during the new match.
        if (!room.players.every(candidate => candidate?.connected)) throw new Error('Both players must be connected to start a rematch.');
        if (room.game.running && !room.game.over) return true;
        if (!room.game.over) throw new Error('The match must be finished before starting a rematch.');
        room.players.forEach(candidate => { candidate.ready = false; });
        this.start(room);
        room.touchedAt = Date.now();
        return true;
    }

    start(room) {
        startGame(room.game);
        room.matchId += 1;
        room.recorded = false;
    }

    finish(room) {
        if (room.recorded || !room.game.over) return;
        room.recorded = true;
        const seconds = Math.max(1, Math.min(86400, Math.round(room.game.elapsed)));
        room.players.forEach((player, side) => {
            if (!player?.userId || !this.recordResult) return;
            const won = room.game.winner === side;
            try {
                player.pendingResult = this.recordResult(player.userId, { game: 'pong', won, details: { mode: 'online', score: `${room.game.score[side]}-${room.game.score[1 - side]}`, seconds } }) || null;
                this.deliverResult(player);
            } catch { /* A persistence failure must not stop the room simulation. */ }
        });
    }

    deliverResult(player) {
        if (!player.pendingResult || player.socket?.readyState !== 1) return;
        player.socket.send(JSON.stringify({ type: 'result-recorded', result: player.pendingResult }));
        player.pendingResult = null;
    }

    disconnect(room, player, socket = player.socket) {
        // A resumed session replaces the player's socket. The delayed close
        // event from the old connection must not disconnect the new one.
        if (player.socket !== socket) return false;
        player.connected = false;
        player.socket = null;
        player.disconnectedAt = Date.now();
        room.touchedAt = Date.now();
        if (room.game.running) room.game.paused = true;
        return true;
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
            if (room.game.over) this.finish(room);
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
