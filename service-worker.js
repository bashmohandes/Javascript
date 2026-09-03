'use strict';

const CACHE_NAME = 'js-playground-v10';
const APP_SHELL = [
    './',
    './index.html',
    './arcade.css',
    './arcade.js',
    './fonts/Silkscreen-Regular.ttf',
    './fonts/OFL-Silkscreen.txt',
    './scripts/game-events.js',
    './scripts/audio.js',
    './scripts/game-saves.js',
    './theme-init.js',
    './manifest.webmanifest'
];

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.includes('/api/')) return;
    const network = fetch(request);
    event.waitUntil(network.then(response => response.ok ? caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone())) : undefined).catch(() => {}));
    if (request.mode === 'navigate') {
        event.respondWith(network.catch(() => caches.match(request).then(response => response || caches.match('./index.html'))));
        return;
    }
    event.respondWith(caches.match(request).then(response => response || network));
});
