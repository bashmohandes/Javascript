'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { clientIp, contentSecurityPolicy, HttpError, isPrivatePath, originAllowed, parseCookies, RateLimiter, readJson, RequestBodyGuard, requestOrigin, useSecureCookies, WebSocketGuard } = require('../server/http-security');

function request(headers = {}, encrypted = false) {
    return { headers, socket: { encrypted, remoteAddress: '127.0.0.1' } };
}

test('JSON request limits count chunks incrementally and reject oversized declarations before reading', async () => {
    const streamed = (chunks, headers = {}) => ({ headers, async *[Symbol.asyncIterator]() { yield* chunks; } });
    assert.deepEqual(await readJson(streamed(['{"value":', '"✓"}']), 64), { value: '✓' });
    assert.deepEqual(await readJson(streamed([...Buffer.from('{"value":1}')].map(byte => Buffer.from([byte]))), 64), { value: 1 });
    await assert.rejects(readJson(streamed(['12345', '67890']), 8), /too large/i);
    let read = false;
    await assert.rejects(readJson({ headers: { 'content-length': '9' }, async *[Symbol.asyncIterator]() { read = true; yield '{}'; } }, 8), /too large/i);
    assert.equal(read, false);
});

test('request body guard bounds aggregate reservations and releases completed bodies', async () => {
    const guard = new RequestBodyGuard({ maxTotalBytes: 12, maxBytesPerIp: 8, timeoutMs: 100 });
    const release = guard.reserve('first', 8);
    assert.throws(() => guard.reserve('first', 1), error => error instanceof HttpError && error.status === 429);
    assert.throws(() => guard.reserve('second', 5), error => error instanceof HttpError && error.status === 429);
    release();
    assert.deepEqual(await readJson({ headers: { 'content-length': '7' }, async *[Symbol.asyncIterator]() { yield '{"x":1}'; } }, 10, { guard, ip: 'first' }), { x: 1 });
    assert.equal(guard.totalBytes, 0); assert.equal(guard.bytesByIp.size, 0);
});

test('request body guard times out unfinished bodies and releases their reservation', async () => {
    const guard = new RequestBodyGuard({ maxTotalBytes: 64, maxBytesPerIp: 64, timeoutMs: 5 }); let finish;
    const pending = { headers: {}, destroy() { finish(); }, async *[Symbol.asyncIterator]() { await new Promise(resolve => { finish = resolve; }); } };
    await assert.rejects(readJson(pending, 64, { guard, ip: 'first' }), error => error instanceof HttpError && error.status === 408);
    assert.equal(guard.totalBytes, 0); assert.equal(guard.bytesByIp.size, 0);
});

test('cookie parsing tolerates malformed values and preserves equals signs', () => {
    assert.deepEqual(parseCookies('session=a%3Db; broken=%E0%A4%A; theme=dark'), { session: 'a=b', theme: 'dark' });
    assert.deepEqual(parseCookies('arcade_session=first; arcade_session=second'), { arcade_session: 'first' });
});

test('production cookies are always secure while development can opt in', () => {
    assert.equal(useSecureCookies({ NODE_ENV: 'production' }), true);
    assert.equal(useSecureCookies({ NODE_ENV: 'production', COOKIE_SECURE: 'false' }), true);
    assert.equal(useSecureCookies({ NODE_ENV: 'development' }), false);
    assert.equal(useSecureCookies({ NODE_ENV: 'development', COOKIE_SECURE: 'false' }), false);
    assert.equal(useSecureCookies({ NODE_ENV: 'development', COOKIE_SECURE: 'true' }), true);
});

test('origin checks use direct connection details unless the proxy is trusted', () => {
    const spoofed = request({ host: 'arcade.test', origin: 'https://arcade.test', 'x-forwarded-proto': 'https' });
    assert.equal(requestOrigin(spoofed, false), 'http://arcade.test');
    assert.equal(originAllowed(spoofed, [], false), false);
    assert.equal(originAllowed(spoofed, [], true), true);
    assert.equal(originAllowed(request({ host: 'arcade.test', origin: 'https://approved.test' }), ['https://approved.test']), true);
});

test('origin checks can require the header for WebSocket handshakes', () => {
    const withoutOrigin = request({ host: 'arcade.test' });
    assert.equal(originAllowed(withoutOrigin, [], false), true, 'ordinary non-browser API clients remain supported');
    assert.equal(originAllowed(withoutOrigin, [], false, true), false, 'WebSocket handshakes must identify their origin');
});

test('content security policy keeps modern scripts local and narrowly permits the classic CDN', () => {
    const modern = contentSecurityPolicy('pong/index.html');
    assert.match(modern, /default-src 'self'/);
    assert.match(modern, /script-src 'self';/);
    assert.match(modern, /script-src-attr 'none'/);
    assert.match(modern, /object-src 'none'/);
    assert.match(modern, /frame-ancestors 'none'/);
    assert.match(modern, /form-action 'self'/);
    assert.doesNotMatch(modern, /cdnjs/);
    for (const file of ['pong/classic/index.html', 'Minesweeper/classic/index.html', 'Sudoku/classic/index.html']) {
        assert.match(contentSecurityPolicy(file), /script-src 'self' https:\/\/cdnjs\.cloudflare\.com;/, file);
        assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /src="\/\/cdnjs\.cloudflare\.com/);
    }
    assert.doesNotMatch(contentSecurityPolicy('classic-looking/path'), /cdnjs/);
    const root = path.resolve(__dirname, '..');
    const traversal = decodeURIComponent('/pong/classic/%2e%2e%2f%2e%2e%2findex.html');
    const resolvedAsset = path.relative(root, path.resolve(root, `.${traversal}`)).split(path.sep).join('/');
    assert.equal(resolvedAsset, 'index.html');
    assert.doesNotMatch(contentSecurityPolicy(resolvedAsset), /cdnjs/);
});

