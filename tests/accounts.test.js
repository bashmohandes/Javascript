'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../server/database');
const { Accounts } = require('../server/accounts');

function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-accounts-'));
    const database = openDatabase(path.join(directory, 'test.sqlite'));
    t.after(() => { database.close(); fs.rmSync(directory, { recursive: true, force: true }); });
    return new Accounts(database);
}

test('migrates a new database and creates a unique gamertag', async t => {
    const accounts = fixture(t);
    const user = await accounts.create('Player_One', '1234');
    assert.equal(user.gamertag, 'Player_One');
    await assert.rejects(() => accounts.create('player_one', 'different'), /already taken/);
    assert.equal((await accounts.authenticate('PLAYER_ONE', '1234')).id, user.id);
    await assert.rejects(() => accounts.authenticate('Player_One', 'wrong'), /incorrect/);
});

test('persists sessions, profile changes, results, and leaderboards', async t => {
    const accounts = fixture(t);
    const first = await accounts.create('First', 'passcode');
    const second = await accounts.create('Second', 'passcode');
    const session = accounts.createSession(first.id);
    assert.equal(accounts.userForToken(session.token).id, first.id);
    accounts.record(first.id, { game: 'sudoku', score: 99999999, won: true, details: { difficulty: 'medium', seconds: 650, mistakes: 1, hintsUsed: 1 } });
    accounts.record(first.id, { game: 'sudoku', won: true, details: { difficulty: 'easy', seconds: 200, mistakes: 0, hintsUsed: 0 } });
    accounts.record(second.id, { game: 'sudoku', won: true, details: { difficulty: 'hard', seconds: 400, mistakes: 0, hintsUsed: 0 } });
    assert.equal(accounts.profile(first.id).totals[0].games_played, 2);
    assert.deepEqual(accounts.leaderboard('sudoku').map(row => row.gamertag), ['Second', 'First']);
    await assert.rejects(() => accounts.update(first.id, { gamertag: 'Renamed', currentPasscode: 'wrong' }), /Current passcode/);
    await assert.rejects(() => accounts.update(first.id, { gamertag: 'Second', currentPasscode: 'passcode' }), /already taken/);
    assert.equal((await accounts.authenticate('First', 'passcode')).id, first.id, 'a failed update must roll back');
    assert.equal((await accounts.update(first.id, { gamertag: 'Renamed', currentPasscode: 'passcode' })).gamertag, 'Renamed');
    assert.equal(accounts.userForToken(session.token), null);
});

test('validates result structure and derives scores on the server', async t => {
    const accounts = fixture(t);
    const user = await accounts.create('Scorer', 'passcode');
    const sudoku = accounts.record(user.id, { game: 'sudoku', score: 100000000, won: true, details: { difficulty: 'medium', seconds: 300, mistakes: 1, hintsUsed: 2 } });
    assert.equal(sudoku.score, 1650);
    assert.throws(() => accounts.record(user.id, { game: 'pong', won: true, details: { mode: 'online', score: '6-0' } }), /Invalid Pong/);
    assert.throws(() => accounts.record(user.id, { game: 'minesweeper', won: true, details: { difficulty: 'impossible', seconds: 1 } }), /Invalid Minesweeper/);
});
