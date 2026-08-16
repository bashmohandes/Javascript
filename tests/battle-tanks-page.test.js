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

test('Battle Tanks game-over actions do not cover tanks or unsafe iPhone controls', () => {
    const app = read('battle-tanks/scripts/app.js'), styles = read('battle-tanks/styles.css');
    assert.match(app, /arena\.dataset\.phase=state\.phase/);
    assert.match(styles, /data-phase="game-over"[^}]*fullscreen-controls[^}]*display:none/);
    assert.match(styles, /\.arena-wrap \.arena-share\{top:[^}]*bottom:auto/);
    assert.match(styles, /fullscreen \.fullscreen-exit[^}]*z-index:10[^}]*border:2px solid #fff/);
    assert.match(styles, /top:max\(12px,env\(safe-area-inset-top\)\)[^}]*right:max\(12px,env\(safe-area-inset-right\)\)/);
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

test('Battle Tanks disables online-only power-ups in local matches and guards activation', () => {
    const app = read('battle-tanks/scripts/app.js'), core = require('../battle-tanks/scripts/game');
    assert.equal(core.POWER_UP_CATALOG.invisibility.onlineOnly, true);
    assert.match(app, /button\.disabled=locked\|\|unavailable/);
    assert.match(app, /if\(!item\|\|item\.onlineOnly&&mode!==['"]online['"]\)return/);
});

test('Battle Tanks exposes an accessible, queued, local-only acquisition card', () => {
    const page = read('battle-tanks/index.html'), app = read('battle-tanks/scripts/app.js'), styles = read('battle-tanks/styles.css');
    assert.match(page, /id="power-card"[^>]*role="dialog"/); assert.match(page, /id="dismiss-power-card"[^>]*aria-label="Dismiss power-up card"/); assert.match(page, /id="power-card-live"[^>]*aria-live="polite"/);
    assert.match(app, /powerCardQueue/); assert.match(app, /highestPresentedEventId/); assert.match(app, /presentationMatchId/); assert.match(app, /room=mode==='online'\?\(onlineSession\?\.roomCode\|\|'pending'\):'local'/); assert.match(app, /sessionStorage\.setItem\(`battle-tanks-presented-/); assert.match(app, /powerCard\.style\.animation='none';void powerCard\.offsetWidth;powerCard\.style\.removeProperty\('animation'\)/); assert.match(app, /function dismissPowerCard/); assert.doesNotMatch(app, /sendOnline\([^)]*dismiss/i);
    assert.match(styles, /prefers-reduced-motion:reduce[\s\S]*power-card/); assert.match(styles, /:fullscreen \.power-card-layer/); assert.match(styles, /@keyframes power-card-play/);
});

test('Battle Tanks snapshots are versioned and unsupported synchronized state leaves safely', () => {
    const game = require('../battle-tanks/scripts/game');
    assert.equal(game.snapshot(game.createInitialState(7)).stateVersion, game.STATE_VERSION);
    const app = read('battle-tanks/scripts/app.js');
    assert.match(app, /function isSupportedState/);
    assert.match(app, /incoming\.stateVersion===STATE_VERSION/);
    assert.match(app, /unsupported game state version[\s\S]*leaveRoom\(false\)/i);
});

test('Battle Tanks rendering helpers tolerate redacted opponents and optional projectile details', () => {
    const app = read('battle-tanks/scripts/app.js');
    for (const helper of ['renderArena', 'renderTanks', 'renderProjectiles', 'renderPickups', 'renderEffects', 'syncArenaHud', 'syncTankHud', 'syncEffectsHud']) assert.ok(app.includes(`function ${helper}`), `${helper} should remain independently guarded`);
    assert.match(app, /tank=state\.tanks\?\.\[active\]\|\|\{\}/);
    assert.match(app, /sample\.concealed/);
    assert.match(app, /Number\.isFinite\(sample\.vx\)/);
    assert.match(app, /WEAPON_REGISTRY\[projectile\.weaponId\]\?projectile\.weaponId:'shell'/);
});

test('Battle Tanks instructions and accessible controls cover expanded combat', () => {
    const page = read('battle-tanks/index.html');
    for (const phrase of ['splash damage', 'carve craters', 'Drive over', 'Weapon selector', 'shields absorb', 'online rooms only']) assert.ok(page.includes(phrase), `instructions should mention ${phrase}`);
    for (const name of ['Move left', 'Move right', 'Lower firing angle', 'Raise firing angle', 'Decrease launch power', 'Increase launch power', 'Select weapon in full screen', 'Exit full screen']) assert.ok(page.includes(`aria-label="${name}"`), `${name} needs an accessible name`);
    assert.match(page, /id="pickup-announcement"[^>]*aria-live="polite"/);
});

test('Battle Tanks keeps reset, rematch, reconnect, results, callouts, and themes wired', () => {
    const app = read('battle-tanks/scripts/app.js');
    assert.match(app, /resetMatch\(state\);lastImpactSerial=0/);
    assert.match(app, /sendOnline\(\{type:'rematch'\}\)/);
    assert.match(app, /type:'resume',\.\.\.onlineSession/);
    assert.match(app, /Arcade\.record\(\{game:'battletanks'/);
    assert.match(app, /callout\.classList\.add\('show'\)/);
    assert.match(app, /arcade:theme[\s\S]*updateArenaTheme/);
    assert.match(app, /fullscreen-fire[\s\S]*fullscreen-weapon|fullscreen-weapon[\s\S]*fullscreen-fire/);
});

test('Battle Tanks documentation links, controls, protocol ids, and achievement ids stay synchronized', () => {
    const adrIndex = read('docs/adr/README.md');
    const docs = ['docs/README.md', 'docs/architecture.md', 'docs/online-rendering.md', 'docs/battle-tanks.md', 'README.md'];
    assert.match(adrIndex, /0009-authoritative-battle-tanks-simulation\.md/);
    assert.match(read('battle-tanks/index.html'), /href="\.\.\/docs\/battle-tanks\.md"/);

    for (const file of docs.concat('docs/adr/README.md')) {
        const content = read(file), directory = path.dirname(path.join(root, file));
        for (const match of content.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g)) {
            if (/^(?:https?:|#)/.test(match[1])) continue;
            assert.ok(fs.existsSync(path.resolve(directory, match[1])), `${file} has missing link ${match[1]}`);
        }
    }

    const rules = read('docs/battle-tanks.md'), core = require('../battle-tanks/scripts/game');
    for (const key of ['A', 'D', 'W', 'S', 'Q', 'E', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Minus', 'Equal']) {
        const documented = key.startsWith('Arrow') ? { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }[key] : key === 'Minus' ? '−' : key === 'Equal' ? '+' : key;
        assert.ok(rules.includes(documented), `rules should document ${key}`);
        assert.ok(read('battle-tanks/scripts/app.js').includes(key), `app should implement ${key}`);
    }
    for (const id of Object.keys(core.WEAPON_REGISTRY)) assert.match(rules, new RegExp(`\\b${id}\\b`));
    for (const id of Object.keys(core.POWER_UP_CATALOG)) assert.ok(rules.includes(`\`${id}\``), `rules should document power-up ${id}`);
    const achievementIds = require('../server/achievements').catalog.filter(item => item.game === 'battletanks').map(item => item.id);
    for (const id of achievementIds) assert.ok(rules.includes(`\`${id}\``), `rules should document achievement ${id}`);
});
