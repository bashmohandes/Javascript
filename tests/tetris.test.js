'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { TetrisGame, TYPES, MAGIC_BLOCK_POINTS } = require('../tetris/scripts/game');
const { validateResult, Accounts } = require('../server/accounts');
const { Achievements } = require('../server/achievements');
const { openDatabase } = require('../server/database');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const tetrisDetails = overrides => ({ mode:'marathon', seconds:60, lines:4, level:1, pieces:10, singles:0, doubles:0, triples:0, tetrises:1, softDropCells:3, hardDropCells:20, magicPowerUps:0, magicBlocksDestroyed:0, shakePowerUps:0, ...overrides });

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
    assert.deepEqual(game.lastClear, { id:1, count:2, rows:[18,19] });
    game.lines = 9; game.board[21].fill('T'); const slow = game.gravityMs(); game.clearLines();
    assert.equal(game.level, 2); assert.ok(game.gravityMs() < slow); assert.deepEqual(game.lastClear, { id:2, count:1, rows:[19] });
});

test('magic blocks erase every occupied cell in their path and award points', () => {
    const game = new TetrisGame({ random:() => .2, powerUpRandom:() => .4, powerUpChance:0 });
    game.board[2][4] = 'J'; game.board[8][4] = 'L'; game.board[21][4] = 'T';
    assert.equal(game.triggerPowerUp('magic'), true); assert.equal(game.magicBlocksDestroyed, 1); assert.equal(game.piece.type, 'M');
    const distance = game.hardDrop();
    assert.equal(distance, 19); assert.equal(game.magicBlocksDestroyed, 3); assert.equal(game.score, MAGIC_BLOCK_POINTS * 3); assert.equal(game.hardDropCells, 0);
    assert.equal(game.board[2][4], null); assert.equal(game.board[8][4], null); assert.equal(game.board[21][4], null); assert.notEqual(game.piece.type, 'M');
    assert.deepEqual(game.lastDestruction.cells.map(cell => cell.type), ['L','T']);
});

test('random power-up rolls can replace the next tetromino with a magic block', () => {
    const rolls = [0, 0, .3], game = new TetrisGame({ random:() => .2, powerUpRandom:() => rolls.shift() ?? .9, powerUpChance:1, powerUpGrace:0, powerUpCooldown:0 });
    game.hardDrop(); assert.equal(game.pieces, 1); assert.equal(game.piece.type, 'M'); assert.equal(game.magicPowerUps, 1); assert.equal(game.lastPowerUp.type, 'magic');
});

test('power-up rolls wait for the complete grace and cooldown intervals', () => {
    const game = new TetrisGame({ random:() => .2, powerUpRandom:() => 0, powerUpChance:1, powerUpGrace:5, powerUpCooldown:6 });
    game.pieces = 5; assert.equal(game.rollPowerUp(), null);
    game.pieces = 6; assert.equal(game.rollPowerUp(), 'magic');
    game.lastPowerUpPiece = 6; game.pieces = 12; assert.equal(game.rollPowerUp(), null);
    game.pieces = 13; assert.equal(game.rollPowerUp(), 'magic');
});

test('shake power-ups compact columns into gaps and clear newly completed rows', () => {
    const game = new TetrisGame({ random:() => .2, powerUpChance:0 });
    for (let x = 1; x < 10; x += 1) game.board[21][x] = 'S';
    game.board[10][0] = 'I'; game.triggerPowerUp('shake');
    assert.equal(game.shakeReady, true); assert.equal(game.move(1), false); assert.equal(game.update(5000), undefined);
    const result = game.useShake();
    assert.equal(result.count, 1); assert.equal(result.cleared, 1); assert.deepEqual(result.moved[0], { x:0, from:8, to:19, type:'I' });
    assert.equal(game.shakeReady, false); assert.equal(game.shakePowerUps, 1); assert.equal(game.lines, 1); assert.equal(game.score, 100); assert.ok(game.board[21].every(cell => cell === null));
});

test('shake compaction scores more than four completed rows in standard clear groups', () => {
    const game = new TetrisGame({ random:() => .2, powerUpChance:0 }); game.triggerPowerUp('shake');
    for (const y of [8,10,12,14,16,18]) game.board[y].fill('J');
    const result = game.useShake();
    assert.equal(result.cleared, 6); assert.equal(game.lines, 6); assert.equal(game.tetrises, 1); assert.equal(game.doubles, 1); assert.equal(game.score, 1100);
});

test('lock delay pauses safely and top-out ends the run', () => {
    const game = new TetrisGame(); game.piece.y = game.ghostY(); game.update(499); assert.equal(game.pieces, 0); game.update(1); assert.equal(game.pieces, 1);
    game.paused = true; const before = game.piece.y; game.update(5000); assert.equal(game.piece.y, before);
    game.paused = false; game.board[0].fill('Z'); game.spawn('O'); assert.equal(game.gameOver, true);
});

