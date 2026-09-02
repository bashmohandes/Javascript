'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
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
