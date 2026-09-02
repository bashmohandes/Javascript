'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('GitHub Actions dependencies use immutable commit SHAs', () => {
    const workflow = fs.readFileSync('.github/workflows/container.yml', 'utf8');
    const actions = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)].map(match => match[1]);
    assert.ok(actions.length > 0);
    for (const action of actions) assert.match(action, /^[^@\s]+@[0-9a-f]{40}$/, action);
});

test('container stages use one immutable multi-platform Node image digest', () => {
    const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
    const images = [...dockerfile.matchAll(/^FROM\s+(node:[^\s]+)(?:\s+AS\s+\S+)?$/gmi)].map(match => match[1]);
    assert.equal(images.length, 2);
    for (const image of images) assert.match(image, /^node:24-alpine@sha256:[0-9a-f]{64}$/, image);
    assert.equal(new Set(images).size, 1);
});
