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
    assert.deepEqual(new Set(catalog.map(item => item.game)), new Set(['pong', 'sudoku', 'minesweeper', 'tictactoe', 'battletanks', 'tetris']));
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

test('live checkpoints unlock eligible milestones without recording results or cumulative progress', async t => {
    const { accounts, achievements } = fixture(t);
    const user = await accounts.create('LiveBadges', 'passcode');
    const tetris = { game: 'tetris', details: { mode: 'marathon', seconds: 80, lines: 40, level: 5, pieces: 25, singles: 0, doubles: 0, triples: 0, tetrises: 10, softDropCells: 0, hardDropCells: 0 } };
    assert.deepEqual(accounts.checkpoint(user.id, tetris).unlocked.map(item => item.id), ['tetris-four-line']);
    assert.equal(accounts.profile(user.id).recent.length, 0);
    assert.equal(achievements.list(user.id, 'tetris').find(item => item.id === 'tetris-five').progress, 0);
    assert.deepEqual(accounts.checkpoint(user.id, tetris).unlocked, []);
    const result = accounts.record(user.id, { ...tetris, won: false });
    assert.equal(result.unlocked.some(item => item.id === 'tetris-four-line'), false);
    assert.equal(achievements.list(user.id, 'tetris').find(item => item.id === 'tetris-five').progress, 1);
});

test('Battle Tanks checkpoints validate bounded facts and leave terminal badges locked', async t => {
    const { accounts, achievements } = fixture(t);
    const user = await accounts.create('LiveTank', 'passcode');
    const checkpoint = { game: 'battletanks', details: { mode: 'solo', shots: 3, weapons: { laser: 1, homing: 1, 'heavy-shell': 1 }, powerUpsAcquired: 3, powerUpsUsed: 3, powerUpTypesUsed: ['weapon-laser', 'weapon-homing', 'weapon-heavy-shell'], shieldDamageAbsorbed: 50, laserRicochetHits: 1, homingHits: 1, heavyProjectileMaxDamage: 40 } };
    const unlocked = accounts.checkpoint(user.id, checkpoint).unlocked.map(item => item.id);
    for (const id of ['tanks-power-first','tanks-power-variety','tanks-shield-break','tanks-laser-ricochet','tanks-homing-hit','tanks-heavy-hit']) assert.ok(unlocked.includes(id), id);
    assert.equal(achievements.list(user.id, 'battletanks').find(item => item.id === 'tanks-first').unlocked, false);
    assert.equal(achievements.list(user.id, 'battletanks').find(item => item.id === 'tanks-power-collector').progress, 0);
    assert.throws(() => accounts.checkpoint(user.id, { ...checkpoint, details: { ...checkpoint.details, homingHits: 2 } }), /Invalid Battle Tanks/);
    assert.throws(() => accounts.checkpoint(user.id, { game: 'battletanks', details: { ...checkpoint.details, mode: 'online' } }), /Invalid achievement checkpoint/);
});

test('achievement progress is isolated between users', async t => {
    const { accounts, achievements } = fixture(t);
    const winner = await accounts.create('Winner', 'passcode');
    const newcomer = await accounts.create('Newcomer', 'passcode');
    accounts.record(winner.id, { game: 'pong', won: true, details: { mode: 'solo', score: '7-0', seconds: 50 } });
    assert.ok(achievements.list(winner.id, 'pong').some(item => item.unlocked));
    assert.ok(achievements.list(newcomer.id, 'pong').every(item => !item.unlocked));
});

test('Battle Tanks catalog is public and signed-in progress unlocks each badge only once', async t => {
    const { accounts, achievements } = fixture(t);
    const anonymous = achievements.list(null, 'battletanks');
    assert.deepEqual(anonymous.slice(0, 5).map(item => item.id), ['tanks-first', 'tanks-win', 'tanks-accurate', 'tanks-untouched', 'tanks-online']);
    assert.equal(anonymous.length, 16);
    assert.ok(anonymous.every(item => item.progress === 0 && !item.unlocked));

    const user = await accounts.create('TankBadges', 'passcode');
    const payload = { game: 'battletanks', won: true, details: { mode: 'local', winner: 1, turns: 4, shots: 4, hits: 2, seconds: 50, damageTaken: 0 } };
    const first = accounts.record(user.id, payload);
    assert.deepEqual(first.unlocked.map(item => item.id).sort(), ['tanks-first', 'tanks-win', 'tanks-accurate', 'tanks-untouched'].sort());
    const signedIn = achievements.list(user.id, 'battletanks');
    assert.ok(signedIn.slice(0, 4).every(item => item.progress === 1 && item.unlocked));
    assert.equal(signedIn.find(item => item.id === 'tanks-online').unlocked, false);
    assert.deepEqual(accounts.record(user.id, payload).unlocked, []);
    assert.ok(achievements.list(user.id, 'battletanks').slice(0, 4).every(item => item.progress === 1));
});


test('Battle Tanks tactical boundaries and per-match Deck Builder progress are precise and isolated', async t => {
    const { accounts, achievements } = fixture(t), first = await accounts.create('PowerOne', 'passcode'), second = await accounts.create('PowerTwo', 'passcode');
    const payload = details => ({ game: 'battletanks', won: true, details: { mode: 'online', winner: 1, turns: 10, shots: 5, hits: 3, seconds: 60, damageTaken: 20, weapons: { laser: 1, homing: 1, 'heavy-shell': 1 }, powerUpsAcquired: 3, powerUpsUsed: 3, powerUpTypesUsed: ['weapon-laser', 'weapon-homing', 'weapon-heavy-shell'], ...details } });
    const below = accounts.record(first.id, payload({ shieldDamageAbsorbed: 49, healthRestored: 24, laserRicochetHits: 0, laserSelfDamage: 0, homingHits: 0, heavyProjectileMaxDamage: 39, poweredHits: 1 }), { trustedOnline: true });
    assert.equal(below.unlocked.some(item => ['tanks-shield-break','tanks-second-wind','tanks-laser-ricochet','tanks-laser-self-hit','tanks-homing-hit','tanks-heavy-hit','tanks-powered-win'].includes(item.id)), false);
    const boundary = accounts.record(first.id, payload({ shieldDamageAbsorbed: 50, healthRestored: 25, laserRicochetHits: 1, laserSelfDamage: 1, homingHits: 1, heavyProjectileMaxDamage: 40, poweredHits: 2, invisibilityActivations: 1, powerUpTypesUsed: ['invisibility','weapon-laser','weapon-homing'] }), { trustedOnline: true });
    for (const id of ['tanks-shield-break','tanks-second-wind','tanks-invisible-win','tanks-laser-ricochet','tanks-laser-self-hit','tanks-homing-hit','tanks-heavy-hit','tanks-powered-win']) assert.equal(boundary.unlocked.filter(item => item.id === id).length, 1, id);
    assert.deepEqual(accounts.record(first.id, payload({}), { trustedOnline: true }).unlocked.filter(item => item.id !== 'tanks-power-collector'), []);
    for (let match = 3; match <= 10; match += 1) accounts.record(first.id, payload({}), { trustedOnline: true });
    assert.equal(achievements.list(first.id, 'battletanks').find(item => item.id === 'tanks-power-collector').progress, 10);
    assert.equal(achievements.list(second.id, 'battletanks').find(item => item.id === 'tanks-power-collector').progress, 0);
    const local = { ...payload({ invisibilityActivations: 0 }).details, mode: 'local', turns: 5, shots: 5 };
    assert.equal(accounts.record(second.id, { game: 'battletanks', won: true, details: local }).unlocked.some(item => item.id === 'tanks-invisible-win'), false);
});
