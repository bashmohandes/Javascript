'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const runtime = fs.readFileSync('arcade.js', 'utf8');
const styles = fs.readFileSync('arcade.css', 'utf8');
const worker = fs.readFileSync('service-worker.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));

test('shared shell owns one installable arcade manifest', () => {
    assert.equal(manifest.name, 'JavaScript Arcade');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.start_url, './');
    assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
    assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
    assert.match(fs.readFileSync('pong/index.html', 'utf8'), /rel="manifest" href="\.\.\/manifest\.webmanifest"/);
    assert.match(runtime, /manifest\.webmanifest/);
    assert.match(runtime, /serviceWorker\.register\(`\$\{rootPath\}service-worker\.js`/);
    assert.match(worker, /addEventListener\('fetch'/);
    assert.match(worker, /url\.pathname\.includes\('\/api\/'\)/);
});

test('install hint responds to native browser installation lifecycle', () => {
    assert.match(runtime, /beforeinstallprompt[\s\S]*event\.preventDefault\(\)/);
    assert.match(runtime, /const prompt = installPrompt;[\s\S]*prompt\.prompt\(\)/);
    assert.match(runtime, /prompt\.userChoice/);
    assert.match(runtime, /appinstalled/);
    assert.match(runtime, /display-mode: standalone/);
    assert.match(runtime, /navigator\.standalone === true/);
});

test('manual install guides cover touch iPads, iPhones, Android, and supported Mac Safari', () => {
    assert.match(runtime, /platform === 'MacIntel' && navigator\.maxTouchPoints > 1/);
    assert.match(runtime, /iPhone\|iPod/);
    assert.match(runtime, /isAndroid/);
    assert.match(runtime, /isSafari[\s\S]*safariVersion >= 17/);
    assert.match(runtime, /Add to Home Screen/);
    assert.match(runtime, /Add to Dock/);
});

test('install UI is accessible, dismissible, and safe-area aware', () => {
    assert.match(runtime, /class="arcade-install-dismiss" aria-label="Dismiss install suggestion"/);
    assert.match(runtime, /<ol>/);
    assert.match(runtime, /role="status" aria-live="polite"/);
    assert.match(runtime, /sessionStorage\.setItem\(dismissedKey, 'yes'\)/);
    assert.match(styles, /\.arcade-install-hint\s*{[^}]*position:fixed;[^}]*env\(safe-area-inset-bottom\)/);
    assert.match(styles, /body\.arena-fullscreen \.arcade-install-hint/);
    assert.match(styles, /prefers-reduced-motion: reduce[^}]*\.arcade-install-hint/);
});
