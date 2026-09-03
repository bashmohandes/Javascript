'use strict';

const http = require('node:http');
const path = require('node:path');
const { WebSocketServer } = require('ws');
const { RoomManager } = require('./rooms');
const { TicTacToeRooms } = require('./tictactoe-rooms');
const { BattleTanksRooms } = require('./battle-tanks-rooms');
const { openDatabase } = require('./database');
const { Accounts } = require('./accounts');
const { GameSaves, SaveError } = require('./saves');
const { Achievements } = require('./achievements');
const { clientIp: getClientIp, contentSecurityPolicy, HttpError, isPrivatePath, originAllowed, parseCookies, RateLimiter, readJson, RequestBodyGuard, useSecureCookies, WebSocketGuard } = require('./http-security');
const { createStaticAssetHandler } = require('./static-assets');
const { parseMessage, roomStatusMessage, send, sessionMessage } = require('./websocket-messages');
const { generateIcons } = require('../scripts/generate-icons');
const { createBuildInformation } = require('./build-info');

const root = path.resolve(__dirname, '..');
generateIcons(root, { onlyMissing: true });
const port = Number(process.env.PORT) || 8080;
const buildInformation = createBuildInformation();
const database = openDatabase();
const achievements = new Achievements(database);
const accounts = new Accounts(database, achievements);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
const trustProxy = process.env.TRUST_PROXY === 'true';
const trustedResult = (userId, result) => accounts.record(userId, result, { trustedOnline: true });
const rooms = new RoomManager({
    reconnectMs: Number(process.env.RECONNECT_GRACE_MS) || 15000,
    roomTimeoutMs: Number(process.env.ROOM_TIMEOUT_MS) || 1800000,
    recordResult: trustedResult
});
const ticRooms = new TicTacToeRooms({ reconnectMs: Number(process.env.RECONNECT_GRACE_MS) || 15000, roomTimeoutMs: Number(process.env.ROOM_TIMEOUT_MS) || 1800000, recordResult: trustedResult });
const tankRooms = new BattleTanksRooms({ reconnectMs: Number(process.env.RECONNECT_GRACE_MS) || 15000, roomTimeoutMs: Number(process.env.ROOM_TIMEOUT_MS) || 1800000, recordResult: trustedResult });
const positiveInteger = (value, fallback) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
const gameSaves = new GameSaves(database, {
    maxTotalBytes: positiveInteger(process.env.SAVE_MAX_TOTAL_BYTES, 512 * 1024 * 1024),
    maxUserBytes: positiveInteger(process.env.SAVE_MAX_BYTES_PER_USER, 16 * 1024 * 1024)
});
const requestBodyGuard = new RequestBodyGuard({
    maxTotalBytes: positiveInteger(process.env.HTTP_BODY_MAX_IN_FLIGHT_BYTES, 16 * 1024 * 1024),
    maxBytesPerIp: positiveInteger(process.env.HTTP_BODY_MAX_IN_FLIGHT_BYTES_PER_IP, 4 * 1024 * 1024),
    timeoutMs: positiveInteger(process.env.HTTP_BODY_TIMEOUT_MS, 30000)
});
const websocketGuard = new WebSocketGuard({
    maxConnections: positiveInteger(process.env.WS_MAX_CONNECTIONS, 250),
    maxConnectionsPerIp: positiveInteger(process.env.WS_MAX_CONNECTIONS_PER_IP, 20),
    messagesPerWindow: positiveInteger(process.env.WS_MESSAGES_PER_10S, 300),
    createsPerWindow: positiveInteger(process.env.WS_ROOM_CREATES_PER_MINUTE, 10),
    joinsPerWindow: positiveInteger(process.env.WS_JOINS_PER_MINUTE, 60),
    maxRooms: positiveInteger(process.env.ROOM_MAX_TOTAL, 200),
    maxRoomsPerGame: positiveInteger(process.env.ROOM_MAX_PER_GAME, 100),
    maxRoomsPerIp: positiveInteger(process.env.ROOM_MAX_PER_IP, 5)
});
const roomManagers = [rooms, ticRooms, tankRooms];
const publicRoomLimit = positiveInteger(process.env.PUBLIC_ROOM_LIMIT, 50);
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
const serveStaticAsset = createStaticAssetHandler({ root, mime, contentSecurityPolicy });

