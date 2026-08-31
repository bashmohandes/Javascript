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
    const pong = accounts.record(user.id, { game: 'pong', won: true, details: { mode: 'online', score: '7-3', seconds: 125 } });
    assert.equal(pong.score, 703);
    assert.equal(accounts.leaderboard('pong')[0].details.seconds, 125);
    assert.throws(() => accounts.record(user.id, { game: 'minesweeper', won: true, details: { difficulty: 'impossible', seconds: 1 } }), /Invalid Minesweeper/);
});

test('faster time breaks ties on the leaderboard', async t => {
    const accounts = fixture(t);
    const fast = await accounts.create('Fast', 'passcode');
    const slow = await accounts.create('Slow', 'passcode');
    accounts.record(slow.id, { game: 'pong', won: true, details: { mode: 'solo', score: '7-2', seconds: 180 } });
    const record = accounts.record(fast.id, { game: 'pong', won: true, details: { mode: 'solo', score: '7-2', seconds: 90 } });
    assert.deepEqual(accounts.leaderboard('pong').map(row => row.gamertag), ['Fast', 'Slow']);
    assert.deepEqual(record.topScore, { game: 'pong', previousScore: 702, newScore: 702, previousHolder: 'Slow', previousSeconds: 180, newSeconds: 90 });
});

test('reports a newly broken top score with the old and new scores', async t => {
    const accounts = fixture(t);
    const first = await accounts.create('FirstChamp', 'passcode');
    const challenger = await accounts.create('NextChamp', 'passcode');
    const initial = accounts.record(first.id, { game: 'pong', won: true, details: { mode: 'solo', score: '7-2', seconds: 90 } });
    const lower = accounts.record(challenger.id, { game: 'pong', won: true, details: { mode: 'solo', score: '7-1', seconds: 60 } });
    const record = accounts.record(challenger.id, { game: 'pong', won: true, details: { mode: 'solo', score: '7-3', seconds: 80 } });
    assert.equal(initial.topScore, null, 'the first score does not break an existing record');
    assert.equal(lower.topScore, null);
    assert.deepEqual(record.topScore, { game: 'pong', previousScore: 702, newScore: 703, previousHolder: 'FirstChamp', previousSeconds: 90, newSeconds: 80 });
});

test('paginates profile history ten most-recent games at a time', async t => {
    const accounts = fixture(t);
    const user = await accounts.create('Historian', 'passcode');
    for (let index = 0; index < 23; index += 1) accounts.record(user.id, { game: 'pong', won: true, details: { mode: 'solo', score: `7-${index % 7}`, seconds: index + 1 } });
    const firstPage = accounts.profile(user.id);
    const lastPage = accounts.profile(user.id, 3);
    assert.equal(firstPage.recent.length, 10);
    assert.deepEqual(firstPage.pagination, { page: 1, pageSize: 10, totalGames: 23, totalPages: 3 });
    assert.equal(lastPage.recent.length, 3);
    assert.ok(firstPage.recent[0].id > lastPage.recent[0].id);
});

test('validates Battle Tanks results, derives scores, ranks players, and persists history', async t => {
    const accounts = fixture(t);
    const ace = await accounts.create('TankAce', 'passcode');
    const rival = await accounts.create('TankRival', 'passcode');
    const victory = { game: 'battletanks', won: true, details: { mode: 'local', winner: 1, turns: 4, shots: 4, hits: 2, seconds: 40, damageTaken: 0 } };
    const result = accounts.record(ace.id, { ...victory, score: 999999 });
    assert.equal(result.score, 14460, 'client-provided scores must not be trusted');
    accounts.record(rival.id, { game: 'battletanks', won: true, details: { mode: 'local', winner: 1, turns: 5, shots: 5, hits: 4, seconds: 20, damageTaken: 37 } });
    assert.deepEqual(accounts.leaderboard('battletanks').map(row => row.gamertag), ['TankRival', 'TankAce']);
    assert.deepEqual(accounts.leaderboard('battletanks')[0].details, { mode: 'local', winner: 1, turns: 5, shots: 5, hits: 4, accuracy: 80, seconds: 20, damageTaken: 37, powerUpsAcquired: 0, powerUpsUsed: 0, powerUpTypesUsed: [], shieldDamageAbsorbed: 0, healthRestored: 0, invisibilityActivations: 0, laserRicochetHits: 0, laserSelfDamage: 0, homingHits: 0, heavyProjectileMaxDamage: 0, poweredHits: 0 });
    const history = accounts.profile(ace.id).recent.find(row => row.game === 'battletanks');
    assert.deepEqual(history.details, { mode: 'local', winner: 1, turns: 4, shots: 4, hits: 2, accuracy: 50, seconds: 40, damageTaken: 0, powerUpsAcquired: 0, powerUpsUsed: 0, powerUpTypesUsed: [], shieldDamageAbsorbed: 0, healthRestored: 0, invisibilityActivations: 0, laserRicochetHits: 0, laserSelfDamage: 0, homingHits: 0, heavyProjectileMaxDamage: 0, poweredHits: 0 });

    const invalid = [
        { ...victory, won: false },
        { ...victory, details: { ...victory.details, turns: 3 } },
        { ...victory, details: { ...victory.details, hits: 5 } },
        { ...victory, details: { ...victory.details, damageTaken: 100 } },
        { ...victory, won: false, details: { ...victory.details, winner: 2, damageTaken: 99 } }
    ];
    for (const payload of invalid) assert.throws(() => accounts.record(ace.id, payload), /Invalid Battle Tanks/);
    assert.throws(() => accounts.record(ace.id, { game: 'battletanks', won: true, details: { mode: 'online', winner: 1, turns: 5, shots: 3, hits: 2, seconds: 30, damageTaken: 50 } }), /Invalid Battle Tanks/);
    const online = accounts.record(ace.id, { game: 'battletanks', won: true, details: { mode: 'online', winner: 1, turns: 5, shots: 3, hits: 2, seconds: 30, damageTaken: 63 } }, { trustedOnline: true });
    assert.equal(online.score, 15283);
});

