'use strict';

const fs = require('node:fs');
const path = require('node:path');

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SECTIONS = ['highlights', 'fixes', 'technical'];

function compareVersions(left, right) {
    const a = left.split('.').map(Number), b = right.split('.').map(Number);
    for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
    return 0;
}

function validateManifest(manifest) {
    if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.releases) || !manifest.releases.length) throw new Error('Release manifest must use schemaVersion 1 and contain releases.');
    const versions = new Set();
    manifest.releases.forEach((release, index) => {
        if (!release || !VERSION_PATTERN.test(release.version || '')) throw new Error(`Release ${index + 1} must have a valid SemVer version.`);
        if (versions.has(release.version)) throw new Error(`Release ${release.version} is duplicated.`);
        versions.add(release.version);
        for (const field of ['title', 'summary']) if (typeof release[field] !== 'string' || !release[field].trim()) throw new Error(`Release ${release.version} must have a ${field}.`);
        for (const section of SECTIONS) {
            if (!Array.isArray(release[section]) || !release[section].length || release[section].some(item => typeof item !== 'string' || !item.trim())) throw new Error(`Release ${release.version} must have non-empty ${section}.`);
        }
        if (index && compareVersions(manifest.releases[index - 1].version, release.version) <= 0) throw new Error('Releases must be ordered newest first.');
    });
    return manifest;
}

function loadManifest(filename = path.resolve(__dirname, '..', 'releases.json')) {
    return validateManifest(JSON.parse(fs.readFileSync(filename, 'utf8')));
}

function releaseForVersion(manifest, version) {
    if (!VERSION_PATTERN.test(version || '')) return null;
    return manifest.releases.find(release => release.version === version) || null;
}

function publicRelease(release) {
    if (!release) return null;
    return Object.fromEntries(['version', 'title', 'summary', 'highlights', 'fixes'].map(field => [field, release[field]]));
}

function renderMarkdown(release) {
    if (!release) throw new Error('Cannot render an unknown release.');
    const section = (title, items) => `## ${title}\n\n${items.map(item => `- ${item}`).join('\n')}`;
    return [release.summary, section('Highlights', release.highlights), section('Fixes', release.fixes), section('Technical notes', release.technical)].join('\n\n') + '\n';
}

function validateReleaseVersion(manifest, version, packageFilename = path.resolve(__dirname, '..', 'package.json')) {
    const release = releaseForVersion(manifest, version);
    if (!release) throw new Error(`Release ${version} is not present in releases.json.`);
    if (manifest.releases[0] !== release) throw new Error(`Release ${version} must be the newest manifest entry.`);
    const packageVersion = JSON.parse(fs.readFileSync(packageFilename, 'utf8')).version;
    if (packageVersion !== version) throw new Error(`package.json version ${packageVersion} does not match release ${version}.`);
    return release;
}

function runCli(arguments_) {
    const [command, requestedVersion, output] = arguments_;
    const version = requestedVersion || JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')).version;
    const manifest = loadManifest();
    const release = validateReleaseVersion(manifest, version);
    if (command === 'validate') return;
    if (command === 'title') { process.stdout.write(`${release.title}\n`); return; }
    if (command !== 'markdown') throw new Error('Usage: release-notes.js <validate|title|markdown> [version] [output-file]');
    const markdown = renderMarkdown(release);
    if (output) fs.writeFileSync(output, markdown);
    else process.stdout.write(markdown);
}

if (require.main === module) {
    try { runCli(process.argv.slice(2)); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}

module.exports = { VERSION_PATTERN, compareVersions, loadManifest, publicRelease, releaseForVersion, renderMarkdown, validateManifest, validateReleaseVersion };
