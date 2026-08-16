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

test('light theme brand mark uses a high-contrast gradient behind its white label', () => {
    const relativeLuminance = hex => {
        const channels = hex.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16) / 255);
        const linear = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };
    const contrastWithWhite = hex => 1.05 / (relativeLuminance(hex) + 0.05);
    const stops = [...homepage.matchAll(/--brand-(?:start|end):\s*(#[\da-f]{6})/gi)].map(match => match[1]);

    assert.deepEqual(stops, ['#a50050', '#4c25c7']);
    assert.ok(stops.every(stop => contrastWithWhite(stop) >= 4.5));
    assert.match(homepage, /linear-gradient\(135deg, var\(--brand-start\), var\(--brand-end\)\)/);
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
