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
    assert.match(styles, /body::before\s*{[^}]*height:env\(safe-area-inset-top\)/);
    assert.match(styles, /top:\s*calc\(14px \+ env\(safe-area-inset-top\)\)/);
    assert.match(styles, /bottom:\s*max\(10px, env\(safe-area-inset-bottom\)\)/);
    assert.match(script, /api\/version/);
    assert.match(script, /arcade-build-version/);
});

test('achievement notifications are queued and displayed one at a time', () => {
    const script = read('arcade.js');
    assert.match(script, /unlockQueue\.push\(\.\.\.unlocked\)/);
    assert.match(script, /setTimeout\(\(\) => \{ toast\.remove\(\); showNextUnlock\(\); \}, 5200\)/);
    assert.doesNotMatch(script, /index \* 450/);
});

test('achievement shares include a generated image on game and profile pages', () => {
    const share = read('scripts/share-result.js');
    assert.match(share, /function achievement\(/);
    assert.match(share, /window\.ResultShare = \{[^}]*achievement, share/);
    assert.match(read('arcade.js'), /ResultShare\?\.achievement\(achievement\)/);
    assert.match(read('profile.js'), /ResultShare\?\.achievement\(item\)/);
    assert.match(read('profile.html'), /scripts\/share-result\.js/);
});

test('every arcade page opts into shared iPhone safe-area handling', () => {
    const pages = [
        'index.html',
        'profile.html',
        'pong/index.html',
        'pong/classic/index.html',
        'Sudoku/index.html',
        'Sudoku/classic/index.html',
        'Minesweeper/index.html',
        'Minesweeper/classic/index.html',
        'tictactoe/index.html'
    ];

    for (const page of pages) {
        const html = read(page);
        assert.match(html, /viewport-fit=cover/, `${page} should expose the iPhone safe area`);
        assert.match(html, /arcade\.css/, `${page} should load the shared safe-area styles`);
    }
});
