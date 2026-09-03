'use strict';

const net = require('node:net');

class HttpError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
}

class RequestBodyGuard {
    constructor({ maxTotalBytes, maxBytesPerIp, timeoutMs }) {
        this.maxTotalBytes = maxTotalBytes; this.maxBytesPerIp = maxBytesPerIp; this.timeoutMs = timeoutMs;
        this.totalBytes = 0; this.bytesByIp = new Map();
    }
    reserve(ip, bytes) {
        const current = this.bytesByIp.get(ip) || 0;
        if (this.totalBytes + bytes > this.maxTotalBytes || current + bytes > this.maxBytesPerIp) throw new HttpError('Too many request bodies are already in progress.', 429);
        this.totalBytes += bytes; this.bytesByIp.set(ip, current + bytes); let released = false;
        return () => {
            if (released) return; released = true; this.totalBytes -= bytes;
            const remaining = (this.bytesByIp.get(ip) || 0) - bytes;
            if (remaining > 0) this.bytesByIp.set(ip, remaining); else this.bytesByIp.delete(ip);
        };
    }
}

async function readJson(request, maximum = 10000, { guard = null, ip = 'unknown' } = {}) {
    const declaredValue = request.headers?.['content-length']; let capacity = maximum;
    if (declaredValue !== undefined) {
        const normalized = String(declaredValue);
        if (!/^\d+$/.test(normalized) || !Number.isSafeInteger(Number(normalized))) throw new Error('Invalid Content-Length.');
        if (Number(normalized) > maximum) throw new Error('Request is too large.');
        capacity = Number(normalized);
    }
    const release = guard?.reserve(ip, capacity) || (() => {}); let timedOut = false;
    const timer = guard?.timeoutMs ? setTimeout(() => { timedOut = true; request.destroy?.(); }, guard.timeoutMs) : null; timer?.unref?.();
    try {
        let bodyBuffer = null, received = 0;
        for await (const chunk of request) {
            const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            received += bytes.length;
            if (received > maximum) throw new Error('Request is too large.');
            if (received > capacity) throw new Error('Invalid Content-Length.');
            bodyBuffer ||= Buffer.allocUnsafe(capacity);
            bytes.copy(bodyBuffer, received - bytes.length);
        }
        if (timedOut) throw new HttpError('Request body timed out.', 408);
        const body = bodyBuffer ? bodyBuffer.subarray(0, received).toString('utf8') : '';
        try { return body ? JSON.parse(body) : {}; } catch { throw new Error('Invalid JSON.'); }
    } catch (error) {
        if (timedOut && !(error instanceof HttpError)) throw new HttpError('Request body timed out.', 408);
        throw error;
    } finally {
        if (timer) clearTimeout(timer); release();
    }
}

const PRIVATE_TOP_LEVEL = new Set([
    'compose.yaml',
    'compose.nas.yaml',
    'Dockerfile',
    'package.json',
    'package-lock.json',
    'releases.json',
    'project.json',
    'project.lock.json'
]);

function parseCookies(header) {
    const result = {};
    for (const part of String(header || '').split(';')) {
        const separator = part.indexOf('=');
        if (separator < 1) continue;
        try {
            const name = decodeURIComponent(part.slice(0, separator).trim());
            if (!name || Object.hasOwn(result, name)) continue;
            result[name] = decodeURIComponent(part.slice(separator + 1).trim());
        } catch { /* Ignore malformed cookies rather than failing the request. */ }
    }
    return result;
}

function forwardedValue(header) {
    return String(header || '').split(',').map(value => value.trim()).filter(Boolean).at(-1);
}

function clientIp(request, trustProxy = false) {
    if (trustProxy) {
        const forwarded = forwardedValue(request.headers['x-forwarded-for']);
        if (forwarded && net.isIP(forwarded)) return forwarded;
    }
    return request.socket.remoteAddress || 'unknown';
}

function requestOrigin(request, trustProxy = false) {
    const forwardedProtocol = trustProxy ? forwardedValue(request.headers['x-forwarded-proto']) : '';
    const protocol = forwardedProtocol === 'https' || forwardedProtocol === 'http'
        ? forwardedProtocol
        : request.socket.encrypted ? 'https' : 'http';
    const host = request.headers.host;
    return host && !/[\s/\\]/.test(host) ? `${protocol}://${host}` : null;
}

function originAllowed(request, allowedOrigins, trustProxy = false, requireOrigin = false) {
    const origin = request.headers.origin;
    if (!origin) return !requireOrigin;
    return origin === requestOrigin(request, trustProxy) || allowedOrigins.includes(origin);
}

function contentSecurityPolicy(assetPath = '') {
    const classicGame = /^(?:Sudoku|Minesweeper|pong)\/classic(?:\/|$)/.test(assetPath);
    const scriptSources = classicGame ? "'self' https://cdnjs.cloudflare.com" : "'self'";
    return [
        "default-src 'self'",
        `script-src ${scriptSources}`,
        "script-src-attr 'none'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "connect-src 'self' ws: wss:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
        "frame-src 'none'",
        "form-action 'self'",
        "manifest-src 'self'",
        "worker-src 'self'"
    ].join('; ');
}

