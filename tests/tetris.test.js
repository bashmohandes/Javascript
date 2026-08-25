'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TetrisGame, TYPES } = require('../tetris/scripts/game');
const { validateResult, Accounts } = require('../server/accounts');
const { Achievements } = require('../server/achievements');
const { openDatabase } = require('../server/database');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const tetrisDetails = overrides => ({ mode:'marathon', seconds:60, lines:4, level:1, pieces:10, singles:0, doubles:0, triples:0, tetrises:1, softDropCells:3, hardDropCells:20, ...overrides });

test('seven-bag generation contains every tetromino exactly once', () => {
    const game = new TetrisGame({ random: () => .5 });
    assert.deepEqual(new Set([game.piece.type, ...game.queue.slice(0, 6)]), new Set(TYPES));
});

test('movement, rotation, hold, ghost, and hard drop obey game boundaries', () => {
    const game = new TetrisGame({ random: () => .2 });
    while (game.move(-1));
    assert.ok(game.activeCells().every(([x]) => x >= 0));
    assert.equal(game.rotate(1), true);
    const first = game.piece.type;
    assert.equal(game.hold(), true); assert.equal(game.holdType, first); assert.equal(game.hold(), false);
    const ghost = game.ghostY(); assert.ok(ghost > game.piece.y);
    const distance = game.hardDrop(); assert.equal(distance, ghost); assert.equal(game.pieces, 1); assert.equal(game.hardDropCells, distance);
});

test('line clears update counters, score, level, and gravity', () => {
    const game = new TetrisGame();
    game.board[21].fill('J'); game.board[20].fill('L');
    assert.equal(game.clearLines(), 2); assert.equal(game.doubles, 1); assert.equal(game.lines, 2); assert.equal(game.score, 300);
    game.lines = 9; game.board[21].fill('T'); const slow = game.gravityMs(); game.clearLines();
    assert.equal(game.level, 2); assert.ok(game.gravityMs() < slow);
});

test('lock delay pauses safely and top-out ends the run', () => {
    const game = new TetrisGame(); game.piece.y = game.ghostY(); game.update(499); assert.equal(game.pieces, 0); game.update(1); assert.equal(game.pieces, 1);
    game.paused = true; const before = game.piece.y; game.update(5000); assert.equal(game.piece.y, before);
    game.paused = false; game.board[0].fill('Z'); game.spawn('O'); assert.equal(game.gameOver, true);
});

test('server derives Tetris scores and rejects impossible result facts', () => {
    const result = validateResult('tetris', false, tetrisDetails());
    assert.equal(result.score, 843); assert.equal(result.normalizedDetails.tetrises, 1);
    assert.throws(() => validateResult('tetris', true, tetrisDetails()), /Invalid Tetris/);
    assert.throws(() => validateResult('tetris', false, tetrisDetails({ lines:5 })), /Invalid Tetris/);
    assert.throws(() => validateResult('tetris', false, tetrisDetails({ level:2 })), /Invalid Tetris/);
});

test('accounts persist Tetris history, total lines, top scores, and achievements', async t => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-tetris-')), database = openDatabase(path.join(directory, 'test.sqlite'));
    t.after(() => { database.close(); fs.rmSync(directory, { recursive:true, force:true }); });
    const achievements = new Achievements(database), accounts = new Accounts(database, achievements);
    const first = await accounts.create('StackerOne', 'passcode'), second = await accounts.create('StackerTwo', 'passcode');
    const initial = accounts.record(first.id, { game:'tetris', won:false, details:tetrisDetails() });
    assert.equal(initial.topScore, null); assert.ok(initial.unlocked.some(item => item.id === 'tetris-first')); assert.ok(initial.unlocked.some(item => item.id === 'tetris-four-line'));
    const record = accounts.record(second.id, { game:'tetris', won:false, details:tetrisDetails({ tetrises:2, lines:8, pieces:15 }) });
    assert.equal(record.topScore.game, 'tetris'); assert.deepEqual(accounts.leaderboard('tetris').map(row => row.gamertag), ['StackerTwo','StackerOne']);
    const levelTen = accounts.record(second.id, { game:'tetris', won:false, details:tetrisDetails({ lines:90, level:10, pieces:100, doubles:1, tetrises:22 }) });
    assert.ok(levelTen.unlocked.some(item => item.id === 'tetris-level-ten'));
    const profile = accounts.profile(first.id); assert.equal(profile.totals.find(row => row.game === 'tetris').total_lines, 4); assert.equal(profile.recent[0].game, 'tetris');
    for (let run = 2; run <= 5; run += 1) accounts.record(first.id, { game:'tetris', won:false, details:tetrisDetails() });
    assert.equal(achievements.list(first.id, 'tetris').find(item => item.id === 'tetris-five').progress, 5);
});

test('Tetris is wired into themes, accounts, sharing, homepage, profile, and APIs', () => {
    const page = read('tetris/index.html'), app = read('tetris/scripts/app.js'), server = read('server/index.js');
    for (const asset of ['theme-init.js', 'styles/modern-game.css', 'arcade.css', 'scripts/share-result.js', 'scripts/game.js', 'scripts/app.js']) assert.ok(page.includes(asset), `${asset} should load on Tetris`);
    assert.match(page, /body class="modern-game game-tetris"/); assert.match(page, /single-player/i);
    assert.match(app, /Arcade\?\.record\(\{ game: 'tetris'/); assert.match(app, /arcade:theme/); assert.match(app, /ResultShare\.tetris/);
    assert.match(read('index.html'), /href="tetris\/index\.html"/); assert.match(read('profile.html'), /data-game="tetris"/); assert.match(read('profile.js'), /tetris: 'Tetris'/);
    assert.match(server, /leaderboards[^\n]*tetris/); assert.match(server, /achievements[^\n]*tetris/); assert.match(read('scripts/share-result.js'), /window\.ResultShare = \{[^}]*tetris/);
});

test('Tetris preserves elapsed time while bounding simulation steps and ignores dialog shortcuts', () => {
    const app = read('tetris/scripts/app.js');
    assert.match(app, /const elapsed = Math\.max\(0, now - lastFrame\)/);
    assert.match(app, /activeMilliseconds \+= elapsed/);
    assert.match(app, /while \(remaining > 0 && !game\.gameOver\)[^\n]*Math\.min\(100, remaining\)/);
    assert.doesNotMatch(app, /Math\.min\(100, now - lastFrame\)/);
    assert.match(app, /event\.defaultPrevented \|\| interactive \|\| document\.querySelector\('dialog\[open\]'\)/);
    assert.match(app, /button,a,input,select,textarea,dialog/);
});
