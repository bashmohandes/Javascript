'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../server/database');
const { Accounts } = require('../server/accounts');
const { Achievements, catalog, matches } = require('../server/achievements');

function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-achievements-'));
    const database = openDatabase(path.join(directory, 'test.sqlite'));
    t.after(() => { database.close(); fs.rmSync(directory, { recursive: true, force: true }); });
    const achievements = new Achievements(database);
    return { accounts: new Accounts(database, achievements), achievements };
}

test('catalog has stable unique ids and achievements for every game', () => {
    assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
    assert.deepEqual(new Set(catalog.map(item => item.game)), new Set(['pong', 'sudoku', 'minesweeper', 'tictactoe', 'battletanks']));
    for (const item of catalog) assert.ok(item.title && item.condition && item.target > 0);
});

test('declarative matcher supports nested equality and numeric bounds', () => {
    assert.equal(matches({ won: true, 'details.seconds': { lte: 59 }, 'details.mode': 'online' }, { won: true, details: { seconds: 42, mode: 'online' } }), true);
    assert.equal(matches({ 'details.seconds': { lte: 10 } }, { details: { seconds: 42 } }), false);
});

test('result events unlock once and cumulative progress persists', async t => {
    const { accounts, achievements } = fixture(t);
    const user = await accounts.create('BadgeHunter', 'passcode');
    const clean = { game: 'sudoku', won: true, details: { difficulty: 'easy', seconds: 90, mistakes: 0, hintsUsed: 0 } };
    const first = accounts.record(user.id, clean);
    assert.deepEqual(first.unlocked.map(item => item.id).sort(), ['sudoku-clean', 'sudoku-first']);
    assert.equal(achievements.list(user.id, 'sudoku').find(item => item.id === 'sudoku-five').progress, 1);
    assert.equal(accounts.record(user.id, clean).unlocked.some(item => item.id === 'sudoku-first'), false);
    accounts.record(user.id, clean); accounts.record(user.id, clean);
    const fifth = accounts.record(user.id, clean);
    assert.equal(fifth.unlocked.some(item => item.id === 'sudoku-five'), true);
    assert.equal(accounts.profile(user.id).achievements.filter(item => item.unlocked).length, 3);
});

test('achievement progress is isolated between users', async t => {
    const { accounts, achievements } = fixture(t);
    const winner = await accounts.create('Winner', 'passcode');
    const newcomer = await accounts.create('Newcomer', 'passcode');
    accounts.record(winner.id, { game: 'pong', won: true, details: { mode: 'solo', score: '7-0', seconds: 50 } });
    assert.ok(achievements.list(winner.id, 'pong').some(item => item.unlocked));
    assert.ok(achievements.list(newcomer.id, 'pong').every(item => !item.unlocked));
});
