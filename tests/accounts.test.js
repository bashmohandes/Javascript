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

test('migrates a new database and creates a unique gamertag', t => {
    const accounts = fixture(t);
    const user = accounts.create('Player_One', '1234');
    assert.equal(user.gamertag, 'Player_One');
    assert.throws(() => accounts.create('player_one', 'different'), /already taken/);
    assert.equal(accounts.authenticate('PLAYER_ONE', '1234').id, user.id);
    assert.throws(() => accounts.authenticate('Player_One', 'wrong'), /incorrect/);
});

test('persists sessions, profile changes, results, and leaderboards', t => {
    const accounts = fixture(t);
    const first = accounts.create('First', 'passcode');
    const second = accounts.create('Second', 'passcode');
    const session = accounts.createSession(first.id);
    assert.equal(accounts.userForToken(session.token).id, first.id);
    accounts.record(first.id, { game: 'sudoku', score: 1200, won: true, details: { difficulty: 'medium' } });
    accounts.record(first.id, { game: 'sudoku', score: 900, won: true });
    accounts.record(second.id, { game: 'sudoku', score: 1400, won: true });
    assert.equal(accounts.profile(first.id).totals[0].games_played, 2);
    assert.deepEqual(accounts.leaderboard('sudoku').map(row => row.gamertag), ['Second', 'First']);
    assert.equal(accounts.update(first.id, { gamertag: 'Renamed' }).gamertag, 'Renamed');
    accounts.deleteSession(session.token);
    assert.equal(accounts.userForToken(session.token), null);
});
