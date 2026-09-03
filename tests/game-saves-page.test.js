'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = filename => fs.readFileSync(filename, 'utf8');
const games = [
    ['pong/index.html','pong/scripts/app.js'], ['Sudoku/index.html','Sudoku/scripts/app.js'],
    ['Minesweeper/index.html','Minesweeper/scripts/app.js'], ['tictactoe/index.html','tictactoe/scripts/app.js'],
    ['battle-tanks/index.html','battle-tanks/scripts/app.js'], ['tetris/index.html','tetris/scripts/app.js']
];

test('every modern game loads and registers the shared cloud-save manager', () => {
    for (const [pageFile, appFile] of games) {
        const page = read(pageFile), app = read(appFile);
        assert.match(page, /scripts\/game-saves\.js/, pageFile);
        assert.ok(page.indexOf('game-saves.js') < page.indexOf('arcade.js'), `${pageFile} must load saves before the shell`);
        assert.match(app, /registerAdapter\(/, appFile); assert.match(app, /stateVersion:/, appFile);
        assert.match(app, /canSave:/, appFile); assert.match(app, /capture:/, appFile); assert.match(app, /restore:/, appFile); assert.match(app, /thumbnail:/, appFile);
    }
});

test('the save manager provides five slots, sign-in continuation, screenshots, conflicts, and leave protection', () => {
    const manager = read('scripts/game-saves.js'), shell = read('arcade.js'), styles = read('arcade.css');
    assert.match(manager, /\[1,2,3,4,5\]/); assert.match(manager, /SAVE_SLOTS_FULL/); assert.match(manager, /SAVE_CONFLICT/); assert.match(manager, /result\.save\.stateVersion !== adapter\.stateVersion/);
    assert.match(manager, /Quick Save &amp; Exit/); assert.match(manager, /beforeunload/); assert.match(manager, /location\.assign/);
    assert.match(manager, /image\/jpeg/); assert.match(manager, /screenshotUrl/); assert.match(manager, /expectedRevision/);
    assert.match(shell, /requestAuthentication/); assert.match(shell, /saveManager\.button/); assert.match(shell, /saves: saveManager/);
    assert.match(styles, /\.arcade-save-slot/); assert.match(styles, /@media\(max-width:650px\)/);
});

test('save APIs remain authenticated and separate from result authority', () => {
    const server = read('server/index.js'), saves = read('server/saves.js'), migration = read('server/migrations/005_game_saves.sql');
    assert.ok(server.indexOf('const user = sessionUser(request)') < server.indexOf('const saveCollection'));
    assert.match(server, /\/api\\\/saves/); assert.match(server, /saveLimiter/); assert.match(server, /768 \* 1024/);
    assert.match(saves, /UNIQUE|SAVE_SLOTS_FULL/); assert.match(saves, /SAVE_CONFLICT/); assert.doesNotMatch(saves, /leaderboard|achievement|recordResult/);
    assert.match(migration, /UNIQUE \(user_id, game, slot\)/); assert.match(migration, /slot BETWEEN 1 AND 5/); assert.match(migration, /screenshot BLOB NOT NULL/);
});

test('online modes are excluded from restorable cloud slots', () => {
    assert.match(read('pong/scripts/app.js'), /game\.mode !== 'online'/);
    assert.match(read('tictactoe/scripts/app.js'), /game\.mode!=='online'/);
    assert.match(read('battle-tanks/scripts/app.js'), /mode!=='online'/);
    const service = read('server/saves.js');
    assert.doesNotMatch(service.match(/const MODES[\s\S]*?\}\);/)?.[0] || '', /online/);
});
