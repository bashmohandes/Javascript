'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase } = require('../server/database');
const { GameSaves, SaveError, MAX_SCREENSHOT_BYTES, MAX_STATE_BYTES } = require('../server/saves');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-saves-'));
    const database = openDatabase(path.join(directory, 'test.sqlite'));
    database.prepare("INSERT INTO users (id, gamertag, passcode_hash) VALUES (1, 'First', 'unused'), (2, 'Second', 'unused')").run();
    t.after(() => { database.close(); fs.rmSync(directory, { recursive: true, force: true }); });
    return { database, saves: new GameSaves(database) };
}
function payload(change = {}) {
    return { title: '', mode: 'marathon', stateVersion: 1, state: { board: [[null]], score: 40 }, elapsedSeconds: 12, scoreLabel: '40 points', screenshot: { mimeType: 'image/png', data: PNG }, ...change };
}

test('allocates five ordered slots and rejects a sixth save atomically', t => {
    const { saves } = fixture(t);
    for (let slot = 1; slot <= 5; slot += 1) assert.equal(saves.create(1, 'tetris', payload({ title: `Run ${slot}` })).slot, slot);
    assert.deepEqual(saves.list(1, 'tetris').map(save => save.slot), [1,2,3,4,5]);
    assert.throws(() => saves.create(1, 'tetris', payload()), error => error instanceof SaveError && error.status === 409 && error.code === 'SAVE_SLOTS_FULL');
});

test('loads private state and screenshot while isolating users and games', t => {
    const { saves } = fixture(t), created = saves.create(1, 'tetris', payload());
    assert.deepEqual(saves.load(1, 'tetris', created.slot).state, { board: [[null]], score: 40 });
    assert.equal(saves.screenshot(1, 'tetris', created.slot).data.toString('base64'), PNG);
    assert.throws(() => saves.load(2, 'tetris', created.slot), /not found/i);
    assert.throws(() => saves.load(1, 'sudoku', created.slot), /not found/i);
});

test('updates, renames, and deletes only with the current revision', t => {
    const { saves } = fixture(t), first = saves.create(1, 'tetris', payload());
    const updated = saves.update(1, 'tetris', 1, payload({ expectedRevision: first.revision, state: { score: 90 }, scoreLabel: '90 points' }));
    assert.equal(updated.revision, 2); assert.equal(saves.load(1, 'tetris', 1).state.score, 90);
    assert.throws(() => saves.update(1, 'tetris', 1, payload({ expectedRevision: 1 })), error => error.code === 'SAVE_CONFLICT' && error.current.revision === 2);
    const renamed = saves.rename(1, 'tetris', 1, { title: 'Final tower', expectedRevision: 2 });
    assert.equal(renamed.title, 'Final tower'); assert.equal(renamed.revision, 3);
    assert.throws(() => saves.delete(1, 'tetris', 1, 2), error => error.code === 'SAVE_CONFLICT');
    assert.deepEqual(saves.delete(1, 'tetris', 1, 3), { ok: true });
    assert.deepEqual(saves.list(1, 'tetris'), []);
});

test('validates games, modes, metadata, state size, and real image signatures', t => {
    const { saves } = fixture(t);
    assert.throws(() => saves.create(1, 'unknown', payload()), /Unknown game/);
    assert.throws(() => saves.create(1, 'tetris', payload({ mode: 'online' })), /mode/);
    assert.throws(() => saves.create(1, 'tetris', payload({ elapsedSeconds: -1 })), /elapsed/);
    assert.throws(() => saves.create(1, 'tetris', payload({ title: 'x'.repeat(61) })), /title/);
    assert.throws(() => saves.create(1, 'tetris', payload({ state: { data: 'x'.repeat(MAX_STATE_BYTES) } })), /state is too large/);
    assert.throws(() => saves.create(1, 'tetris', payload({ screenshot: { mimeType: 'image/png', data: Buffer.alloc(MAX_SCREENSHOT_BYTES + 1).toString('base64') } })), /screenshot is too large/);
    assert.throws(() => saves.create(1, 'tetris', payload({ screenshot: { mimeType: 'image/png', data: Buffer.from('not a png').toString('base64') } })), /screenshot/);
});

test('account deletion cascades to cloud saves', t => {
    const { database, saves } = fixture(t);
    saves.create(1, 'tetris', payload()); database.prepare('DELETE FROM users WHERE id = 1').run();
    assert.equal(database.prepare('SELECT COUNT(*) count FROM game_saves').get().count, 0);
});
