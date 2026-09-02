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
    for (const image of images) assert.match(image, /^node:26-alpine@sha256:[0-9a-f]{64}$/, image);
    assert.equal(new Set(images).size, 1);
    assert.match(dockerfile, /apk add --no-cache --upgrade libcrypto3=\d+\.\d+\.\d+-r\d+ libssl3=\d+\.\d+\.\d+-r\d+/);
    assert.match(dockerfile, /rm -rf \/usr\/local\/lib\/node_modules\/npm \/usr\/local\/lib\/node_modules\/corepack \/opt\/yarn-v\*/);
});

test('container scanning uses an immutable Trivy image and cannot publish on schedule', () => {
    const scanner = fs.readFileSync('security/Dockerfile', 'utf8');
    assert.match(scanner, /^FROM aquasec\/trivy:\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/m);
    const workflow = fs.readFileSync('.github/workflows/container.yml', 'utf8');
    assert.match(workflow, /^\s*schedule:\s*$[\s\S]*?^\s*- cron:/m);
    assert.match(workflow, /^\s*group: container-\$\{\{ github\.event_name \}\}-\$\{\{ github\.ref \}\}$/m);
    assert.match(workflow, /^\s*load:\s*true$/m);
    assert.match(workflow, /arcade-trivy:ci image[\s\S]*?--severity HIGH,CRITICAL[\s\S]*?javascript-pong:ci/);
    assert.match(workflow, /^\s*if: github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'$/m);
});

test('Dependabot checks every build dependency ecosystem daily', () => {
    const configuration = fs.readFileSync('.github/dependabot.yml', 'utf8');
    const ecosystems = [...configuration.matchAll(/^\s*- package-ecosystem:\s*(\S+)$/gm)].map(match => match[1]);
    assert.deepEqual(ecosystems, ['github-actions', 'docker', 'npm']);
    assert.equal([...configuration.matchAll(/^\s*interval:\s*daily$/gm)].length, ecosystems.length);
    assert.equal([...configuration.matchAll(/^\s*applies-to:\s*security-updates$/gm)].length, ecosystems.length);
    assert.match(configuration, /^\s*- "\/security"$/m);
});