function json(response, status, body, headers = {}) {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
    response.end(JSON.stringify(body));
}
function cookies(request) { return parseCookies(request.headers.cookie); }
function sessionUser(request) { return accounts.userForToken(cookies(request).arcade_session); }
function cookieSecurity() { return useSecureCookies() ? '; Secure' : ''; }
function sessionCookie(token, expiresAt) { return `arcade_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Expires=${new Date(expiresAt).toUTCString()}${cookieSecurity()}`; }
const loginLimiter = new RateLimiter(10, 15 * 60 * 1000);
const loginIpLimiter = new RateLimiter(50, 15 * 60 * 1000);
const registrationLimiter = new RateLimiter(5, 60 * 60 * 1000);
const resultLimiter = new RateLimiter(60, 60 * 60 * 1000);
const saveLimiter = new RateLimiter(120, 60 * 60 * 1000);
function clientIp(request) { return getClientIp(request, trustProxy); }
function readRequestJson(request, maximum) { return readJson(request, maximum, { guard: requestBodyGuard, ip: clientIp(request) }); }
function throttle(response, retryAfter) { return json(response, 429, { error: 'Too many attempts. Try again later.' }, { 'retry-after': retryAfter }); }
function sameOrigin(request, requireOrigin = false) {
    return originAllowed(request, allowedOrigins, trustProxy, requireOrigin);
}

