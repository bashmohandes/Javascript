'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Pong scales its canvas backing store to its rendered size', () => {
    const app = read('pong/scripts/app.js');
    assert.match(app, /canvas\.getBoundingClientRect\(\)/);
    assert.match(app, /displayScale = Math\.max\(rect\.width \/ game\.width, rect\.height \/ game\.height\)/);
    assert.match(app, /window\.devicePixelRatio/);
    assert.match(app, /ctx\.setTransform\(ratio/);
    assert.match(app, /requestAnimationFrame\(resize\)/);
});

test('Pong renders a layered theme-owned court without changing mechanics', () => {
    const app = read('pong/scripts/app.js'), design = read('styles/modern-game.css');
    for (const helper of ['drawCourt', 'drawPaddle', 'drawBall']) assert.match(app, new RegExp(`function ${helper}\\(`));
    assert.match(app, /createLinearGradient\(0, 0, game\.width, game\.height\)/);
    assert.match(app, /styles\.getPropertyValue\('--pong-field-deep'\)/);
    assert.match(app, /styles\.getPropertyValue\('--pong-glow'\)/);
    assert.match(design, /--pong-field-deep:/);
    assert.match(design, /--pong-glow:/);
});

test('Pong keeps full screen focused on the court, score, and exit', () => {
    const page = read('pong/index.html'), app = read('pong/scripts/app.js'), styles = read('pong/styles.css');
    assert.doesNotMatch(page, /pong-fullscreen-deck|fullscreen-paddle-controls|fullscreen-pause/);
    assert.doesNotMatch(app, /fullscreenScore|fullscreenPause/);
    assert.match(page, /class="arena-score"[^>]*aria-hidden="true"[\s\S]*id="arena-score-left"[\s\S]*id="arena-score-right"/);
    assert.match(styles, /arena-wrap:fullscreen \.arena-score[^}]*display:block/);
    assert.match(styles, /arena-score span[^}]*top:clamp\(56px,12%,110px\)[^}]*opacity:\.14/);
    assert.match(styles, /arena-wrap:fullscreen \.fullscreen-exit[^}]*z-index:10/);
});
