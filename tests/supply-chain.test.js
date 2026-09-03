'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('GitHub Actions dependencies use immutable commit SHAs', () => {
    const workflows = fs.readdirSync('.github/workflows').filter(file => file.endsWith('.yml')).map(file => fs.readFileSync(`.github/workflows/${file}`, 'utf8'));
    const actions = workflows.flatMap(workflow => [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)].map(match => match[1]));
    assert.ok(actions.length > 0);
    for (const action of actions) assert.match(action, /^[^@\s]+@[0-9a-f]{40}$/, action);
});

test('CI and container stages use the same immutable multi-platform Node release', () => {
    const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
    const workflow = fs.readFileSync('.github/workflows/container.yml', 'utf8');
    const images = [...dockerfile.matchAll(/^FROM\s+(node:[^\s]+)(?:\s+AS\s+\S+)?$/gmi)].map(match => match[1]);
    assert.equal(images.length, 2);
    for (const image of images) assert.match(image, /^node:26-alpine@sha256:[0-9a-f]{64}$/, image);
    assert.equal(new Set(images).size, 1);
    const ciNodeMajor = workflow.match(/^\s*node-version:\s*(\d+)\s*$/m);
    const containerNodeMajor = images[0].match(/^node:(\d+)-alpine@/);
    assert.ok(ciNodeMajor);
    assert.ok(containerNodeMajor);
    assert.equal(ciNodeMajor[1], containerNodeMajor[1]);
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
    assert.match(workflow, /arcade-trivy:ci image[\s\S]*?--severity HIGH,CRITICAL[\s\S]*?js-playground:ci/);
    assert.match(workflow, /^\s*if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/master'$/m);
    assert.match(workflow, /images: \$\{\{ secrets\.DOCKERHUB_USERNAME \}\}\/js-playground/);
    assert.match(workflow, /type=raw,value=alpha/);
    assert.doesNotMatch(workflow, /type=raw,value=latest/);
});

test('stable releases are manual, branch guarded, versioned, and scanned before publishing', () => {
    const workflow = fs.readFileSync('.github/workflows/release.yml', 'utf8');
    assert.match(workflow, /^\s*workflow_dispatch:\s*$/m);
    assert.match(workflow, /refs\/heads\/release[\s\S]*refs\/tags\/v\$\{RELEASE_VERSION\}/);
    assert.match(workflow, /release-notes\.js validate/);
    assert.match(workflow, /js-playground:release-candidate[\s\S]*Scan stable container[\s\S]*type=raw,value=latest,enable=\$\{\{ github\.ref == 'refs\/heads\/release' \}\}/);
    assert.match(workflow, /type=semver,pattern=\{\{version\}\}/);
    assert.match(workflow, /type=semver,pattern=\{\{major\}\}\.\{\{minor\}\},value=\$\{\{ inputs\.version \}\},enable=\$\{\{ github\.ref == 'refs\/heads\/release' \}\}/);
    assert.match(workflow, /gh release create/);
    assert.match(workflow, /latest_flag=--latest=false[\s\S]*GITHUB_REF[\s\S]*latest_flag=--latest[\s\S]*gh release create[^\n]+--verify-tag[^\n]+"\$latest_flag"/);
    assert.match(workflow, /images: \$\{\{ secrets\.DOCKERHUB_USERNAME \}\}\/js-playground/);
    assert.match(workflow, /^\s*contents: write$/m);
    assert.ok(workflow.indexOf('git push origin') < workflow.indexOf('Build and push multi-platform stable image'), 'the immutable tag must exist before public image tags move');
});

test('Compose services and containers use configurable playground names', () => {
    for (const file of ['compose.yaml', 'compose.nas.yaml']) {
        const compose = fs.readFileSync(file, 'utf8');
        assert.match(compose, /^\s{2}js-playground:$/m, file);
        assert.match(compose, /^\s*container_name: \$\{JSPG_CONTAINER_NAME:-javascript-playground\}$/m, file);
        assert.match(compose, /\$\{JSPG_PORT:-8080\}/, file);
    }
    assert.match(fs.readFileSync('compose.nas.yaml', 'utf8'), /\$\{JSPG_IMAGE:\?Set JSPG_IMAGE/);
});

test('release operations are documented with the promotion and deployment model', () => {
    const readme = fs.readFileSync('README.md', 'utf8');
    const guide = fs.readFileSync('docs/release-process.md', 'utf8');
    const decision = fs.readFileSync('docs/adr/0026-controlled-release-trains.md', 'utf8');
    assert.match(readme, /\[release process\]\(docs\/release-process\.md\)/);
    assert.match(guide, /```mermaid[\s\S]*master[\s\S]*promotion pull request[\s\S]*release/);
    assert.match(guide, /master.*head branch[\s\S]*release[\s\S]*base branch/);
    assert.match(guide, /JSPG_IMAGE=.*js-playground:latest[\s\S]*JSPG_IMAGE=.*js-playground:alpha/);
    assert.match(guide, /Never point[\s\S]*alpha[\s\S]*stable's SQLite database/);
    assert.match(decision, /retry dispatched from an existing version tag[\s\S]*immutable full-version and SHA/);
});

test('release branch ruleset requires pull-requested, tested, non-destructive promotions', () => {
    const ruleset = JSON.parse(fs.readFileSync('.github/rulesets/release.json', 'utf8'));
    assert.equal(ruleset.target, 'branch');
    assert.equal(ruleset.enforcement, 'active');
    assert.deepEqual(ruleset.bypass_actors, []);
    assert.deepEqual(ruleset.conditions.ref_name, { include: ['refs/heads/release'], exclude: [] });
    const rules = Object.fromEntries(ruleset.rules.map(rule => [rule.type, rule.parameters || null]));
    assert.ok('deletion' in rules);
    assert.ok('non_fast_forward' in rules);
    assert.deepEqual(rules.pull_request.allowed_merge_methods, ['merge']);
    assert.equal(rules.pull_request.required_approving_review_count, 0);
    assert.equal(rules.pull_request.required_review_thread_resolution, true);
    assert.deepEqual(rules.required_status_checks.required_status_checks, [{ context: 'test' }, { context: 'build' }]);
    assert.equal(rules.required_status_checks.strict_required_status_checks_policy, false);
});

test('Dependabot checks every build dependency ecosystem daily', () => {
    const configuration = fs.readFileSync('.github/dependabot.yml', 'utf8');
    const ecosystems = [...configuration.matchAll(/^\s*- package-ecosystem:\s*(\S+)$/gm)].map(match => match[1]);
    assert.deepEqual(ecosystems, ['github-actions', 'docker', 'npm']);
    assert.equal([...configuration.matchAll(/^\s*interval:\s*daily$/gm)].length, ecosystems.length);
    assert.equal([...configuration.matchAll(/^\s*applies-to:\s*security-updates$/gm)].length, ecosystems.length);
    assert.match(configuration, /^\s*- "\/security"$/m);
});
