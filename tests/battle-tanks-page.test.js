'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('homepage links to Battle Tanks and its page loads all shared arcade assets', () => {
    assert.match(read('index.html'), /href=["']battle-tanks\/index\.html["']/);
    const page = read('battle-tanks/index.html');
    for (const asset of ['../arcade.js', '../theme-init.js', '../scripts/game-colors.js', '../scripts/share-result.js']) {
        assert.ok(page.includes(asset), `Battle Tanks should load ${asset}`);
    }
    assert.match(page, /scripts\/game\.js[\s\S]*scripts\/app\.js/, 'mechanics must load before the browser application');
});

test('Battle Tanks resets its impact callout guard for local and synchronized rematches', () => {
    const app = read('battle-tanks/scripts/app.js');
    assert.match(app, /\(state\.impactSerial\|\|0\)<lastImpactSerial\)lastImpactSerial=0/, 'a lower synchronized serial should identify a new match');
    assert.match(app, /resetMatch\(state\);lastImpactSerial=0/, 'local resets should immediately clear the impact guard');
});

test('full-screen games expose an on-screen exit and Battle Tanks turn controls', () => {
    const tanksPage = read('battle-tanks/index.html');
    const pongPage = read('pong/index.html');
    assert.match(tanksPage, /class="fullscreen-controls"[\s\S]*id="fullscreen-fire"/);
    assert.match(tanksPage, /class="fullscreen-exit"/);
    assert.match(pongPage, /class="fullscreen-exit"/);
    assert.match(read('styles/game.css'), /:fullscreen \.fullscreen-exit/);
});

test('Battle Tanks supports arrow, power, and space keyboard controls', () => {
    const app = read('battle-tanks/scripts/app.js');
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Minus', 'Equal', 'NumpadSubtract', 'NumpadAdd', 'Space']) {
        assert.ok(app.includes(key), `Battle Tanks should handle ${key}`);
    }
});

test('Battle Tanks reverses screen-direction movement for the right-facing tank', () => {
    const page = read('battle-tanks/index.html');
    const app = read('battle-tanks/scripts/app.js');
    assert.match(page, /data-move-direction="left"[\s\S]*data-move-direction="right"/);
    assert.match(app, /direction==='left'\?\(state\.activePlayer\?'forward':'backward'\):\(state\.activePlayer\?'backward':'forward'\)/);
});

test('Battle Tanks collects pickups along local pointer-drag movement', () => {
    const app = read('battle-tanks/scripts/app.js');
    assert.match(app, /pointermove[\s\S]*?tank\.y=tankYAt\(state,tank\);collectPickup\(state,state\.activePlayer\);sync\(\)/);
});

test('Battle Tanks exposes an accessible, queued, local-only acquisition card', () => {
    const page = read('battle-tanks/index.html'), app = read('battle-tanks/scripts/app.js'), styles = read('battle-tanks/styles.css');
    assert.match(page, /id="power-card"[^>]*role="dialog"/); assert.match(page, /id="dismiss-power-card"[^>]*aria-label="Dismiss power-up card"/); assert.match(page, /id="power-card-live"[^>]*aria-live="polite"/);
    assert.match(app, /powerCardQueue/); assert.match(app, /highestPresentedEventId/); assert.match(app, /presentationMatchId/); assert.match(app, /room=mode==='online'\?\(onlineSession\?\.roomCode\|\|'pending'\):'local'/); assert.match(app, /sessionStorage\.setItem\(`battle-tanks-presented-/); assert.match(app, /powerCard\.style\.animation='none';void powerCard\.offsetWidth;powerCard\.style\.removeProperty\('animation'\)/); assert.match(app, /function dismissPowerCard/); assert.doesNotMatch(app, /sendOnline\([^)]*dismiss/i);
    assert.match(styles, /prefers-reduced-motion:reduce[\s\S]*power-card/); assert.match(styles, /:fullscreen \.power-card-layer/); assert.match(styles, /@keyframes power-card-play/);
});