test('server derives Tetris scores and rejects impossible result facts', () => {
    const result = validateResult('tetris', false, tetrisDetails());
    assert.equal(result.score, 843); assert.equal(result.normalizedDetails.tetrises, 1);
    assert.equal(validateResult('tetris', false, tetrisDetails({ magicPowerUps:1, magicBlocksDestroyed:3 })).score, 843 + MAGIC_BLOCK_POINTS * 3);
    assert.equal(validateResult('tetris', false, tetrisDetails({ pieces:5, magicPowerUps:1, magicBlocksDestroyed:20 })).score, 843 + MAGIC_BLOCK_POINTS * 20);
    assert.equal(validateResult('tetris', false, tetrisDetails({ lines:6, doubles:1, tetrises:1, shakePowerUps:1 })).score, 1143);
    assert.throws(() => validateResult('tetris', true, tetrisDetails()), /Invalid Tetris/);
    assert.throws(() => validateResult('tetris', false, tetrisDetails({ lines:5 })), /Invalid Tetris/);
    assert.throws(() => validateResult('tetris', false, tetrisDetails({ level:2 })), /Invalid Tetris/);
    assert.throws(() => validateResult('tetris', false, tetrisDetails({ magicBlocksDestroyed:1 })), /Tetris/);
    assert.throws(() => validateResult('tetris', false, tetrisDetails({ pieces:5, magicPowerUps:1, magicBlocksDestroyed:21 })), /Tetris/);
    assert.throws(() => validateResult('tetris', false, tetrisDetails({ shakePowerUps:11 })), /Tetris/);
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
    assert.match(page, /body class="modern-game game-tetris"/); assert.match(page, /single-player/i); assert.match(page, /id="board"[^>]*tabindex="-1"/);
    assert.match(app, /Arcade\?\.record\(\{ game: 'tetris'/); assert.match(app, /system:theme-changed/); assert.match(app, /ResultShare\.tetris/);
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

test('Tetris keeps phone controls visible alongside the board', () => {
    const page = read('tetris/index.html'), styles = read('tetris/styles.css');
    assert.match(styles, /@media\(max-width:780px\)[^{]*\{[\s\S]*?\.touch-controls\{[^}]*position:fixed;[^}]*bottom:max\(8px,env\(safe-area-inset-bottom\)\)/);
    assert.match(styles, /padding-bottom:calc\(160px \+ env\(safe-area-inset-bottom\)\)/);
    assert.match(styles, /\.game-layout \.tetris-stage\{width:min\([^}]*calc\(\(100dvh - 160px - env\(safe-area-inset-bottom\)\)\/2\)\)/);
    assert.match(styles, /grid-template-columns:minmax\(0,7fr\) minmax\(96px,3fr\)/);
    assert.match(page, /class="tetris-controls"[\s\S]*class="stats"[\s\S]*id="next"/);
});

test('Tetris presents escalating, accessible line-clear effects without delaying play', () => {
    const page = read('tetris/index.html'), app = read('tetris/scripts/app.js'), styles = read('tetris/styles.css');
    assert.match(page, /id="line-clear-effect"[^>]*aria-hidden="true"/); assert.match(page, /id="clear-multiplier">x1/);
    assert.match(app, /game\.lastClear/); assert.match(app, /dataset\.clearIntensity = Math\.min\(4, clear\.count\)/); assert.match(app, /`x\$\{clear\.count\}`/);
    assert.match(styles, /data-clear-intensity="2"/); assert.match(styles, /data-clear-intensity="3"/); assert.match(styles, /data-clear-intensity="4"/);
    assert.match(styles, /@keyframes clear-streak/); assert.match(styles, /@keyframes clear-board-jolt/); assert.match(styles, /prefers-reduced-motion:reduce/);
    assert.doesNotMatch(app, /game\.paused\s*=.*clear|clear.*game\.paused/);
});

test('Tetris updates and celebrates the live high score during a run', () => {
    const page = read('tetris/index.html'), app = read('tetris/scripts/app.js'), styles = read('tetris/styles.css');
    assert.match(page, /class="best-stat"[\s\S]*id="best"/); assert.match(page, /id="record-callout"/);
    assert.match(app, /game\.score > liveBest/); assert.match(app, /function celebrateHighScore/); assert.match(app, /localStorage\.setItem\('tetris-best-score', liveBest\)/);
    assert.match(styles, /\.best-stat\.is-record/); assert.match(styles, /@keyframes new-record/);
});

test('Tetris presents magic destruction and accessible motion-powered compaction', () => {
    const page = read('tetris/index.html'), app = read('tetris/scripts/app.js'), styles = read('tetris/styles.css');
    assert.match(page, /id="magic-destruction"/); assert.match(page, /id="compaction-effect"/); assert.match(page, /id="power-up-banner"[^>]*aria-live="assertive"/); assert.match(page, /id="use-shake"/);
    assert.match(app, /game\.lastDestruction/); assert.match(app, /game\.lastCompaction/); assert.match(app, /DeviceMotionEvent\.requestPermission/); assert.match(app, /addEventListener\('devicemotion', handleDeviceMotion\)/); assert.match(app, /force > 22/); assert.match(app, /event\.code === 'KeyS'/);
    assert.match(styles, /@keyframes magic-screen-glow/); assert.match(styles, /@keyframes magic-impact/); assert.match(styles, /@keyframes compact-fall/); assert.match(styles, /@keyframes stage-shake/); assert.match(styles, /prefers-reduced-motion:reduce/);
});