const server = http.createServer(async (request, response) => {
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
    response.setHeader('x-frame-options', 'DENY');
    response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
    catch { response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Bad request'); return; }
    response.setHeader('content-security-policy', contentSecurityPolicy());
    if (pathname === '/healthz') {
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        response.end(JSON.stringify({ status: 'ok', rooms: rooms.rooms.size }));
        return;
    }
    if (pathname === '/api/version' && request.method === 'GET') return json(response, 200, buildInformation);
    if (pathname === '/api/rooms' && request.method === 'GET') {
        response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        response.end(JSON.stringify({ rooms: rooms.publicRooms(publicRoomLimit) }));
        return;
    }
    if (pathname === '/api/tictactoe/rooms' && request.method === 'GET') return json(response, 200, { rooms: ticRooms.publicRooms(publicRoomLimit) });
    if (pathname === '/api/battle-tanks/rooms' && request.method === 'GET') return json(response, 200, { rooms: tankRooms.publicRooms(publicRoomLimit) });
    const achievementList = pathname.match(/^\/api\/achievements\/(pong|sudoku|minesweeper|tictactoe|battletanks|tetris)$/);
    if (achievementList && request.method === 'GET') return json(response, 200, { game: achievementList[1], achievements: achievements.list(sessionUser(request)?.id, achievementList[1]) });
    if (pathname.startsWith('/api/')) {
        try {
            if (!sameOrigin(request)) return json(response, 403, { error: 'Origin not allowed.' });
            if (pathname === '/api/auth/register' && request.method === 'POST') {
                const retryAfter = registrationLimiter.consume(clientIp(request)); if (retryAfter) return throttle(response, retryAfter);
                const body = await readRequestJson(request), user = await accounts.create(body.gamertag, body.passcode), session = accounts.createSession(user.id);
                return json(response, 201, { user }, { 'set-cookie': sessionCookie(session.token, session.expiresAt) });
            }
            if (pathname === '/api/auth/login' && request.method === 'POST') {
                const body = await readRequestJson(request), ip = clientIp(request), loginKey = `${ip}:${String(body.gamertag || '').trim().toLowerCase()}`;
                const retryAfter = Math.max(loginLimiter.consume(loginKey), loginIpLimiter.consume(ip)); if (retryAfter) return throttle(response, retryAfter);
                const user = await accounts.authenticate(body.gamertag, body.passcode), session = accounts.createSession(user.id); loginLimiter.reset(loginKey);
                return json(response, 200, { user }, { 'set-cookie': sessionCookie(session.token, session.expiresAt) });
            }
            if (pathname === '/api/auth/logout' && request.method === 'POST') {
                accounts.deleteSession(cookies(request).arcade_session);
                return json(response, 200, { ok: true }, { 'set-cookie': `arcade_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${cookieSecurity()}` });
            }
            if (pathname === '/api/me' && request.method === 'GET') return json(response, 200, { user: sessionUser(request) });
            const leaderboard = pathname.match(/^\/api\/leaderboards\/(pong|sudoku|minesweeper|tictactoe|battletanks|tetris)$/);
            if (leaderboard && request.method === 'GET') return json(response, 200, { game: leaderboard[1], entries: accounts.leaderboard(leaderboard[1]) });
            const user = sessionUser(request);
            if (!user) return json(response, 401, { error: 'Sign in to continue.' });
            const saveCollection = pathname.match(/^\/api\/saves\/(pong|sudoku|minesweeper|tictactoe|battletanks|tetris)$/);
            const saveItem = pathname.match(/^\/api\/saves\/(pong|sudoku|minesweeper|tictactoe|battletanks|tetris)\/([1-5])$/);
            const saveScreenshot = pathname.match(/^\/api\/saves\/(pong|sudoku|minesweeper|tictactoe|battletanks|tetris)\/([1-5])\/screenshot$/);
            if (saveScreenshot && request.method === 'GET') {
                const image = gameSaves.screenshot(user.id, saveScreenshot[1], saveScreenshot[2]);
                response.writeHead(200, { 'content-type': image.mimeType, 'content-length': image.data.length, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' });
                response.end(image.data); return;
            }
            if (saveCollection && request.method === 'GET') return json(response, 200, { game: saveCollection[1], saves: gameSaves.list(user.id, saveCollection[1]) });
            if (saveCollection && request.method === 'POST') {
                const retryAfter = saveLimiter.consume(user.id); if (retryAfter) return throttle(response, retryAfter);
                return json(response, 201, { save: gameSaves.create(user.id, saveCollection[1], await readRequestJson(request, 768 * 1024)) });
            }
            if (saveItem && request.method === 'GET') return json(response, 200, { save: gameSaves.load(user.id, saveItem[1], saveItem[2]) });
            if (saveItem && ['PUT', 'PATCH', 'DELETE'].includes(request.method)) {
                const retryAfter = saveLimiter.consume(user.id); if (retryAfter) return throttle(response, retryAfter);
                const body = await readRequestJson(request, request.method === 'PUT' ? 768 * 1024 : 10000);
                if (request.method === 'PUT') return json(response, 200, { save: gameSaves.update(user.id, saveItem[1], saveItem[2], body) });
                if (request.method === 'PATCH') return json(response, 200, { save: gameSaves.rename(user.id, saveItem[1], saveItem[2], body) });
                return json(response, 200, gameSaves.delete(user.id, saveItem[1], saveItem[2], body.expectedRevision, body.expectedGeneration));
            }
            if (pathname === '/api/profile' && request.method === 'GET') {
                const parameters = new URL(request.url, 'http://localhost').searchParams;
                return json(response, 200, accounts.profile(user.id, parameters.get('page'), parameters.get('pageSize')));
            }
            if (pathname === '/api/profile' && request.method === 'PATCH') {
                const updated = await accounts.update(user.id, await readRequestJson(request)), session = accounts.createSession(user.id);
                return json(response, 200, { user: updated }, { 'set-cookie': sessionCookie(session.token, session.expiresAt) });
            }
            if (pathname === '/api/results' && request.method === 'POST') {
                const retryAfter = resultLimiter.consume(user.id); if (retryAfter) return throttle(response, retryAfter);
                return json(response, 201, accounts.record(user.id, await readRequestJson(request)));
            }
            return json(response, 404, { error: 'API endpoint not found.' });
        } catch (error) {
            if (error instanceof SaveError) return json(response, error.status, { error: error.message, code: error.code, ...(error.current ? { current: error.current } : {}) });
            if (error instanceof HttpError) return json(response, error.status, { error: error.message });
            const clientError = /Gamertag|Passcode|passcode|incorrect|taken|Unknown game|Invalid|details|JSON|large/.test(error.message);
            return json(response, clientError ? 400 : 500, { error: clientError ? error.message : 'Server error.' });
        }
    }
    if (isPrivatePath(pathname)) {
        response.writeHead(404).end('Not found');
        return;
    }
    return serveStaticAsset(request, response, pathname);
});

const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 4096 });
function rejectUpgrade(socket, status, message) {
    const body = `${message}\n`;
    socket.write(`HTTP/1.1 ${status} ${status === 429 ? 'Too Many Requests' : 'Service Unavailable'}\r\nConnection: close\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    socket.destroy();
}
server.on('upgrade', (request, socket, head) => {
    let pathname;
    try { pathname = new URL(request.url, 'http://localhost').pathname; } catch { pathname = ''; }
    if (!['/ws', '/ws/tictactoe', '/ws/battle-tanks'].includes(pathname) || !sameOrigin(request, true)) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return;
    }
    const ip = clientIp(request), admission = websocketGuard.reserve(ip);
    if (!admission.ok) { rejectUpgrade(socket, admission.status, admission.message); return; }
    websocketGuard.attach(socket, ip);
    try {
        websocketServer.handleUpgrade(request, socket, head, client => {
            websocketGuard.identify(client, ip);
            websocketServer.emit('connection', client, request);
        });
    } catch (error) {
        socket.destroy();
    }
});

function createRoom(socket, manager, callback) {
    const allowed = websocketGuard.checkCreate(socket, roomManagers, manager);
    if (!allowed.ok) throw new Error(allowed.message);
    const membership = callback();
    websocketGuard.ownRoom(socket, membership.room);
    return membership;
}
function joinRoom(socket, callback) {
    const allowed = websocketGuard.checkJoin(socket);
    if (!allowed.ok) throw new Error(allowed.message);
    return callback();
}
function acceptMessage(socket) {
    if (websocketGuard.allowMessage(socket)) return true;
    send(socket, { type: 'error', message: 'Message rate limit exceeded.' });
    socket.close(1008, 'Message rate limit exceeded.');
    return false;
}

websocketServer.on('connection', (socket, request) => {
    // Every websocket shares the same heartbeat. Tic-tac-toe used to return
    // before these handlers were installed, so its healthy connections were
    // terminated on the first heartbeat interval.
    socket.isAlive = true;
    socket.on('pong', () => { socket.isAlive = true; });
    if (new URL(request.url, 'http://localhost').pathname === '/ws/battle-tanks') { handleTankSocket(socket, request); return; }
    if (new URL(request.url, 'http://localhost').pathname === '/ws/tictactoe') { handleTicSocket(socket, request); return; }
    let membership = null;
    const user = sessionUser(request), gamertag = user?.gamertag || '';
    socket.on('message', raw => {
        if (!acceptMessage(socket)) return;
        try {
            const message = parseMessage(raw);
            if (membership && membership.player.socket !== socket) throw new Error('This connection has been replaced by a newer session.');
            if (!membership && message.type === 'create-room') membership = createRoom(socket, rooms, () => rooms.create(socket, { visibility: message.visibility, passcode: message.passcode, user }));
            else if (!membership && message.type === 'join-room') membership = joinRoom(socket, () => rooms.join(message.roomCode, socket, message.passcode, gamertag, user));
            else if (!membership && message.type === 'resume') membership = rooms.resume(message.roomCode, message.playerToken, socket);
            else if (!membership) throw new Error('Create or join a room first.');
            else if (message.type === 'ready' || message.type === 'rematch') {
                const started = message.type === 'rematch' ? rooms.rematch(membership.room) : rooms.ready(membership.room, membership.player);
                if (started) rooms.broadcast(membership.room, { type: 'match-started' });
                else rooms.broadcast(membership.room, { type: 'ready-status', ready: membership.room.players.map(player => Boolean(player?.ready)) });
            } else if (message.type === 'input') rooms.input(membership.room, membership.player, message);
            else if (message.type === 'color') { rooms.color(membership.room, membership.player, message.color); rooms.broadcast(membership.room, { type: 'color', side: membership.player.side, color: message.color }); }
            else if (message.type === 'leave') { rooms.disconnect(membership.room, membership.player, socket); rooms.broadcast(membership.room, { type: 'peer-left', reconnectMs: rooms.reconnectMs }); membership = null; }
            else throw new Error('Unsupported message type.');

            if (membership && ['create-room', 'join-room', 'resume'].includes(message.type)) {
                send(socket, sessionMessage(membership.room, membership.player, { includePlayerId: true }));
                rooms.broadcast(membership.room, roomStatusMessage(membership.room));
                if (message.type === 'resume') rooms.broadcast(membership.room, { type: 'peer-reconnected' });
            }
        } catch (error) { send(socket, { type: 'error', message: error.message }); }
    });
    socket.on('close', () => {
        if (!membership) return;
        if (rooms.disconnect(membership.room, membership.player, socket)) {
            rooms.broadcast(membership.room, { type: 'peer-left', reconnectMs: rooms.reconnectMs });
        }
    });
});

function handleTicSocket(socket, request) {
    let membership = null; const user = sessionUser(request), gamertag = user?.gamertag || '';
    const publish = () => membership && ticRooms.broadcast(membership.room, { type: 'state', state: ticRooms.state(membership.room) });
    socket.on('message', raw => {
        if (!acceptMessage(socket)) return;
        try {
            const message = parseMessage(raw);
            if (!membership && message.type === 'create-room') membership = createRoom(socket, ticRooms, () => ticRooms.create(socket, { ...message, user }));
            else if (!membership && message.type === 'join-room') membership = joinRoom(socket, () => ticRooms.join(message.roomCode, socket, message.passcode, gamertag, user));
            else if (!membership && message.type === 'resume') membership = ticRooms.resume(message.roomCode, message.playerToken, socket);
            else if (!membership) throw new Error('Create or join a room first.');
            else if (message.type === 'ready') ticRooms.ready(membership.room, membership.player);
            else if (message.type === 'rematch') ticRooms.rematch(membership.room);
            else if (message.type === 'move') ticRooms.move(membership.room, membership.player, message.cell);
            else if (message.type === 'color') ticRooms.color(membership.room, membership.player, message.color);
            else if (message.type === 'leave') { ticRooms.disconnect(membership.room, membership.player, socket); membership = null; return; }
            else throw new Error('Unsupported message type.');
            if (['create-room', 'join-room', 'resume'].includes(message.type)) send(socket, sessionMessage(membership.room, membership.player));
            ticRooms.broadcast(membership.room, roomStatusMessage(membership.room)); publish();
        } catch (error) { send(socket, { type: 'error', message: error.message }); }
    });
    socket.on('close', () => { if (membership && ticRooms.disconnect(membership.room, membership.player, socket)) ticRooms.broadcast(membership.room, { type: 'peer-left', reconnectMs: ticRooms.reconnectMs }); });
}

function handleTankSocket(socket, request) {
    let membership = null; const user = sessionUser(request);
    const publish = () => membership && tankRooms.broadcastState(membership.room);
    socket.on('message', raw => {
        if (!acceptMessage(socket)) return;
        try {
            const message = parseMessage(raw);
            if (membership && membership.player.socket !== socket) throw new Error('This connection has been replaced by a newer session.');
            if (!membership && message.type === 'create-room') membership = createRoom(socket, tankRooms, () => tankRooms.create(socket, { ...message, user }));
            else if (!membership && message.type === 'join-room') membership = joinRoom(socket, () => tankRooms.join(message.roomCode, socket, message.passcode, user));
            else if (!membership && message.type === 'resume') membership = tankRooms.resume(message.roomCode, message.playerToken, socket);
            else if (!membership) throw new Error('Create or join a room first.');
            else if (message.type === 'ready') tankRooms.ready(membership.room, membership.player);
            else if (message.type === 'rematch') tankRooms.rematch(membership.room);
            else if (['move', 'aim', 'fire', 'activate', 'equip', 'select-weapon'].includes(message.type)) tankRooms.command(membership.room, membership.player, message);
            else if (message.type === 'color') tankRooms.color(membership.room, membership.player, message.color);
            else if (message.type === 'leave') { tankRooms.disconnect(membership.room, membership.player, socket); membership = null; return; }
            else throw new Error('Unsupported message type.');
            if (membership && ['create-room', 'join-room', 'resume'].includes(message.type)) send(socket, sessionMessage(membership.room, membership.player));
            if (membership) {
                if (['create-room', 'join-room', 'resume', 'ready', 'rematch'].includes(message.type)) tankRooms.broadcast(membership.room, roomStatusMessage(membership.room));
                publish();
            }
        } catch (error) { send(socket, { type: 'error', message: error.message }); }
    });
    socket.on('close', () => { if (membership && tankRooms.disconnect(membership.room, membership.player, socket)) { tankRooms.broadcast(membership.room, { type: 'peer-left', reconnectMs: tankRooms.reconnectMs }); publish(); } });
}

let lastTick = Date.now();
const simulation = setInterval(() => { const now = Date.now(); rooms.tick((now - lastTick) / 1000, now); lastTick = now; }, 1000 / 60);
const broadcast = setInterval(() => rooms.broadcastStates(), 1000 / 30);
const ticCleanup = setInterval(() => ticRooms.tick(), 1000);
let lastTankTick = Date.now();
const tankSimulation = setInterval(() => { const now = Date.now(); tankRooms.tick((now - lastTankTick) / 1000, now); lastTankTick = now; tankRooms.broadcastStates(now); }, 1000 / 60);
const heartbeat = setInterval(() => websocketServer.clients.forEach(socket => { if (!socket.isAlive) return socket.terminate(); socket.isAlive = false; socket.ping(); }), 15000);

server.listen(port, '0.0.0.0', () => console.log(`JavaScript Playground listening on http://0.0.0.0:${port}`));
function shutdown() { clearInterval(simulation); clearInterval(ticCleanup); clearInterval(tankSimulation); clearInterval(broadcast); clearInterval(heartbeat); websocketServer.clients.forEach(socket => socket.close(1001, 'Server shutting down')); server.close(() => { database.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = { server, rooms, tankRooms, accounts };
