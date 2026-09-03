'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createBuildInformation } = require('../server/build-info');
const { compareVersions, loadManifest, publicRelease, releaseForVersion, renderMarkdown, validateManifest, validateReleaseVersion } = require('../scripts/release-notes');

const manifest = loadManifest();

test('release manifest is ordered, unique, and matches the package version', () => {
    const release = validateReleaseVersion(manifest, require('../package.json').version);
    assert.equal(release, manifest.releases[0]);
    assert.ok(compareVersions('1.2.0', '1.1.9') > 0);
    assert.throws(() => validateManifest({ schemaVersion: 1, releases: [release, release] }), /duplicated/);
    assert.throws(() => validateManifest({ schemaVersion: 1, releases: [{ ...release, version: 'next' }] }), /SemVer/);
    assert.throws(() => validateManifest({ schemaVersion: 1, releases: [{ ...release, highlights: [] }] }), /highlights/);
});

test('release notes render tailored public and GitHub views', () => {
    const release = releaseForVersion(manifest, '1.0.0');
    const browser = publicRelease(release), markdown = renderMarkdown(release);
    assert.deepEqual(Object.keys(browser), ['version', 'title', 'summary', 'highlights', 'fixes']);
    assert.equal(browser.technical, undefined);
    assert.match(release.title, /^JavaScript Arcade 1\.0/);
    assert.match(markdown, /^## Technical notes$/m);
});

test('build information exposes release notes only for an exact stable version', () => {
    assert.deepEqual(createBuildInformation({}, manifest), { version: 'dev', channel: 'dev', release: null });
    assert.deepEqual(createBuildInformation({ BUILD_VERSION: 'sha-1234567', BUILD_CHANNEL: 'alpha' }, manifest), { version: 'sha-1234567', channel: 'alpha', release: null });
    assert.equal(createBuildInformation({ BUILD_VERSION: '1.0.0', BUILD_CHANNEL: 'stable' }, manifest).release.version, '1.0.0');
    assert.equal(createBuildInformation({ BUILD_VERSION: '9.9.9', BUILD_CHANNEL: 'stable' }, manifest).release, null);
    assert.equal(createBuildInformation({ BUILD_VERSION: '1.0.0', BUILD_CHANNEL: 'unexpected' }, manifest).channel, 'dev');
});

test('release CLI can write complete Markdown notes', () => {
    const temporary = path.join(os.tmpdir(), `javascript-arcade-release-notes-${process.pid}.md`);
    try {
        require('node:child_process').execFileSync(process.execPath, ['scripts/release-notes.js', 'markdown', '1.0.0', temporary]);
        assert.match(fs.readFileSync(temporary, 'utf8'), /## Highlights[\s\S]*## Fixes[\s\S]*## Technical notes/);
    } finally { fs.rmSync(temporary, { force: true }); }
});

test('shared shell presents stable notes once and keeps the version reusable', () => {
    const script = fs.readFileSync('arcade.js', 'utf8'), styles = fs.readFileSync('arcade.css', 'utf8');
    assert.match(script, /arcade:last-seen-release/);
    assert.match(script, /channel === 'stable'/);
    assert.match(script, /buildVersionButton\.addEventListener\('click', showReleaseDialog\)/);
    assert.match(script, /localStorage\.setItem\(seenKey, release\.version\)/);
    assert.match(script, /entry\.textContent = item/);
    assert.match(styles, /\.arcade-release-dialog/);
    assert.match(styles, /\.arcade-build-version button:focus-visible/);
});
