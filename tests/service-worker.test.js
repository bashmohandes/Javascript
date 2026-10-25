'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

function worker(cacheControl = 'no-cache') {
    const handlers = {}, writes = [], waits = [], deleted = [];
    const response = { ok: true, headers: new Headers({ 'cache-control': cacheControl }), clone() { return this; } };
    const context = {
        URL,
        self: { location: { origin: 'https://arcade.test' }, addEventListener(type, handler) { handlers[type] = handler; }, skipWaiting() {}, clients: { claim: async () => {} } },
        fetch: async () => response,
        caches: { match: async () => undefined, open: async () => ({ put: async request => writes.push(request.url) }), keys: async () => ['js-playground-v15', 'js-playground-v16'], delete: async name => deleted.push(name) }
    };
    vm.runInNewContext(fs.readFileSync('service-worker.js', 'utf8'), context);
    return {
        writes, response, deleted,
        async activate() { handlers.activate({ waitUntil(promise) { waits.push(promise); } }); await Promise.all(waits); },
        async fetch(pathname, mode = 'cors') {
            let result;
            handlers.fetch({ request: { method: 'GET', url: `https://arcade.test${pathname}`, mode }, waitUntil(promise) { waits.push(promise); }, respondWith(promise) { result = promise; } });
            const returned = await result; await Promise.all(waits); return returned;
        }
    };
}

test('service worker excludes API paths including encoded separators and traversal aliases', async () => {
    const app = worker();
    for (const pathname of ['/api/profile', '/%61pi/profile', '/api%2fprofile', '/pong/..%2fapi/profile', '/api%5cprofile', '/bad%zz']) {
        assert.equal(await app.fetch(pathname), undefined, pathname);
    }
    assert.deepEqual(app.writes, []);
});

test('service worker never stores private or no-store responses', async () => {
    for (const directive of ['no-store', 'private, max-age=0', 'public, NO-STORE', 'private="set-cookie"']) {
        const app = worker(directive);
        assert.equal(await app.fetch('/healthz', 'navigate'), app.response);
        assert.deepEqual(app.writes, [], directive);
    }
});

test('service worker still caches public static assets that require revalidation', async () => {
    const app = worker();
    assert.equal(await app.fetch('/arcade.js'), app.response);
    assert.deepEqual(app.writes, ['https://arcade.test/arcade.js']);
});

test('service worker activation removes the previous cache that may contain private responses', async () => {
    const app = worker(); await app.activate();
    assert.deepEqual(app.deleted, ['js-playground-v15']);
});
