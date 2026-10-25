'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { PassThrough } = require('node:stream');
const { createStaticAssetHandler } = require('../server/static-assets');

function response() {
    return {
        headers: {}, status: null, body: null,
        setHeader(name, value) { this.headers[name] = value; },
        writeHead(status, headers = {}) { this.status = status; Object.assign(this.headers, headers); return this; },
        end(body) { this.body = body; return this; }
    };
}

test('static assets are cached in memory and support conditional and HEAD requests', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-static-'));
    try {
        fs.writeFileSync(path.join(root, 'asset.js'), 'one');
        const serve = createStaticAssetHandler({ root, mime: { '.js': 'text/javascript' }, contentSecurityPolicy: asset => `asset:${asset}` });
        const first = response(); await serve({ method: 'GET', headers: {} }, first, '/asset.js');
        assert.equal(first.status, 200); assert.equal(first.body.toString(), 'one'); assert.equal(first.headers['cache-control'], 'no-cache'); assert.match(first.headers.etag, /^W\//); assert.equal(first.headers['content-security-policy'], 'asset:asset.js');
        const fresh = response(); await serve({ method: 'GET', headers: { 'if-none-match': first.headers.etag } }, fresh, '/asset.js');
        assert.equal(fresh.status, 304); assert.equal(fresh.body, undefined);
        const head = response(); await serve({ method: 'HEAD', headers: {} }, head, '/asset.js');
        assert.equal(head.status, 200); assert.equal(head.body, undefined);
        fs.writeFileSync(path.join(root, 'asset.js'), 'updated');
        const updated = response(); await serve({ method: 'GET', headers: { 'if-none-match': first.headers.etag } }, updated, '/asset.js');
        assert.equal(updated.status, 200); assert.equal(updated.body.toString(), 'updated'); assert.notEqual(updated.headers.etag, first.headers.etag);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('static asset handler keeps resolved paths inside its public root', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-static-root-'));
    try {
        const blocked = response(), serve = createStaticAssetHandler({ root, mime: {}, contentSecurityPolicy: () => "default-src 'self'" });
        await serve({ method: 'GET', headers: {} }, blocked, '/../secret.txt');
        assert.equal(blocked.status, 403);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('static assets cannot reach private paths through normalized filesystem aliases', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-private-'));
    try {
        fs.mkdirSync(path.join(root, 'server'));
        fs.mkdirSync(path.join(root, 'pong'));
        fs.writeFileSync(path.join(root, 'server', 'index.js'), 'private implementation');
        fs.writeFileSync(path.join(root, 'package.json'), 'private configuration');
        const serve = createStaticAssetHandler({ root, mime: {}, contentSecurityPolicy: () => '' });
        for (const pathname of ['/pong/../server/index.js', '/pong/../package.json', '/SERVER/index.js', '/server./index.js', '/pong/..\\server\\index.js']) {
            const blocked = response(); await serve({ method: 'GET', headers: {} }, blocked, pathname);
            assert.equal(blocked.status, 404, pathname);
            assert.equal(blocked.body, 'Not found');
        }
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('static assets reject directory links into private directories and outside the root', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-links-'));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-outside-'));
    try {
        fs.mkdirSync(path.join(root, 'server'));
        fs.writeFileSync(path.join(root, 'server', 'index.html'), 'private implementation');
        fs.writeFileSync(path.join(outside, 'index.html'), 'outside file');
        fs.symlinkSync(path.join(root, 'server'), path.join(root, 'alias'), 'junction');
        fs.symlinkSync(outside, path.join(root, 'escape'), 'junction');
        const serve = createStaticAssetHandler({ root, mime: {}, contentSecurityPolicy: () => '' });
        for (const pathname of ['/alias/', '/escape/']) {
            const blocked = response(); await serve({ method: 'GET', headers: {} }, blocked, pathname);
            assert.equal(blocked.status, 404, pathname);
        }
    } finally {
        fs.unlinkSync(path.join(root, 'alias')); fs.unlinkSync(path.join(root, 'escape'));
        fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(outside, { recursive: true, force: true });
    }
});

test('static cache evicts least recently used buffers within its byte budget', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-static-budget-'));
    try {
        for (const name of ['a', 'b', 'c']) fs.writeFileSync(path.join(root, `${name}.js`), name.repeat(3));
        const reads = t.mock.method(fs.promises, 'readFile');
        const serve = createStaticAssetHandler({ root, mime: {}, contentSecurityPolicy: () => '', maxCacheBytes: 6 });
        const get = async name => { const result = response(); await serve({ method: 'GET', headers: {} }, result, `/${name}.js`); assert.equal(result.status, 200); };
        await get('a'); await get('b'); await get('a'); await get('c'); await get('a');
        assert.equal(reads.mock.callCount(), 3, 'recently used a stays cached');
        await get('b'); assert.equal(reads.mock.callCount(), 4, 'b was evicted');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('large static files stream without entering the readFile cache', async t => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-static-stream-'));
    try {
        const content = Buffer.alloc(128 * 1024, 'x'); fs.writeFileSync(path.join(root, 'large.js'), content);
        const reads = t.mock.method(fs.promises, 'readFile');
        const serve = createStaticAssetHandler({ root, mime: {}, contentSecurityPolicy: () => '', maxCachedFileBytes: 1024 });
        for (let attempt = 0; attempt < 2; attempt += 1) {
            const stream = new PassThrough(), helpers = response(), chunks = [];
            Object.assign(stream, { headers: helpers.headers, setHeader: helpers.setHeader, writeHead: helpers.writeHead });
            stream.on('data', chunk => chunks.push(chunk));
            await serve({ method: 'GET', headers: {} }, stream, '/large.js');
            assert.equal(stream.status, 200); assert.deepEqual(Buffer.concat(chunks), content);
            assert.equal(stream.headers['content-length'], content.length);
        }
        assert.equal(reads.mock.callCount(), 0);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('static assets reject mutation methods before reading files', async t => {
    const reads = t.mock.method(fs.promises, 'readFile');
    const serve = createStaticAssetHandler({ root: path.resolve(__dirname, '..'), mime: {}, contentSecurityPolicy: () => '' });
    const result = response(); await serve({ method: 'POST', headers: {} }, result, '/index.html');
    assert.equal(result.status, 405); assert.equal(result.headers.allow, 'GET, HEAD'); assert.equal(reads.mock.callCount(), 0);
});