test('trusted proxy addresses must be valid and use the proxy-adjacent value', () => {
    assert.equal(clientIp(request({ 'x-forwarded-for': '203.0.113.4, 198.51.100.7' }), true), '198.51.100.7');
    assert.equal(clientIp(request({ 'x-forwarded-for': 'not-an-ip' }), true), '127.0.0.1');
});

test('private implementation and configuration paths are not public assets', () => {
    for (const pathname of ['/.git/config', '/.env', '/server/index.js', '/tests/accounts.test.js', '/data/arcade.sqlite', '/compose.nas.yaml', '/releases.json']) {
        assert.equal(isPrivatePath(pathname), true, pathname);
    }
    assert.equal(isPrivatePath('/pong/index.html'), false);
});

test('fixed-window rate limits reset and bound their key map', () => {
    const limiter = new RateLimiter(2, 100, 2);
    assert.equal(limiter.consume('first', 0), 0);
    assert.equal(limiter.consume('first', 1), 0);
    assert.equal(limiter.consume('first', 2), 1);
    assert.equal(limiter.consume('first', 100), 0);
    limiter.consume('second', 100); limiter.consume('third', 100); limiter.consume('fourth', 100);
    assert.ok(limiter.entries.size <= 2);
});

test('websocket admission enforces global and per-IP connection limits and releases once', () => {
    const guard = new WebSocketGuard({ maxConnections: 2, maxConnectionsPerIp: 1 });
    const first = new EventEmitter();
    assert.deepEqual(guard.reserve('192.0.2.1'), { ok: true });
    guard.attach(first, '192.0.2.1');
    assert.equal(guard.reserve('192.0.2.1').status, 429);
    assert.deepEqual(guard.reserve('192.0.2.2'), { ok: true });
    assert.equal(guard.reserve('192.0.2.3').status, 503);
    first.emit('close'); first.emit('close');
    assert.equal(guard.totalConnections, 1);
    assert.deepEqual(guard.reserve('192.0.2.3'), { ok: true });
});

test('websocket reservation cleanup can stay on the raw upgraded socket', () => {
    const guard = new WebSocketGuard({ maxConnections: 1 }), rawSocket = new EventEmitter(), client = {};
    guard.reserve('192.0.2.1'); guard.attach(rawSocket, '192.0.2.1'); guard.identify(client, '192.0.2.1');
    assert.equal(guard.checkJoin(client, 0).ok, true);
    rawSocket.emit('close');
    assert.equal(guard.totalConnections, 0);
    assert.deepEqual(guard.reserve('192.0.2.2'), { ok: true });
});

test('websocket message and lobby-action budgets reset on their configured windows', () => {
    const guard = new WebSocketGuard({ messagesPerWindow: 2, messageWindowMs: 100, createsPerWindow: 1, joinsPerWindow: 1, actionWindowMs: 100 });
    const socket = new EventEmitter();
    guard.reserve('192.0.2.1'); guard.attach(socket, '192.0.2.1');
    assert.equal(guard.allowMessage(socket, 0), true);
    assert.equal(guard.allowMessage(socket, 1), true);
    assert.equal(guard.allowMessage(socket, 2), false);
    assert.equal(guard.allowMessage(socket, 100), true);
    assert.equal(guard.checkJoin(socket, 0).ok, true);
    assert.equal(guard.checkJoin(socket, 1).ok, false);
    assert.equal(guard.checkJoin(socket, 100).ok, true);
    const manager = { rooms: new Map() };
    assert.equal(guard.checkCreate(socket, [manager], manager, 0).ok, true);
    assert.equal(guard.checkCreate(socket, [manager], manager, 1).ok, false);
    assert.equal(guard.checkCreate(socket, [manager], manager, 100).ok, true);
});

test('websocket room admission enforces global, per-game, and per-IP active limits', () => {
    const makeSocket = (guard, ip) => { const socket = new EventEmitter(); guard.reserve(ip); guard.attach(socket, ip); return socket; };
    const firstManager = { rooms: new Map() }, secondManager = { rooms: new Map() };
    const guard = new WebSocketGuard({ maxRooms: 3, maxRoomsPerGame: 2, maxRoomsPerIp: 1, createsPerWindow: 20 });
    const first = makeSocket(guard, '192.0.2.1'), second = makeSocket(guard, '192.0.2.2'), third = makeSocket(guard, '192.0.2.3');
    const firstRoom = {}; firstManager.rooms.set('A', firstRoom); guard.ownRoom(first, firstRoom);
    assert.match(guard.checkCreate(first, [firstManager, secondManager], secondManager).message, /maximum number/i);
    assert.equal(guard.checkCreate(second, [firstManager, secondManager], firstManager).ok, true);
    const secondRoom = {}; firstManager.rooms.set('B', secondRoom); guard.ownRoom(second, secondRoom);
    assert.match(guard.checkCreate(third, [firstManager, secondManager], firstManager).message, /this game/i);
    const thirdRoom = {}; secondManager.rooms.set('C', thirdRoom); guard.ownRoom(third, thirdRoom);
    const fourth = makeSocket(guard, '192.0.2.4');
    assert.match(guard.checkCreate(fourth, [firstManager, secondManager], secondManager).message, /arcade/i);
});
