'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const homepage = fs.readFileSync('index.html', 'utf8');
const styles = fs.readFileSync('styles/home.css', 'utf8');

test('homepage defines Field Manual and restored Playful palettes in both color modes', () => {
    assert.match(homepage, /href="styles\/home\.css"/);
    assert.match(styles, /:root\s*{[^}]*color-scheme:light;[^}]*--directory-paper:#ebe5d8;/s);
    assert.match(styles, /:root\[data-color-mode="dark"\]\s*{[^}]*color-scheme:dark;[^}]*--directory-paper:#121411;/s);
    assert.match(styles, /data-arcade-theme="playful"\][^{]*{[^}]*--directory-paper:#f7f3eb;/s);
    assert.match(styles, /data-arcade-theme="playful"\]\[data-color-mode="dark"\][^{]*{[^}]*--directory-paper:#0d1420;/s);
});

test('homepage is a working program directory rather than a hero and card grid', () => {
    assert.match(homepage, /class="program-directory"/);
    assert.equal((homepage.match(/<article class="program">/g) || []).length, 6);
    assert.match(homepage, /Program directory \/ 6 playable builds/);
    assert.match(styles, /\.directory-columns,\.program\{display:grid;grid-template-columns:/);
    assert.doesNotMatch(homepage, /class="(?:hero|game-grid|card)"/);
});

test('homepage relies on the shared utility rail for global navigation', () => {
    assert.match(homepage, /src="arcade\.js"/);
    assert.doesNotMatch(homepage, /class="(?:brand|profile-nav)"/);
});

test('homepage labels every program with accessible player-mode capabilities', () => {
    assert.equal((homepage.match(/aria-label="Game modes"/g) || []).length, 6);
    assert.equal((homepage.match(/>Single player<\/li>/g) || []).length, 5);
    assert.equal((homepage.match(/>Local multiplayer<\/li>/g) || []).length, 2);
    assert.equal((homepage.match(/>Local two-player<\/li>/g) || []).length, 1);
    assert.equal((homepage.match(/>Online multiplayer<\/li>/g) || []).length, 3);
    assert.match(styles, /\.program-modes li::before[^}]*background:var\(--directory-signal\)/s);
});

test('homepage keeps modern and original editions visibly distinct', () => {
    assert.equal((homepage.match(/>Run modern /g) || []).length, 3);
    assert.equal((homepage.match(/>Open original<\/a>/g) || []).length, 3);
    assert.equal((homepage.match(/>Run game /g) || []).length, 3);
});
