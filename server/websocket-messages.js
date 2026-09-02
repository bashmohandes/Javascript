'use strict';

function send(socket, message) {
    if (socket.readyState === 1) socket.send(JSON.stringify(message));
}

function parseMessage(raw) {
    let message;
    try { message = JSON.parse(raw.toString()); }
    catch { throw new Error('Invalid message.'); }
    if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('Invalid message.');
    return message;
}

function sessionMessage(room, player, { includePlayerId = false } = {}) {
    const message = {
        type: 'session',
        roomCode: room.code,
        playerToken: player.token,
        side: player.side,
        visibility: room.visibility,
        gamertags: room.players.map(candidate => candidate?.gamertag || null)
    };
    if (includePlayerId) message.playerId = player.id;
    return message;
}

function roomStatusMessage(room) {
    return {
        type: 'room-status',
        players: room.players.map(player => Boolean(player?.connected)),
        ready: room.players.map(player => Boolean(player?.ready)),
        gamertags: room.players.map(player => player?.gamertag || null)
    };
}

module.exports = { parseMessage, roomStatusMessage, send, sessionMessage };
