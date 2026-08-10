'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { after, before, test } = require('node:test');
const path = require('node:path');

let child;
let port;

function get(pathname) {
    return new Promise((resolve, reject) => {
        const request = http.get({ host: '127.0.0.1', port, path: pathname }, response => {
            let body = '';
            response.setEncoding('utf8');
            response.on('data', chunk => { body += chunk; });
            response.on('end', () => resolve({ status: response.statusCode, body }));
        });
        request.on('error', reject);
    });
}

before(async () => {
    port = await new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const availablePort = probe.address().port;
            probe.close(error => error ? reject(error) : resolve(availablePort));
        });
    });

    child = spawn(process.execPath, ['server/index.js'], {
        cwd: path.resolve(__dirname, '..'),
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Server did not start')), 5000);
        child.once('exit', code => reject(new Error(`Server exited with code ${code}`)));
        child.stdout.on('data', chunk => {
            if (chunk.toString().includes('JavaScript Playground listening')) {
                clearTimeout(timeout);
                resolve();
            }
        });
    });
});

after(() => {
    child?.kill('SIGTERM');
});

test('malformed percent escapes return 400 without stopping the server', async () => {
    assert.equal((await get('/%')).status, 400);
    assert.equal((await get('/healthz')).status, 200);
});

test('only explicit public assets are served', async () => {
    assert.equal((await get('/pong/index.html')).status, 200);
    assert.equal((await get('/.git/config')).status, 404);
    assert.equal((await get('/.env')).status, 404);
    assert.equal((await get('/package.json')).status, 404);
});
