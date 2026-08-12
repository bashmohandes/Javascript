'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('competitive games consume shared styles without cross-game imports', () => {
    assert.match(read('pong/styles.css'), /styles\/game\.css/);
    assert.match(read('tictactoe/styles.css'), /styles\/game\.css/);
    assert.doesNotMatch(read('tictactoe/styles.css'), /pong/i);
    assert.doesNotMatch(read('tictactoe/index.html'), /(?:src|href)=["'][^"']*pong/i);
});

test('competitive games consume the same shared color palette', () => {
    const palette = read('scripts/game-colors.js');
    assert.match(palette, /ArcadeGameColors/);
    for (const game of ['pong', 'tictactoe']) {
        assert.match(read(`${game}/index.html`), /scripts\/game-colors\.js/);
        assert.match(read(`${game}/scripts/app.js`), /window\.ArcadeGameColors/);
    }
});

test('shared arcade UI keeps mobile navigation above the safe area and displays the build version', () => {
    const styles = read('arcade.css');
    const script = read('arcade.js');
    assert.match(styles, /bottom:\s*max\(10px, env\(safe-area-inset-bottom\)\)/);
    assert.match(script, /api\/version/);
    assert.match(script, /arcade-build-version/);
});
