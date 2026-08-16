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
