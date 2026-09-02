'use strict';

const fs = require('node:fs');
const path = require('node:path');

function assetTag(stats) {
    return `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
}

function requestIsFresh(request, etag, modifiedAt) {
    const tags = String(request.headers['if-none-match'] || '').split(',').map(value => value.trim());
    if (tags.some(tag => tag === '*' || tag === etag)) return true;
    if (request.headers['if-none-match']) return false;
    const since = Date.parse(request.headers['if-modified-since'] || '');
    return Number.isFinite(since) && Math.floor(modifiedAt.getTime() / 1000) <= Math.floor(since / 1000);
}

function createStaticAssetHandler({ root, mime, contentSecurityPolicy }) {
    const cache = new Map();
    return async function serveStaticAsset(request, response, pathname) {
        let filePath = path.resolve(root, `.${pathname}`);
        if (!filePath.startsWith(root + path.sep) && filePath !== root) { response.writeHead(403).end('Forbidden'); return; }
        try {
            let stats = await fs.promises.stat(filePath);
            if (stats.isDirectory()) { filePath = path.join(filePath, 'index.html'); stats = await fs.promises.stat(filePath); }
            if (!stats.isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' });
            const assetPath = path.relative(root, filePath).split(path.sep).join('/'), etag = assetTag(stats), modifiedAt = stats.mtime;
            const headers = {
                'content-type': mime[path.extname(filePath)] || 'application/octet-stream',
                'cache-control': 'no-cache',
                etag,
                'last-modified': modifiedAt.toUTCString()
            };
            response.setHeader('content-security-policy', contentSecurityPolicy(assetPath));
            if (requestIsFresh(request, etag, modifiedAt)) { response.writeHead(304, headers); response.end(); return; }
            if (request.method === 'HEAD') { response.writeHead(200, headers); response.end(); return; }
            let entry = cache.get(filePath);
            if (!entry || entry.etag !== etag) { entry = { etag, content: await fs.promises.readFile(filePath) }; cache.set(filePath, entry); }
            response.writeHead(200, headers);
            response.end(entry.content);
        } catch (error) {
            const missing = error.code === 'ENOENT' || error.code === 'ENOTDIR';
            response.writeHead(missing ? 404 : 500).end(missing ? 'Not found' : 'Server error');
        }
    };
}

module.exports = { assetTag, requestIsFresh, createStaticAssetHandler };
