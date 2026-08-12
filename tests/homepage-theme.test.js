'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const homepage = fs.readFileSync('index.html', 'utf8');

test('homepage defines distinct light and dark palettes', () => {
    assert.match(homepage, /:root\s*{[^}]*color-scheme:\s*light;/s);
    assert.match(homepage, /:root\[data-theme="dark"\]\s*{[^}]*color-scheme:\s*dark;/s);
    assert.match(homepage, /--page-background:\s*#f7f3eb;/);
    assert.match(homepage, /--page-background:\s*#0d1420;/);
});

test('homepage surfaces use theme palette variables', () => {
    assert.match(homepage, /background:[^;}]*var\(--page-background\);/s);
    assert.match(homepage, /background:\s*var\(--panel\);/);
    assert.match(homepage, /box-shadow:\s*0 24px 70px var\(--card-shadow\);/);
});

test('homepage gives every game card the same grid footprint', () => {
    assert.match(homepage, /\.game-grid\s*{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);[^}]*grid-auto-rows:\s*1fr;/s);
    assert.doesNotMatch(homepage, /card-featured/);
});

test('homepage labels each game with accessible player-mode capabilities', () => {
    assert.equal((homepage.match(/aria-label="Game modes"/g) || []).length, 5);
    assert.equal((homepage.match(/>Single player<\/li>/g) || []).length, 4);
    assert.equal((homepage.match(/>Local multiplayer<\/li>/g) || []).length, 2);
    assert.equal((homepage.match(/>Local two-player<\/li>/g) || []).length, 1);
    assert.equal((homepage.match(/>Online multiplayer<\/li>/g) || []).length, 3);
    assert.match(homepage, /\.capability svg\s*{[^}]*color:\s*var\(--accent\);/s);
});
