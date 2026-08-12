'use strict';

const net = require('node:net');

const PRIVATE_TOP_LEVEL = new Set([
    'compose.yaml',
    'compose.nas.yaml',
    'Dockerfile',
    'package.json',
    'package-lock.json',
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

function originAllowed(request, allowedOrigins, trustProxy = false) {
    const origin = request.headers.origin;
    if (!origin) return true;
    return origin === requestOrigin(request, trustProxy) || allowedOrigins.includes(origin);
}

function isPrivatePath(pathname) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.some(segment => segment.startsWith('.'))) return true;
    if (['server', 'tests', 'node_modules', 'data'].includes(segments[0])) return true;
    return segments.length === 1 && PRIVATE_TOP_LEVEL.has(segments[0]);
}

module.exports = { clientIp, isPrivatePath, originAllowed, parseCookies, requestOrigin };
