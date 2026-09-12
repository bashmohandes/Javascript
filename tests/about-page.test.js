'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const page = fs.readFileSync('about.html', 'utf8');
const styles = fs.readFileSync('about.css', 'utf8');
const shell = fs.readFileSync('arcade.js', 'utf8');
const worker = fs.readFileSync('service-worker.js', 'utf8');

function contrast(left, right) {
    const luminance = color => {
        const channels = color.slice(1).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const values = [luminance(left), luminance(right)];
    return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

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

test('about page uses the current color-mode contract and contrast-safe text and focus colors', () => {
    assert.match(styles, /:root\[data-color-mode="dark"\]/);
    assert.doesNotMatch(styles, /data-theme=/);
    assert.match(styles, /color:var\(--pink-text\)/);
    assert.match(styles, /outline:3px solid var\(--focus\)/);
    assert.match(styles, /\.patent-list b \{ color:var\(--link-accent\)/);
    for (const [foreground, background, minimum] of [
        ['#a31558', '#fff9e8', 4.5],
        ['#4b2fc9', '#fff9e8', 3],
        ['#315f54', '#f8fbf9', 4.5],
        ['#ff70b7', '#111a33', 4.5],
        ['#6ef2d0', '#111a33', 3],
        ['#d9b968', '#18231f', 4.5]
    ]) assert.ok(contrast(foreground, background) >= minimum, `${foreground} should meet ${minimum}:1 against ${background}`);
});

test('about page is available from the offline app shell', () => {
    assert.match(worker, /'\.\/about\.html'/);
    assert.match(worker, /'\.\/about\.css'/);
});
