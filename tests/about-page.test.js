'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const page = fs.readFileSync('about.html', 'utf8');
const styles = fs.readFileSync('about.css', 'utf8');
const shell = fs.readFileSync('arcade.js', 'utf8');
const worker = fs.readFileSync('service-worker.js', 'utf8');

test('shared arcade navigation exposes the about page', () => {
    assert.match(shell, /about\.href = `\$\{rootPath\}about\.html`/);
    assert.match(shell, /about\.setAttribute\('aria-current', 'page'\)/);
});

test('about page presents the owner, work, community projects, and patents', () => {
    assert.match(page, /Mohamed Elsherif/);
    assert.match(page, /Apple’s Services Architecture and Efficiency team/);
    assert.match(page, /AskDeveloper Podcast/);
    assert.match(page, /US11531532B2/);
    assert.match(page, /US11956232B2/);
});

test('about page links to the public profile and social destinations safely', () => {
    for (const destination of ['bashmohandes.com', 'askdeveloper.com', 'linkedin.com', 'github.com', 'youtube.com', 'soundcloud.com', 'tiktok.com', 'x.com', 'facebook.com']) {
        assert.match(page, new RegExp(`href="https://(?:www\\.)?${destination.replace('.', '\\.')}`));
    }
    const externalLinks = page.match(/<a href="https:[^>]+>/g) || [];
    assert.ok(externalLinks.length >= 11);
    for (const link of externalLinks) assert.match(link, /target="_blank" rel="[^"]*noopener noreferrer"/);
});

test('about page supports every experience theme and phone layouts', () => {
    assert.match(page, /src="theme-init\.js"[\s\S]*href="arcade\.css"[\s\S]*href="about\.css"/);
    assert.match(styles, /data-arcade-theme="cabinet"/);
    assert.match(styles, /data-arcade-theme="calm"/);
    assert.match(styles, /@media \(max-width:520px\)/);
});

test('about page is available from the offline app shell', () => {
    assert.match(worker, /'\.\/about\.html'/);
    assert.match(worker, /'\.\/about\.css'/);
});
