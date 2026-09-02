'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { createRoomCode, createRoomToken, normalizePasscode, ROOM_CODE_ALPHABET } = require('../server/room-identity');

test('shared room codes are readable and avoid collisions', () => {
    assert.equal(ROOM_CODE_ALPHABET.includes('I'), false);
    assert.equal(ROOM_CODE_ALPHABET.includes('O'), false);
    assert.equal(createRoomCode(new Map(), () => 0), 'AAAAA');
    let calls = 0;
    assert.equal(createRoomCode(new Map([['AAAAA', true]]), () => calls++ < 5 ? 0 : .1), 'DDDDD');
});

test('shared room tokens and passcodes preserve existing contracts', () => {
    assert.match(createRoomToken(), /^[A-Za-z0-9_-]{32}$/);
    assert.equal(normalizePasscode('  shell7  '), 'shell7');
    assert.equal(normalizePasscode(null), '');
});
