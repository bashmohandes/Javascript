'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const profile = fs.readFileSync('profile.html', 'utf8');
const styles = fs.readFileSync('profile.css', 'utf8');

test('profile defines light and dark theme palettes', () => {
    assert.match(profile, /href="profile\.css"/);
    assert.match(styles, /:root\s*\{[^}]*color-scheme:\s*light;[^}]*--page:\s*#f7f3eb/s);
    assert.match(styles, /:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark;[^}]*--page:\s*#0d1420/s);
    assert.match(styles, /background:[\s\S]*var\(--page\);/);
});

test('profile uses the playful arcade shell and card language', () => {
    assert.match(profile, /src="arcade\.js"/);
    assert.doesNotMatch(profile, /class="profile-nav"/);
    assert.match(profile, /class="hero-spark"/);
    assert.match(styles, /\.panel\s*\{[^}]*border:\s*3px solid var\(--ink\);[^}]*box-shadow:/s);
    assert.match(styles, /\.panel::before/);
});

test('profile controls do not restyle the shared top bar', () => {
    assert.match(styles, /\.shell :where\(input, select, button\)/);
    assert.match(styles, /\.shell button\s*\{/);
    assert.doesNotMatch(styles, /(?:^|\n)button\s*\{/);
});

test('profile includes accessible game-history pagination', () => {
    assert.match(profile, /id="history-pagination" aria-label="Game history pages"/);
    assert.match(profile, /data-page-action="previous"/);
    assert.match(profile, /data-page-action="next"/);
});

test('leaderboard game filters fit narrow mobile screens', () => {
    assert.match(styles, /\.tabs\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
    assert.match(styles, /\.tabs button\s*\{\s*min-width:\s*0;[^}]*font-size:\s*13px/s);
});
