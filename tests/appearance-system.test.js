'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const init = fs.readFileSync('theme-init.js', 'utf8');
const runtime = fs.readFileSync('arcade.js', 'utf8');
const shared = fs.readFileSync('arcade.css', 'utf8');
const games = fs.readFileSync('styles/modern-game.css', 'utf8');

test('registry provides three curated themes with independent color preferences', () => {
    for (const theme of ['playful', 'cabinet', 'calm']) assert.match(init, new RegExp(`id: '${theme}'`));
    assert.match(init, /colorPreferences: Object\.freeze\(\['system', 'light', 'dark'\]\)/);
    assert.match(init, /arcade-experience-theme/);
    assert.match(init, /arcade-color-preference/);
});

test('appearance dialog exposes theme cards and an accessible color radiogroup', () => {
    assert.match(runtime, /className = 'arcade-dialog arcade-appearance-dialog'/);
    assert.match(runtime, /data-theme-option/);
    assert.match(runtime, /role="radiogroup"/);
    assert.match(runtime, /role="status" aria-live="polite"/);
    assert.match(runtime, /setColorPreference/);
});

test('alternative themes customize shared shell and game layouts', () => {
    for (const theme of ['cabinet', 'calm']) {
        assert.match(shared, new RegExp(`data-arcade-theme="${theme}"`));
        assert.match(games, new RegExp(`data-arcade-theme="${theme}"`));
    }
    assert.match(games, /grid-template-columns:minmax\(0,2fr\)/);
    assert.match(games, /box-shadow:none/);
});

test('no modern game selects an experience theme or embeds an experience palette', () => {
    const gameScripts = [
        'pong/scripts/app.js',
        'tictactoe/scripts/app.js',
        'battle-tanks/scripts/app.js',
        'Sudoku/scripts/app.js',
        'Minesweeper/scripts/app.js',
        'tetris/scripts/app.js'
    ];

    for (const file of gameScripts) {
        const source = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(source, /dataset\.arcadeTheme/, `${file} must not select an experience theme`);
        assert.doesNotMatch(source, /\bpalettes?\s*=\s*\{/, `${file} must not embed an experience palette`);
        assert.doesNotMatch(source, /(?:playful|cabinet|calm)\s*:\s*\{/, `${file} must not branch on registered themes`);
    }
});

test('theme styles own the Battle Tanks canvas palette', () => {
    for (const token of ['sky-top', 'sky-bottom', 'terrain', 'terrain-edge', 'barrier', 'barrier-line', 'ink', 'active', 'aim']) {
        assert.match(games, new RegExp(`--battle-${token}:`));
    }
    const battleTanks = fs.readFileSync('battle-tanks/scripts/app.js', 'utf8');
    assert.match(battleTanks, /getComputedStyle\(arena\)/);
    assert.doesNotMatch(battleTanks, /const palettes=/);
});

test('theme styles own the Tetris palette and sharing refreshes from its scoped interface', () => {
    for (const token of ['board', 'grid', 'border', 'empty', 'ghost', 'ink', 'panel', 'overlay', 'magic', 'i', 'j', 'l', 'o', 's', 't', 'z']) assert.match(games, new RegExp(`--tetris-${token}:`));
    const script = fs.readFileSync('tetris/scripts/app.js', 'utf8');
    assert.match(script, /getComputedStyle\(boardElement\)/);
    assert.match(script, /system:theme-changed[^\n]*updateTetrisTheme/);
    assert.doesNotMatch(script, /dataset\.arcadeTheme|const palettes|playful\s*:|cabinet\s*:|calm\s*:/);
});

test('cabinet light mode keeps dialog text dark without changing topbar ink', () => {
    assert.match(shared, /data-arcade-theme="cabinet"\]\[data-color-mode="light"\] \.arcade-dialog \{ --arcade-nav-ink:#382c42; \}/);
    assert.doesNotMatch(shared, /data-color-mode="light"\] \{[^}]*--arcade-nav-ink:/);
});
