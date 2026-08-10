'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { WebSocketServer } = require('ws');
const { RoomManager } = require('./rooms');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 8080;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
const rooms = new RoomManager({
    reconnectMs: Number(process.env.RECONNECT_GRACE_MS) || 15000,
    roomTimeoutMs: Number(process.env.ROOM_TIMEOUT_MS) || 1800000
});
const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
};

const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname === '/healthz') {
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        response.end(JSON.stringify({ status: 'ok', rooms: rooms.rooms.size }));
        return;
    }
    if (pathname === '/api/rooms' && request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        response.end(JSON.stringify({ rooms: rooms.publicRooms() }));
        return;
    }
    if (/^\/(?:server|tests|node_modules)(?:\/|$)/.test(pathname) || /^\/(?:package(?:-lock)?\.json|compose\.yaml|Dockerfile|project(?:\.lock)?\.json)$/.test(pathname)) {
        response.writeHead(404).end('Not found');
        return;
    }
    let filePath = path.resolve(root, `.${pathname}`);
    if (!filePath.startsWith(root + path.sep) && filePath !== root) { response.writeHead(403).end('Forbidden'); return; }
    try {
        if (fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    } catch { /* handled by readFile */ }
    fs.readFile(filePath, (error, content) => {
        if (error) { response.writeHead(error.code === 'ENOENT' ? 404 : 500).end(error.code === 'ENOENT' ? 'Not found' : 'Server error'); return; }
        response.writeHead(200, { 'content-type': mime[path.extname(filePath)] || 'application/octet-stream', 'x-content-type-options': 'nosniff' });
        response.end(content);
    });
});

const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (request, socket, head) => {
    const origin = request.headers.origin;
    if (new URL(request.url, 'http://localhost').pathname !== '/ws' || (allowedOrigins.length && !allowedOrigins.includes(origin))) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
    }
    websocketServer.handleUpgrade(request, socket, head, client => websocketServer.emit('connection', client));
});

function send(socket, message) { if (socket.readyState === 1) socket.send(JSON.stringify(message)); }
function credentials(room, player) { return { type: 'session', roomCode: room.code, playerId: player.id, playerToken: player.token, side: player.side }; }

websocketServer.on('connection', socket => {
    let membership = null;
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    socket.on('message', raw => {
        let message;
        try { message = JSON.parse(raw.toString()); } catch { send(socket, { type: 'error', message: 'Invalid message.' }); return; }
        try {
            if (!membership && message.type === 'create-room') membership = rooms.create(socket, { visibility: message.visibility, passcode: message.passcode });
            else if (!membership && message.type === 'join-room') membership = rooms.join(message.roomCode, socket, message.passcode);
            else if (!membership && message.type === 'resume') membership = rooms.resume(message.roomCode, message.playerToken, socket);
            else if (!membership) throw new Error('Create or join a room first.');
            else if (message.type === 'ready' || message.type === 'rematch') {
                const started = rooms.ready(membership.room, membership.player);
                rooms.broadcast(membership.room, { type: started ? 'match-started' : 'waiting-ready', side: membership.player.side });
            } else if (message.type === 'input') rooms.input(membership.room, membership.player, message);
            else if (message.type === 'color') { rooms.color(membership.room, membership.player, message.color); rooms.broadcast(membership.room, { type: 'color', side: membership.player.side, color: message.color }); }
            else if (message.type === 'leave') { rooms.disconnect(membership.room, membership.player); rooms.broadcast(membership.room, { type: 'peer-left', reconnectMs: rooms.reconnectMs }); membership = null; }
            else throw new Error('Unsupported message type.');

            if (membership && ['create-room', 'join-room', 'resume'].includes(message.type)) {
                send(socket, { ...credentials(membership.room, membership.player), visibility: membership.room.visibility });
                rooms.broadcast(membership.room, { type: 'room-status', players: membership.room.players.map(player => Boolean(player?.connected)) });
                if (message.type === 'resume') rooms.broadcast(membership.room, { type: 'peer-reconnected' });
            }
        } catch (error) { send(socket, { type: 'error', message: error.message }); }
    });
    socket.on('close', () => {
        if (!membership) return;
        rooms.disconnect(membership.room, membership.player);
        rooms.broadcast(membership.room, { type: 'peer-left', reconnectMs: rooms.reconnectMs });
    });
});

let lastTick = Date.now();
const simulation = setInterval(() => { const now = Date.now(); rooms.tick((now - lastTick) / 1000, now); lastTick = now; }, 1000 / 60);
const broadcast = setInterval(() => rooms.broadcastStates(), 1000 / 30);
const heartbeat = setInterval(() => websocketServer.clients.forEach(socket => { if (!socket.isAlive) return socket.terminate(); socket.isAlive = false; socket.ping(); }), 15000);

server.listen(port, '0.0.0.0', () => console.log(`JavaScript Playground listening on http://0.0.0.0:${port}`));
function shutdown() { clearInterval(simulation); clearInterval(broadcast); clearInterval(heartbeat); websocketServer.clients.forEach(socket => socket.close(1001, 'Server shutting down')); server.close(() => process.exit(0)); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = { server, rooms };
