'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { clientIp, isPrivatePath, originAllowed, parseCookies, requestOrigin } = require('../server/http-security');

function request(headers = {}, encrypted = false) {
    return { headers, socket: { encrypted, remoteAddress: '127.0.0.1' } };
}

test('cookie parsing tolerates malformed values and preserves equals signs', () => {
    assert.deepEqual(parseCookies('session=a%3Db; broken=%E0%A4%A; theme=dark'), { session: 'a=b', theme: 'dark' });
    assert.deepEqual(parseCookies('arcade_session=first; arcade_session=second'), { arcade_session: 'first' });
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

test('trusted proxy addresses must be valid and use the proxy-adjacent value', () => {
    assert.equal(clientIp(request({ 'x-forwarded-for': '203.0.113.4, 198.51.100.7' }), true), '198.51.100.7');
    assert.equal(clientIp(request({ 'x-forwarded-for': 'not-an-ip' }), true), '127.0.0.1');
});

test('private implementation and configuration paths are not public assets', () => {
    for (const pathname of ['/.git/config', '/.env', '/server/index.js', '/tests/accounts.test.js', '/data/arcade.sqlite', '/compose.nas.yaml']) {
        assert.equal(isPrivatePath(pathname), true, pathname);
    }
    assert.equal(isPrivatePath('/pong/index.html'), false);
});