test('Battle Tanks solo scores use only human shots and never reward a CPU victory', async t => {
    const accounts = fixture(t), user = await accounts.create('SoloTanker', 'passcode');
    const loss = accounts.record(user.id, { game: 'battletanks', won: false, details: { mode: 'solo', winner: 2, turns: 8, shots: 4, hits: 4, seconds: 70, damageTaken: 100 } });
    assert.equal(loss.score, 0, 'even perfect human accuracy cannot turn a CPU victory into leaderboard points');
    const win = accounts.record(user.id, { game: 'battletanks', won: true, details: { mode: 'solo', winner: 1, turns: 7, shots: 4, hits: 2, seconds: 65, damageTaken: 75 } });
    assert.equal(win.score, 14430); assert.equal(accounts.leaderboard('battletanks')[0].score, 14430);
    assert.deepEqual(accounts.leaderboard('battletanks')[0].details, { mode: 'solo', winner: 1, turns: 7, shots: 4, hits: 2, accuracy: 50, seconds: 65, damageTaken: 75, powerUpsAcquired: 0, powerUpsUsed: 0, powerUpTypesUsed: [], shieldDamageAbsorbed: 0, healthRestored: 0, invisibilityActivations: 0, laserRicochetHits: 0, laserSelfDamage: 0, homingHits: 0, heavyProjectileMaxDamage: 0, poweredHits: 0 });
    assert.throws(() => accounts.record(user.id, { game: 'battletanks', won: true, details: { mode: 'solo', winner: 1, turns: 7, shots: 5, hits: 2, seconds: 65, damageTaken: 75 } }), /Invalid Battle Tanks/);
});


test('validates bounded Battle Tanks power-up achievement statistics', async t => {
    const accounts = fixture(t), user = await accounts.create('PowerStats', 'passcode');
    const base = { game: 'battletanks', won: true, details: { mode: 'local', winner: 1, turns: 4, shots: 4, hits: 2, seconds: 30, damageTaken: 0, weapons: { laser: 1, homing: 1, 'heavy-shell': 1 }, powerUpsAcquired: 3, powerUpsUsed: 3, powerUpTypesUsed: ['weapon-laser', 'weapon-homing', 'weapon-heavy-shell'] } };
    assert.doesNotThrow(() => accounts.record(user.id, base));
    for (const change of [{ powerUpTypesUsed: ['unknown'] }, { powerUpTypesUsed: ['shield', 'shield'] }, { powerUpsUsed: -1 }, { powerUpsUsed: 4 }, { invisibilityActivations: 1 }, { homingHits: 2 }, { heavyProjectileMaxDamage: 101 }, { healthRestored: 106 }, { shieldDamageAbsorbed: 181 }, { powerUpTypesUsed: Array(10).fill('shield') }]) assert.throws(() => accounts.record(user.id, { ...base, details: { ...base.details, ...change } }), /Invalid Battle Tanks/);
    const online = { ...base, details: { ...base.details, mode: 'online', turns: 6, shots: 4, invisibilityActivations: 1, powerUpTypesUsed: ['invisibility', 'weapon-homing', 'weapon-laser'] } };
    assert.throws(() => accounts.record(user.id, online), /Invalid Battle Tanks mode/);
    assert.doesNotThrow(() => accounts.record(user.id, online, { trustedOnline: true }));
});
