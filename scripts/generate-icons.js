'use strict';

// Raster app icons are generated rather than committed because this repository's
// pull-request tooling accepts text patches only. The vector source remains in
// icon.svg; this dependency-free renderer reproduces its palette and JS mark.
const fs = require('node:fs');
const zlib = require('node:zlib');

const colors = {
    background: [13, 20, 32],
    teal: [31, 82, 96],
    purple: [73, 53, 104],
    mint: [131, 230, 195]
};
const glyphs = {
    J: ['11111', '00100', '00100', '00100', '00100', '10100', '01100'],
    S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110']
};

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
    const name = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
    return Buffer.concat([length, name, data, checksum]);
}

function encodePng(size, pixels) {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header.set([8, 2, 0, 0, 0], 8);
    const rows = [];
    for (let y = 0; y < size; y += 1) {
        rows.push(Buffer.from([0]), pixels.subarray(y * size * 3, (y + 1) * size * 3));
    }
    return Buffer.concat([
        Buffer.from('89504e470d0a1a0a', 'hex'),
        pngChunk('IHDR', header),
        pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
        pngChunk('IEND', Buffer.alloc(0))
    ]);
}

function renderIcon(size) {
    const scale = 3;
    const canvasSize = size * scale;
    const pixels = Buffer.alloc(canvasSize * canvasSize * 3);
    for (let index = 0; index < pixels.length; index += 3) pixels.set(colors.background, index);

    function setPixel(x, y, color) {
        if (x < 0 || y < 0 || x >= canvasSize || y >= canvasSize) return;
        pixels.set(color, (y * canvasSize + x) * 3);
    }

    function circle(cx, cy, radius, color) {
        cx *= scale; cy *= scale; radius *= scale;
        for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(canvasSize, Math.ceil(cy + radius)); y += 1) {
            const offset = Math.sqrt(Math.max(0, radius ** 2 - (y + 0.5 - cy) ** 2));
            for (let x = Math.max(0, Math.floor(cx - offset)); x < Math.min(canvasSize, Math.ceil(cx + offset)); x += 1) setPixel(x, y, color);
        }
    }

    function roundedRectangle(left, top, right, bottom, radius, color) {
        left *= scale; top *= scale; right *= scale; bottom *= scale; radius *= scale;
        for (let y = Math.floor(top); y < Math.ceil(bottom); y += 1) {
            for (let x = Math.floor(left); x < Math.ceil(right); x += 1) {
                const dx = Math.max(left + radius - (x + 0.5), 0, x + 0.5 - (right - radius));
                const dy = Math.max(top + radius - (y + 0.5), 0, y + 0.5 - (bottom - radius));
                if (dx ** 2 + dy ** 2 <= radius ** 2) setPixel(x, y, color);
            }
        }
    }

    circle(size * 0.17, size * 0.16, size * 0.26, colors.teal);
    circle(size * 0.88, size * 0.86, size * 0.3, colors.purple);
    roundedRectangle(size * 0.183, size * 0.183, size * 0.817, size * 0.817, size * 0.18, colors.mint);

    const cell = size * 0.052;
    const gap = size * 0.035;
    let offsetX = (size - (10 * cell + gap)) / 2;
    const offsetY = size * 0.31;
    for (const character of 'JS') {
        glyphs[character].forEach((row, y) => [...row].forEach((filled, x) => {
            if (filled === '1') roundedRectangle(
                offsetX + x * cell, offsetY + y * cell,
                offsetX + (x + 1) * cell + 0.5, offsetY + (y + 1) * cell + 0.5,
                cell * 0.12, colors.background
            );
        }));
        offsetX += 5 * cell + gap;
    }

    const output = Buffer.alloc(size * size * 3);
    for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
            const totals = [0, 0, 0];
            for (let sourceY = y * scale; sourceY < (y + 1) * scale; sourceY += 1) {
                for (let sourceX = x * scale; sourceX < (x + 1) * scale; sourceX += 1) {
                    const index = (sourceY * canvasSize + sourceX) * 3;
                    for (let channel = 0; channel < 3; channel += 1) totals[channel] += pixels[index + channel];
                }
            }
            const index = (y * size + x) * 3;
            for (let channel = 0; channel < 3; channel += 1) output[index + channel] = Math.floor(totals[channel] / scale ** 2);
        }
    }
    return encodePng(size, output);
}

for (const [filename, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
    fs.writeFileSync(filename, renderIcon(size));
    console.log(`Generated ${filename} (${size}x${size})`);
}
