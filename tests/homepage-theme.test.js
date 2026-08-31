'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const homepage = fs.readFileSync('index.html', 'utf8');

test('homepage defines distinct light and dark palettes', () => {
    assert.match(homepage, /:root\s*{[^}]*color-scheme:\s*light;/s);
    assert.match(homepage, /:root\[data-theme="dark"\]\s*{[^}]*color-scheme:\s*dark;/s);
    assert.match(homepage, /--page-background:\s*#ebe5d8;/);
    assert.match(homepage, /--page-background:\s*#121411;/);
});

test('homepage surfaces use theme palette variables', () => {
    assert.match(homepage, /background:[^;}]*var\(--page-background\);/s);
    assert.match(homepage, /background:\s*var\(--panel\);/);
    assert.match(homepage, /data-arcade-theme="playful"\] \.card\s*{[^}]*border-radius:0;[^}]*box-shadow:none;/s);
});

test('homepage relies on the shared top bar for its brand', () => {
    assert.doesNotMatch(homepage, /<header>/);
    assert.doesNotMatch(homepage, /class="brand(?:-mark)?"/);
    assert.match(homepage, /src="arcade\.js"/);
});

test('homepage gives every game card the same grid footprint', () => {
    assert.match(homepage, /\.game-grid\s*{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*grid-auto-rows:\s*1fr;/s);
    assert.doesNotMatch(homepage, /card-featured/);
});

test('default homepage uses the indexed Field Manual language instead of the former soft-card treatment', () => {
    assert.match(homepage, /JS\/A · Field index 01—06/);
    assert.match(homepage, /counter-reset:game-index/);
    assert.match(homepage, /background-size:\s*40px 40px/);
    assert.doesNotMatch(homepage, /class="hero-spark/);
});

test('homepage labels each game with accessible player-mode capabilities', () => {
    assert.equal((homepage.match(/aria-label="Game modes"/g) || []).length, 6);
    assert.equal((homepage.match(/>Single player<\/li>/g) || []).length, 5);
    assert.equal((homepage.match(/>Local multiplayer<\/li>/g) || []).length, 2);
    assert.equal((homepage.match(/>Local two-player<\/li>/g) || []).length, 1);
    assert.equal((homepage.match(/>Online multiplayer<\/li>/g) || []).length, 3);
    assert.match(homepage, /\.capability svg\s*{[^}]*color:\s*var\(--accent\);/s);
});
