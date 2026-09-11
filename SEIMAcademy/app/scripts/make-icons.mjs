#!/usr/bin/env node
/**
 * Generate the PWA icons.
 *
 *   npm run make:icons        (runs before build)
 *
 * A hand-rolled PNG encoder rather than an image dependency. The icon is a flat accent
 * square with a darker notch — it needs no anti-aliasing, no font, and no image library,
 * and the whole encoder is zlib (in Node core) plus four chunk headers.
 *
 * Icons are generated into public/icons/ and gitignored: derived from the theme tokens,
 * so a token change regenerates them rather than leaving a stale binary in the tree.
 *
 * Installability wants 192x192 and 512x512 PNGs, plus a maskable variant. A maskable icon
 * has to survive a circular crop, so the mark sits inside the middle 80%.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'public', 'icons');

/** Read the palette from the tokens so the icon cannot drift from the theme. */
function token(name) {
  const css = readFileSync(path.join(HERE, '..', 'src', 'theme', 'tokens.css'), 'utf8');
  const hit = css.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})`));
  if (!hit) throw new Error(`token --${name} not found`);
  const h = hit[1].slice(1);
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** `pixel(x, y) -> [r, g, b]`, encoded as a truecolour PNG with no filtering. */
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y += 1) {
    raw[o] = 0; // filter: none
    o += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixel(x, y);
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      o += 3;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const bg = token('bg');
const accent = token('accent');
const surface = token('surface-raised');

/** `inset` is the fraction of the canvas kept clear, so a maskable crop cannot clip the mark. */
const draw = (size, inset) => (x, y) => {
  const pad = Math.round(size * inset);
  const inside = x >= pad && x < size - pad && y >= pad && y < size - pad;
  if (!inside) return bg;
  // A notch out of the lower-right quadrant: recognisable at 16px, still a flat fill.
  const notch = x > size - pad - (size - 2 * pad) * 0.38 && y > size - pad - (size - 2 * pad) * 0.38;
  return notch ? surface : accent;
};

mkdirSync(OUT, { recursive: true });
const written = [];
for (const [name, size, inset] of [
  ['icon-192.png', 192, 0.16],
  ['icon-512.png', 512, 0.16],
  ['icon-maskable-512.png', 512, 0.26],
]) {
  const file = path.join(OUT, name);
  writeFileSync(file, png(size, draw(size, inset)));
  written.push(`${name} (${size}x${size})`);
}
console.log(`icons: ${written.join(', ')}`);
