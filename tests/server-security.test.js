'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { WebSocket } = require('ws');

async function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-server-security-'));
    const child = spawn(process.execPath, ['-e', "const { server } = require('./server/index'); server.on('listening', () => process.send(server.address().port));"], {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, PORT: '0', DATABASE_PATH: path.join(directory, 'test.sqlite'), NODE_ENV: 'test', TRUST_PROXY: 'false', ALLOWED_ORIGINS: '' },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    });
    let output = ''; child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; });
    const exit = once(child, 'exit');
    t.after(async () => { child.kill(); await exit; fs.rmSync(directory, { recursive: true, force: true }); });
    const [port] = await Promise.race([
        once(child, 'message'),
        exit.then(() => { throw new Error(`Server exited before startup: ${output}`); })
    ]);
    const server = { port, origin: `http://127.0.0.1:${port}`, output: () => output };
    assert.equal((await request(server, '/healthz')).status, 200);
    return server;
}

function request(server, pathname, options = {}) {
    return new Promise((resolve, reject) => {
        const connection = http.request({ hostname: '127.0.0.1', port: server.port, path: pathname, ...options }, response => {
            const chunks = []; response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
        });
        connection.on('error', reject); connection.end(options.body);
    });
}

async function socket(t, server, endpoint) {
    const client = new WebSocket(`ws://127.0.0.1:${server.port}${endpoint}`, { origin: server.origin });
    client.on('error', () => {});
    client.inbox = []; client.on('message', raw => client.inbox.push(JSON.parse(raw)));
    t.after(() => client.terminate());
    await once(client, 'open');
    return client;
}

async function message(client, predicate) {
    while (true) {
        const index = client.inbox.findIndex(predicate);
        if (index >= 0) return client.inbox.splice(index, 1)[0];
        await once(client, 'message');
    }
}

test('HTTP denies encoded private-path aliases before reading files', { timeout: 15000 }, async t => {
    const server = await fixture(t);
    for (const pathname of ['/pong/..%2fserver/index.js', '/pong/..%2fdata/arcade.sqlite', '/pong/..%2fpackage.json', '/SERVER/index.js', '/server.%20/index.js', '/pong%5c..%5cserver%5cindex.js']) {
        const result = await request(server, pathname);
        assert.equal(result.status, 404, pathname); assert.equal(result.body, 'Not found');
    }
    assert.equal((await request(server, '/pong/')).status, 200);
});

test('malformed WebSocket frames close only the offending connection for every game', { timeout: 15000 }, async t => {
    const server = await fixture(t);
    for (const endpoint of ['/ws', '/ws/tictactoe', '/ws/battle-tanks']) {
        const client = await socket(t, server, endpoint), closed = once(client, 'close');
        // A masked empty text frame with RSV1 set, without negotiated compression.
        client._socket.write(Buffer.from([0xc1, 0x80, 0, 0, 0, 0]));
        await closed;
        const health = await request(server, '/healthz');
        assert.equal(health.status, 200, server.output());
    }
});

test('profile passcode verification is rate limited independently of session rotation', { timeout: 15000 }, async t => {
    const server = await fixture(t);
    const registration = await request(server, '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json', origin: server.origin }, body: JSON.stringify({ gamertag: 'ProfileGuard', passcode: 'passcode' }) });
    assert.equal(registration.status, 201);
    let cookie = registration.headers['set-cookie'][0].split(';')[0];
    const update = currentPasscode => request(server, '/api/profile', { method: 'PATCH', headers: { 'content-type': 'application/json', origin: server.origin, cookie }, body: JSON.stringify({ currentPasscode }) });
    const rotated = await update('passcode'); assert.equal(rotated.status, 200);
    cookie = rotated.headers['set-cookie'][0].split(';')[0];
    for (let attempt = 0; attempt < 9; attempt += 1) assert.equal((await update('wrong')).status, 400);
    const limited = await update('wrong');
    assert.equal(limited.status, 429); assert.ok(Number(limited.headers['retry-after']) > 0);
    assert.equal((await request(server, '/api/me', { headers: { cookie } })).status, 200);
});

test('tic-tac-toe rejects replaced sockets while preserving resume, turns, and rematches', { timeout: 15000 }, async t => {
    const server = await fixture(t), host = await socket(t, server, '/ws/tictactoe');
    host.send(JSON.stringify({ type: 'create-room', visibility: 'public' }));
    const session = await message(host, item => item.type === 'session');
    const guest = await socket(t, server, '/ws/tictactoe');
    guest.send(JSON.stringify({ type: 'join-room', roomCode: session.roomCode }));
    await message(guest, item => item.type === 'session');
    host.send(JSON.stringify({ type: 'ready' })); guest.send(JSON.stringify({ type: 'ready' }));
    await message(guest, item => item.type === 'state' && item.state.running);
    // Keep the old transport alive until an already queued action reaches the server.
    host._socket.pause();
    const replacement = await socket(t, server, '/ws/tictactoe');
    replacement.send(JSON.stringify({ type: 'resume', roomCode: session.roomCode, playerToken: session.playerToken }));
    await message(replacement, item => item.type === 'session');
    await message(replacement, item => item.type === 'state' && item.state.running);
    const closed = once(host, 'close');
    await new Promise((resolve, reject) => host.send(JSON.stringify({ type: 'move', cell: 8 }), error => error ? reject(error) : resolve()));
    host._socket.resume(); await closed;
    replacement.send(JSON.stringify({ type: 'color', color: '#123456' }));
    const resumed = await message(replacement, item => item.type === 'state' && item.state.colors[0] === '#123456');
    assert.deepEqual(resumed.state.board, Array(9).fill(null));
    for (const [client, cell] of [[replacement, 0], [guest, 3], [replacement, 1], [guest, 4], [replacement, 2]]) {
        client.send(JSON.stringify({ type: 'move', cell }));
        await message(replacement, item => item.type === 'state' && item.state.board[cell] !== null);
    }
    replacement.send(JSON.stringify({ type: 'rematch' }));
    const rematch = await message(replacement, item => item.type === 'state' && item.state.running && item.state.board.every(cell => cell === null));
    assert.equal(rematch.state.turn, 1);
});