function useSecureCookies(environment = process.env) {
    return environment.NODE_ENV === 'production' || environment.COOKIE_SECURE === 'true';
}

function isPrivatePath(pathname) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.some(segment => segment.startsWith('.'))) return true;
    if (['server', 'tests', 'node_modules', 'data'].includes(segments[0])) return true;
    return segments.length === 1 && PRIVATE_TOP_LEVEL.has(segments[0]);
}

class RateLimiter {
    constructor(limit, windowMs, maximumEntries = 10000) {
        this.limit = limit;
        this.windowMs = windowMs;
        this.maximumEntries = maximumEntries;
        this.entries = new Map();
    }

    consume(key, now = Date.now()) {
        if (!this.entries.has(key) && this.entries.size >= this.maximumEntries) {
            for (const [entryKey, value] of this.entries) if (value.resetAt <= now) this.entries.delete(entryKey);
            while (this.entries.size >= this.maximumEntries) this.entries.delete(this.entries.keys().next().value);
        }
        let entry = this.entries.get(key);
        if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + this.windowMs };
        entry.count += 1;
        this.entries.set(key, entry);
        return entry.count <= this.limit ? 0 : Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    }

    reset(key) { this.entries.delete(key); }
}

class WebSocketGuard {
    constructor({
        maxConnections = 250,
        maxConnectionsPerIp = 20,
        messagesPerWindow = 300,
        messageWindowMs = 10000,
        createsPerWindow = 10,
        joinsPerWindow = 60,
        actionWindowMs = 60000,
        maxRooms = 200,
        maxRoomsPerGame = 100,
        maxRoomsPerIp = 5
    } = {}) {
        Object.assign(this, { maxConnections, maxConnectionsPerIp, messagesPerWindow, messageWindowMs, maxRooms, maxRoomsPerGame, maxRoomsPerIp });
        this.totalConnections = 0;
        this.connectionsByIp = new Map();
        this.socketIps = new WeakMap();
        this.messageWindows = new WeakMap();
        this.roomOwners = new WeakMap();
        this.createLimiter = new RateLimiter(createsPerWindow, actionWindowMs);
        this.joinLimiter = new RateLimiter(joinsPerWindow, actionWindowMs);
    }

    reserve(ip) {
        const current = this.connectionsByIp.get(ip) || 0;
        if (this.totalConnections >= this.maxConnections) return { ok: false, status: 503, message: 'WebSocket capacity reached.' };
        if (current >= this.maxConnectionsPerIp) return { ok: false, status: 429, message: 'Too many WebSocket connections.' };
        this.totalConnections += 1;
        this.connectionsByIp.set(ip, current + 1);
        return { ok: true };
    }

    releaseIp(ip) {
        const current = this.connectionsByIp.get(ip) || 0;
        if (!current) return;
        this.totalConnections = Math.max(0, this.totalConnections - 1);
        if (current === 1) this.connectionsByIp.delete(ip);
        else this.connectionsByIp.set(ip, current - 1);
    }

    attach(socket, ip) {
        this.socketIps.set(socket, ip);
        let released = false;
        socket.once('close', () => {
            if (released) return;
            released = true;
            this.releaseIp(ip);
        });
    }

    identify(socket, ip) { this.socketIps.set(socket, ip); }

    allowMessage(socket, now = Date.now()) {
        let entry = this.messageWindows.get(socket);
        if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + this.messageWindowMs };
        entry.count += 1;
        this.messageWindows.set(socket, entry);
        return entry.count <= this.messagesPerWindow;
    }

    checkJoin(socket, now = Date.now()) {
        const retryAfter = this.joinLimiter.consume(this.socketIps.get(socket) || 'unknown', now);
        return retryAfter ? { ok: false, message: 'Too many room join attempts.', retryAfter } : { ok: true };
    }

    checkCreate(socket, managers, targetManager, now = Date.now()) {
        const ip = this.socketIps.get(socket) || 'unknown';
        const retryAfter = this.createLimiter.consume(ip, now);
        if (retryAfter) return { ok: false, message: 'Too many rooms created. Try again later.', retryAfter };
        const activeRooms = managers.flatMap(manager => [...manager.rooms.values()]);
        if (activeRooms.length >= this.maxRooms) return { ok: false, message: 'The arcade has reached its active-room limit.' };
        if (targetManager.rooms.size >= this.maxRoomsPerGame) return { ok: false, message: 'This game has reached its active-room limit.' };
        if (activeRooms.filter(room => this.roomOwners.get(room) === ip).length >= this.maxRoomsPerIp) return { ok: false, message: 'You already have the maximum number of active rooms.' };
        return { ok: true };
    }

    ownRoom(socket, room) { this.roomOwners.set(room, this.socketIps.get(socket) || 'unknown'); }
}

module.exports = { clientIp, contentSecurityPolicy, HttpError, isPrivatePath, originAllowed, parseCookies, RateLimiter, readJson, RequestBodyGuard, requestOrigin, useSecureCookies, WebSocketGuard };
