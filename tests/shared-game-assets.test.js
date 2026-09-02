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
    assert.match(read('battle-tanks/styles.css'), /styles\/game\.css/);
    assert.doesNotMatch(read('tictactoe/styles.css'), /pong/i);
    assert.doesNotMatch(read('tictactoe/index.html'), /(?:src|href)=["'][^"']*pong/i);
});

test('every modern game consumes the shared playful design language', () => {
    const games = ['pong', 'tictactoe', 'battle-tanks', 'Sudoku', 'Minesweeper', 'tetris'];
    const design = read('styles/modern-game.css');

    assert.match(design, /--game-pop:#ff4fa3/);
    assert.match(design, /\.modern-game \.brand-mark/);
    assert.match(design, /prefers-reduced-motion:reduce/);
    for (const game of games) {
        const html = read(`${game}/index.html`);
        assert.match(html, /styles\/modern-game\.css/, `${game} should load the modern game design`);
        assert.match(html, /<body class="modern-game game-[^"]+">/, `${game} should scope the modern design`);
    }
});

test('modern arena decoration excludes native and fallback full-screen states', () => {
    const design = read('styles/modern-game.css');

    assert.match(design, /\.arena-wrap:not\(:fullscreen\):not\(\.is-fullscreen\)/);
    assert.doesNotMatch(design, /\.modern-game \.arena-wrap,/);
});

test('modern arena share buttons remain horizontally centered on hover', () => {
    const design = read('styles/modern-game.css');

    assert.match(design, /\.arena-share\.primary-button:hover\s*\{[^}]*transform:translate\(-50%,2px\)/);
});

test('online competitive games consume shared room UI behavior', () => {
    for (const game of ['pong', 'tictactoe', 'battle-tanks']) {
        assert.match(read(`${game}/index.html`), /scripts\/online-rooms\.js/);
        assert.match(read(`${game}/scripts/app.js`), /OnlineRooms/);
    }
});

test('competitive games consume the same shared color palette', () => {
    const palette = read('scripts/game-colors.js');
    assert.match(palette, /ArcadeGameColors/);
    for (const game of ['pong', 'tictactoe', 'battle-tanks']) {
        assert.match(read(`${game}/index.html`), /scripts\/game-colors\.js/);
        assert.match(read(`${game}/scripts/app.js`), /window\.ArcadeGameColors/);
    }
});

test('Sudoku visually separates boxes and highlights the active box', () => {
    const styles = read('Sudoku/styles.css');
    const script = read('Sudoku/scripts/app.js');
    const mechanics = read('Sudoku/scripts/game.js');
    assert.match(styles, /--box-line:/);
    assert.match(styles, /\.cell:nth-child\(3n\)\s*{[^}]*3px solid var\(--box-line\)/);
    assert.match(styles, /\.cell\.same-box\s*{/);
    assert.match(script, /sameBox\([^)]*\)\) cell\.classList\.add\('same-box'\)/);
    assert.match(mechanics, /function sameBox/);
});

test('shared arcade UI uses one safe-area-aware responsive top bar and displays the build version', () => {
    const styles = read('arcade.css');
    const script = read('arcade.js');
    assert.match(styles, /\.arcade-topbar\s*{[^}]*env\(safe-area-inset-top\)/);
    assert.match(styles, /body:not\(\.arcade-has-topbar\)::before\s*{[^}]*height:env\(safe-area-inset-top\)/);
    assert.match(styles, /\.arcade-topbar-inner\s*{[^}]*justify-content:space-between/);
    assert.match(styles, /@media \(max-width: 760px\)[^{]*{[^}]*\.arcade-topbar-inner\s*{[^}]*flex-direction:column/);
    assert.match(script, /document\.body\.prepend\(topbar\)/);
    assert.match(script, /classList\.add\('arcade-has-topbar'\)/);
    assert.match(script, /api\/version/);
    assert.match(script, /arcade-build-version/);
});

test('shared arcade navigation stays out of full-screen games', () => {
    assert.match(read('arcade.css'), /body\.arena-fullscreen \.arcade-account\s*\{[^}]*display:\s*none/);
    for (const game of ['pong', 'battle-tanks']) {
        assert.match(read(`${game}/scripts/app.js`), /document\.body\.classList\.toggle\(['"]arena-fullscreen['"],\s*active\)/);
    }
});

test('top-score and achievement notifications share one sequential queue', () => {
    const script = read('arcade.js');
    assert.match(script, /notificationQueue\.push\(\.\.\.notifications\)/);
    assert.match(script, /showUnlocks = unlocked => enqueueNotifications/);
    assert.match(script, /showTopScore = topScore => \{ if \(topScore\) enqueueNotifications/);
    assert.match(script, /notifyResult = result =>/);
    assert.match(script, /record: async result =>.*notifyResult\(await api/);
    assert.match(script, /showNextNotification\(\)/);
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

test('result sharing preserves user activation when the preview is confirmed', () => {
    const share = read('scripts/share-result.js');
    assert.match(share, /function preview\([^)]*, onConfirm\)/);
    assert.match(share, /result-share-confirm[\s\S]*?addEventListener\('click', async \(\) => \{[\s\S]*?await onConfirm\(\)/);
    assert.match(share, /return preview\(\{ blob, title, text, url \}, async \(\) => \{[\s\S]*?navigator\.share\(shareData\)/);
    assert.match(share, /if \(result === 'shared'\) \{ confirmButton\.disabled = false; return; \}/);
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
        'tictactoe/index.html',
        'battle-tanks/index.html',
        'tetris/index.html'
    ];

    for (const page of pages) {
        const html = read(page);
        assert.match(html, /viewport-fit=cover/, `${page} should expose the iPhone safe area`);
        assert.match(html, /arcade\.css/, `${page} should load the shared safe-area styles`);
    }
});
