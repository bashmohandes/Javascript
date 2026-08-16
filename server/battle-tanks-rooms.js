'use strict';

const crypto = require('node:crypto');
const game = require('../battle-tanks/scripts/game');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const token = () => crypto.randomBytes(24).toString('base64url');
const cleanPasscode = value => String(value || '').trim();

class BattleTanksRooms {
    constructor({ reconnectMs = 15000, roomTimeoutMs = 1800000, random = Math.random, recordResult = null } = {}) {
        Object.assign(this, { reconnectMs, roomTimeoutMs, random, recordResult });
        this.rooms = new Map();
    }
    makeCode() { let code; do { code = Array.from({ length: 5 }, () => ALPHABET[Math.floor(this.random() * ALPHABET.length)]).join(''); } while (this.rooms.has(code)); return code; }
    makePlayer(socket, side, user) { return { token: token(), socket, side, userId: user?.id || null, gamertag: user?.gamertag || '', connected: true, ready: false, disconnectedAt: null, commands: [] }; }
    create(socket, { visibility = 'private', passcode = '', user = null } = {}) {
        const isPublic = visibility === 'public', secret = cleanPasscode(passcode);
        if (!isPublic && (secret.length < 4 || secret.length > 32)) throw new Error('Private room passcodes must be 4–32 characters.');
        const player = this.makePlayer(socket, 0, user), code = this.makeCode();
        const room = { code, visibility: isPublic ? 'public' : 'private', passcode: isPublic ? '' : secret, players: [player, null], game: game.createInitialState(), colors: ['#fffdf8', '#d76b45'], matchId: 0, turnId: 0, stats: null, recorded: false, paused: false, createdAt: Date.now(), touchedAt: Date.now(), lastBroadcast: 0 };
        this.rooms.set(code, room); return { room, player };
    }
    join(code, socket, passcode = '', user = null) {
        const room = this.rooms.get(String(code || '').toUpperCase());
        if (!room) throw new Error('Room not found. Check the code and try again.');
        if (room.players[1]) throw new Error('That room is already full.');
        if (room.visibility === 'private' && cleanPasscode(passcode) !== room.passcode) throw new Error('That passcode is incorrect.');
        const player = this.makePlayer(socket, 1, user); room.players[1] = player; room.touchedAt = Date.now(); return { room, player };
    }
    resume(code, playerToken, socket) {
        const room = this.rooms.get(String(code || '').toUpperCase()), player = room?.players.find(item => item?.token === playerToken);
        if (!player) throw new Error('This game session is no longer available.');
        player.socket?.close(4001, 'Session resumed elsewhere'); Object.assign(player, { socket, connected: true, disconnectedAt: null });
        room.paused = !room.players.every(item => item?.connected); room.touchedAt = Date.now(); return { room, player };
    }
    publicRooms() { return [...this.rooms.values()].filter(room => room.visibility === 'public' && !room.players[1]).sort((a, b) => b.createdAt - a.createdAt).map(room => ({ code: room.code, players: room.players.filter(item => item?.connected).length, host: room.players[0]?.gamertag || 'Guest', createdAt: room.createdAt })); }
    start(room) {
        // The server alone chooses the arena seed. Client command payloads are
        // never consulted for terrain or barrier geometry.
        const arenaSeed = Math.floor(this.random() * 0x100000000) >>> 0;
        game.resetMatch(room.game, arenaSeed); room.matchId += 1; room.turnId = 1; room.recorded = false; room.paused = false;
        room.stats = [{ shots: 0, hits: 0, damageTaken: 0 }, { shots: 0, hits: 0, damageTaken: 0 }]; room.startedAt = Date.now();
    }
    ready(room, player) {
        if (room.game.phase !== 'setup' && room.game.phase !== 'game-over') throw new Error('The match is already in progress.');
        player.ready = true;
        if (room.players.every(item => item?.ready && item.connected)) { room.players.forEach(item => { item.ready = false; }); this.start(room); return true; }
        return false;
    }
    rematch(room) {
        if (!room.players.every(item => item?.connected)) throw new Error('Both players must be connected to start a rematch.');
        if (room.game.phase !== 'game-over') { if (room.game.phase !== 'setup') return true; throw new Error('The match must be finished before starting a rematch.'); }
        room.players.forEach(item => { item.ready = false; }); this.start(room); return true;
    }
    checkCommand(room, player, message) {
        if (room.paused) throw new Error('The match is paused while a player reconnects.');
        if (message.matchId !== room.matchId || message.turnId !== room.turnId) throw new Error('That command is stale.');
        if (room.game.phase !== 'aiming') throw new Error('Wait for the current shot to finish.');
        if (player.side !== room.game.activePlayer) throw new Error('Wait for your turn.');
        const now = Date.now(); player.commands = player.commands.filter(time => now - time < 1000); if (player.commands.length >= 30) throw new Error('Too many commands.'); player.commands.push(now);
    }
    command(room, player, message) {
        this.checkCommand(room, player, message); let changed = false;
        if (message.type === 'move') { if (!['forward', 'backward'].includes(message.direction)) throw new Error('Invalid movement.'); changed = game.moveTank(room.game, message.direction, 8); }
        else if (message.type === 'aim') {
            if (!Number.isFinite(message.angle) || !Number.isFinite(message.power)) throw new Error('Invalid aim.');
            const tank = room.game.tanks[player.side], angle = Math.round(message.angle), power = Math.round(message.power);
            if (angle < 10 || angle > 80 || power < 20 || power > 100) throw new Error('Invalid aim.'); tank.angle = angle; tank.power = power; changed = true;
        } else if (message.type === 'fire') {
            const impactSerial = room.game.impactSerial || 0;
            changed = game.fireProjectile(room.game);
            if (changed) room.stats[player.side].shots += 1;
            // Rays resolve in the fire command rather than waiting for tick().
            if (changed && (room.game.impactSerial || 0) !== impactSerial) {
                const affected = room.game.lastImpact?.affected || [];
                if (affected.some(item => item.healthDamage > 0)) room.stats[player.side].hits += 1;
                affected.forEach(item => { room.stats[item.tank].damageTaken += item.healthDamage; });
                room.turnId += 1;
                if (room.game.phase === 'game-over') this.finish(room);
            }
        }
        else if (message.type === 'activate' || message.type === 'equip') {
            if (typeof message.itemId !== 'string' || !game.POWER_UP_CATALOG[message.itemId]) throw new Error('Invalid inventory item.');
            const item = game.POWER_UP_CATALOG[message.itemId];
            if (message.type === 'equip' && item.kind !== 'weapon') throw new Error('That item cannot be equipped.');
            if (message.type === 'activate' && item.kind === 'weapon') throw new Error('Equip weapon pickups instead.');
            const result = game.activatePowerUp(room.game, player.side, message.itemId, this.random); if (!result) throw new Error('That item is not available.'); changed = true;
            if (result.consumesTurn) {
                // Activation is not one of invisibility's protected owner turns. Firing does not cancel it.
                if (result.id !== 'invisibility') game.endTurnEffects(room.game, player.side);
                game.advancePickupSchedule(room.game); game.beginTurn(room.game, 1 - player.side); room.turnId += 1;
            }
        }
        else if (message.type === 'select-weapon') {
            if (typeof message.weaponId !== 'string' || !game.WEAPON_REGISTRY[message.weaponId]) throw new Error('Invalid weapon.');
            changed = game.selectWeapon(room.game, player.side, message.weaponId);
            if (!changed) throw new Error('That weapon has no ammunition.');
        }
        else throw new Error('Unsupported command.');
        room.touchedAt = Date.now(); return changed;
    }
    color(room, player, color) { if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Invalid color.'); room.colors[player.side] = color; room.touchedAt = Date.now(); }
    stateFor(room, viewerSide) {
        const state = { ...game.snapshot(room.game), colors: [...room.colors], matchId: room.matchId, turnId: room.turnId, paused: room.paused, startedAt: room.startedAt || null };
        if (room.paused) state.announcement = 'Match paused while a player reconnects.';
        const opponent = 1 - viewerSide;
        const concealed = state.phase !== 'game-over' && (room.game.activeEffects?.[opponent] || []).some(effect => effect.effect === 'invisible' && effect.remainingTurns > 0);
        state.viewerSide = viewerSide; state.opponentConcealed = concealed;
        if (!concealed) return state;
        // Health remains public, but no positional or aiming property crosses the trust boundary.
        state.tanks[opponent] = { health: room.game.tanks[opponent].health, concealed: true };
        if (state.activePlayer === opponent) state.announcement = 'Opponent concealed.';
        const projectile = room.game.projectile;
        if (projectile?.owner === opponent) {
            const barrier = room.game.arena.barrier;
            const crossed = opponent === 0 ? projectile.x >= barrier.x + barrier.w : projectile.x <= barrier.x;
            if (!crossed) state.projectile = { owner: opponent, concealed: true };
        }
        return state;
    }
    finish(room) {
        if (room.recorded || room.game.phase !== 'game-over') return; room.recorded = true;
        const seconds = Math.max(1, Math.min(7200, Math.round((Date.now() - room.startedAt) / 1000)));
        room.players.forEach((player, side) => { if (!player?.userId || !this.recordResult) return; const stats = room.stats[side], won = room.game.winner === side; try { this.recordResult(player.userId, { game: 'battletanks', won, details: { mode: 'online', winner: won ? 1 : 2, turns: room.stats[0].shots + room.stats[1].shots, shots: stats.shots, hits: stats.hits, seconds, damageTaken: stats.damageTaken } }); } catch { /* A persistence failure must not stop the room simulation. */ } });
    }
    tick(dt, now = Date.now()) {
        for (const [code, room] of this.rooms) {
            const expired = room.players.some(item => item && !item.connected && now - item.disconnectedAt > this.reconnectMs);
            if (expired || now - room.touchedAt > this.roomTimeoutMs) { this.broadcast(room, { type: 'room-closed', reason: expired ? 'An opponent did not reconnect in time.' : 'Room expired.' }); this.rooms.delete(code); continue; }
            if (room.paused || room.game.phase !== 'projectile-flight') continue;
            const shooter = room.game.activePlayer, impactSerial = room.game.impactSerial || 0, turn = room.turnId;
            game.stepPhysics(room.game, Math.min(Math.max(dt, 0), .1));
            if ((room.game.impactSerial || 0) !== impactSerial) {
                const affected = room.game.lastImpact?.affected || [];
                // A hit is one shot that deals health damage by either direct or splash damage;
                // self-damage counts too. Shield-only contact is not a hit.
                if (affected.some(item => item.healthDamage > 0)) room.stats[shooter].hits += 1;
                affected.forEach(item => { room.stats[item.tank].damageTaken += item.healthDamage; });
            }
            if (room.game.phase !== 'projectile-flight') {
                room.turnId = turn + 1;
                if (room.game.phase === 'game-over') this.finish(room);
                room.lastBroadcast = now;
                this.broadcastState(room);
            }
        }
    }
    disconnect(room, player, socket = player.socket) { if (player.socket !== socket) return false; Object.assign(player, { connected: false, socket: null, disconnectedAt: Date.now() }); room.paused = room.game.phase !== 'setup' && room.game.phase !== 'game-over'; room.touchedAt = Date.now(); return true; }
    broadcast(room, message) { const body = JSON.stringify(message); room.players.forEach(item => { if (item?.socket?.readyState === 1) item.socket.send(body); }); }
    broadcastState(room) { room.players.forEach((item, side) => { if (item?.socket?.readyState === 1) item.socket.send(JSON.stringify({ type: 'state', state: this.stateFor(room, side) })); }); }
    broadcastStates(now = Date.now()) { for (const room of this.rooms.values()) if (room.game.phase === 'projectile-flight' && now - room.lastBroadcast >= 40) { room.lastBroadcast = now; this.broadcastState(room); } }
}

module.exports = { BattleTanksRooms };
