'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const profile = fs.readFileSync('profile.html', 'utf8');

test('profile defines light and dark theme palettes', () => {
    assert.match(profile, /:root\{color-scheme:light;[^}]*--page:#f7f3eb/);
    assert.match(profile, /:root\[data-theme="dark"\]\{color-scheme:dark;[^}]*--page:#0d1420/);
    assert.match(profile, /background:[^;}]*var\(--page\)/);
});

test('profile includes accessible game-history pagination', () => {
    assert.match(profile, /id="history-pagination" aria-label="Game history pages"/);
    assert.match(profile, /data-page-action="previous"/);
    assert.match(profile, /data-page-action="next"/);
});
