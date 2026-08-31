'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const profile = fs.readFileSync('profile.html', 'utf8');
const styles = fs.readFileSync('profile.css', 'utf8');

test('profile defines light and dark theme palettes', () => {
    assert.match(profile, /href="profile\.css"/);
    assert.match(styles, /:root\s*\{[^}]*color-scheme:\s*light;[^}]*--page:\s*#ebe5d8/s);
    assert.match(styles, /:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark;[^}]*--page:\s*#121411/s);
    assert.match(styles, /background-color:\s*var\(--page\);/);
});

test('profile uses the shared Field Manual shell and ledger panel language', () => {
    assert.match(profile, /src="arcade\.js"/);
    assert.doesNotMatch(profile, /class="profile-nav"/);
    assert.doesNotMatch(profile, /class="hero-spark"/);
    assert.match(profile, /Player record · live ledger/);
    assert.match(styles, /\.panel\s*\{[^}]*border:2px solid var\(--ink\);[^}]*border-radius:0;[^}]*box-shadow:none;/s);
    assert.match(styles, /\.panel::before/);
    assert.match(profile, /<body class="profile-page">/);
    assert.match(styles, /\.profile-page \.shell\{display:grid;[^}]*grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/s);
});

test('profile controls do not restyle the shared top bar', () => {
    assert.match(styles, /\.shell :where\(input, select, button\)/);
    assert.match(styles, /\.shell button\s*\{/);
    assert.doesNotMatch(styles, /(?:^|\n)button\s*\{/);
});

test('profile management fields fit the compact Cabinet column', () => {
    assert.match(styles, /\.shell form\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) auto;/s);
    assert.match(styles, /\.shell form input\s*\{[^}]*min-width:\s*0;/s);
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
