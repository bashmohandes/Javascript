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
