'use strict';

const crypto = require('node:crypto');

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createRoomCode(rooms, random = Math.random) {
    let code;
    do {
        code = Array.from({ length: 5 }, () => ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]).join('');
    } while (rooms.has(code));
    return code;
}

function createRoomToken() {
    return crypto.randomBytes(24).toString('base64url');
}

function normalizePasscode(value) {
    return String(value || '').trim();
}

module.exports = { createRoomCode, createRoomToken, normalizePasscode, ROOM_CODE_ALPHABET };
