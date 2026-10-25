'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { isPrivatePath } = require('./http-security');

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

function createStaticAssetHandler({ root, mime, contentSecurityPolicy, maxCacheBytes = 8 * 1024 * 1024, maxCachedFileBytes = 512 * 1024 }) {
    const cache = new Map();
    let cachedBytes = 0;
    root = path.resolve(root);
    return async function serveStaticAsset(request, response, pathname) {
        if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { allow: 'GET, HEAD' }).end('Method not allowed'); return; }
        if (/[\\:\0]/.test(pathname) || isPrivatePath(pathname)) { response.writeHead(404).end('Not found'); return; }
        let filePath = path.resolve(root, `.${pathname}`);
        if (!filePath.startsWith(root + path.sep) && filePath !== root) { response.writeHead(403).end('Forbidden'); return; }
        try {
            let stats = await fs.promises.stat(filePath);
            if (stats.isDirectory()) { filePath = path.join(filePath, 'index.html'); stats = await fs.promises.stat(filePath); }
            if (!stats.isFile()) throw Object.assign(new Error('Not a file'), { code: 'ENOENT' });
            const realRoot = await fs.promises.realpath(root);
            filePath = await fs.promises.realpath(filePath);
            const relativePath = path.relative(realRoot, filePath);
            if (relativePath === '..' || relativePath.startsWith('..' + path.sep) || path.isAbsolute(relativePath) || isPrivatePath('/' + relativePath)) { response.writeHead(404).end('Not found'); return; }
            const assetPath = relativePath.split(path.sep).join('/'), etag = assetTag(stats), modifiedAt = stats.mtime;
            const headers = {
                'content-type': mime[path.extname(filePath)] || 'application/octet-stream',
                'cache-control': 'no-cache',
                etag,
                'last-modified': modifiedAt.toUTCString()
            };
            response.setHeader('content-security-policy', contentSecurityPolicy(assetPath));
            if (requestIsFresh(request, etag, modifiedAt)) { response.writeHead(304, headers); response.end(); return; }
            headers['content-length'] = stats.size;
            if (request.method === 'HEAD') { response.writeHead(200, headers); response.end(); return; }
            let entry = cache.get(filePath);
            if (entry) { cache.delete(filePath); cachedBytes -= entry.content.length; }
            if (!entry || entry.etag !== etag) {
                if (stats.size > Math.min(maxCachedFileBytes, maxCacheBytes)) {
                    response.writeHead(200, headers);
                    await pipeline(fs.createReadStream(filePath), response);
                    return;
                }
                entry = { etag, content: await fs.promises.readFile(filePath) };
            }
            // The file can grow between stat and read; only retain buffers within the budget.
            if (entry.content.length <= Math.min(maxCachedFileBytes, maxCacheBytes)) {
                while (cachedBytes + entry.content.length > maxCacheBytes && cache.size) {
                    const oldest = cache.keys().next().value;
                    cachedBytes -= cache.get(oldest).content.length; cache.delete(oldest);
                }
                // Another request may have populated this key while readFile was pending.
                if (cache.has(filePath)) cachedBytes -= cache.get(filePath).content.length;
                cache.set(filePath, entry); cachedBytes += entry.content.length;
            }
            headers['content-length'] = entry.content.length;
            response.writeHead(200, headers);
            response.end(entry.content);
        } catch (error) {
            if (response.headersSent) { response.destroy(); return; }
            const missing = error.code === 'ENOENT' || error.code === 'ENOTDIR';
            response.writeHead(missing ? 404 : 500).end(missing ? 'Not found' : 'Server error');
        }
    };
}

module.exports = { assetTag, requestIsFresh, createStaticAssetHandler };
