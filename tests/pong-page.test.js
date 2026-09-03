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

test('Pong fills landscape full screen with a touch-sized command deck', () => {
    const page = read('pong/index.html'), app = read('pong/scripts/app.js'), styles = read('pong/styles.css');
    assert.match(page, /class="pong-fullscreen-deck"[\s\S]*id="fullscreen-score-left"[\s\S]*id="fullscreen-pause"/);
    assert.match(app, /fullscreenScoreRight : fullscreenScoreLeft/);
    assert.match(app, /fullscreenPauseButton\.addEventListener\('click', togglePause\)/);
    assert.match(styles, /grid-template-columns:minmax\(0,1fr\) var\(--pong-command-deck\)/);
    assert.match(styles, /pong-fullscreen-deck[^}]*grid-column:2[^}]*grid-row:1/);
    assert.match(styles, /max-height:500px[\s\S]*min-height:44px/);
});
