#!/usr/bin/env node
/**
 * Installability check for the built bundle.
 *
 *   npm run check:pwa        (after `npm run build`)
 *
 * Lighthouse is the real gate and it needs a browser, which CI may not have and this
 * environment does not. Everything Lighthouse checks *statically* is checkable here, so it
 * is: a manifest that parses, the icon sizes installability requires, a display mode that
 * qualifies, the tags in index.html, and a service worker whose precache list actually
 * resolves in the output directory.
 *
 * What this does NOT check, and no amount of file reading can: that the worker registers,
 * that the app really boots with the network cut, and that the install prompt fires. Those
 * need a browser — Phase 8's #98/#99 own them.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const APP = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(APP, 'dist');

const results = [];
const check = (ok, label, detail = '') => results.push({ ok, label, detail });

if (!existsSync(DIST)) {
  console.error(`No dist/ at ${DIST}. Run: npm run build`);
  process.exit(2);
}

const read = (rel) => readFileSync(path.join(DIST, rel), 'utf8');
const has = (rel) => existsSync(path.join(DIST, rel));

// --- manifest ---------------------------------------------------------------------------
check(has('manifest.webmanifest'), 'manifest is in the build output');
let manifest = null;
try {
  manifest = JSON.parse(read('manifest.webmanifest'));
  check(true, 'manifest parses as JSON');
} catch (error) {
  check(false, 'manifest parses as JSON', String(error));
}

if (manifest) {
  check(typeof manifest.name === 'string' && manifest.name.length > 0, 'manifest has a name');
  check(typeof manifest.short_name === 'string' && manifest.short_name.length <= 12,
    'short_name is present and fits a home screen', manifest.short_name ?? '');
  check(typeof manifest.start_url === 'string', 'manifest has a start_url');
  check(['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display),
    'display mode qualifies for installation', `display: ${manifest.display}`);
  check(/^#[0-9a-fA-F]{6}$/.test(manifest.background_color ?? ''), 'background_color is a hex colour');
  check(/^#[0-9a-fA-F]{6}$/.test(manifest.theme_color ?? ''), 'theme_color is a hex colour');

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const sized = (s) => icons.find((i) => i.sizes === s && i.type === 'image/png');
  check(!!sized('192x192'), 'a 192x192 PNG icon is declared');
  check(!!sized('512x512'), 'a 512x512 PNG icon is declared');
  check(icons.some((i) => String(i.purpose ?? '').includes('maskable')),
    'a maskable icon is declared', 'without one, launchers crop the icon badly');

  // Declared sizes must match the actual PNG header, not just the manifest's claim.
  for (const icon of icons) {
    const rel = String(icon.src).replace(/^\.\//, '');
    if (!has(rel)) {
      check(false, `icon ${rel} exists in the build`);
      continue;
    }
    const buf = readFileSync(path.join(DIST, rel));
    const isPng = buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    const actual = isPng ? `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}` : 'not a PNG';
    check(isPng && actual === icon.sizes, `icon ${rel} really is ${icon.sizes}`, `header says ${actual}`);
  }
}

// --- index.html -------------------------------------------------------------------------
if (has('index.html')) {
  const html = read('index.html');
  check(/<link[^>]+rel="manifest"/.test(html), 'index.html links the manifest');
  check(/<meta[^>]+name="theme-color"/.test(html), 'index.html declares a theme-color');
  check(/<meta[^>]+name="viewport"/.test(html), 'index.html declares a viewport');
} else {
  check(false, 'index.html is in the build output');
}

// --- service worker ---------------------------------------------------------------------
if (has('sw.js')) {
  const sw = read('sw.js');
  check(/addEventListener\(\s*['"]fetch['"]/.test(sw), 'the worker handles fetch', 'no fetch handler means no offline');
  check(/addEventListener\(\s*['"]install['"]/.test(sw), 'the worker handles install');
  check(/addEventListener\(\s*['"]activate['"]/.test(sw), 'the worker handles activate');

  // Everything the worker claims to precache must actually be there, or the shell it
  // falls back to offline will be a 404 it cached earlier.
  const shell = sw.match(/const SHELL = \[([^\]]*)\]/);
  if (shell) {
    for (const raw of shell[1].match(/'([^']+)'/g) ?? []) {
      const url = raw.slice(1, -1).replace(/^\.\//, '');
      const target = url === '' ? 'index.html' : url;
      check(has(target), `precached ${raw} resolves in the build`);
    }
  } else {
    check(false, 'the worker declares a SHELL precache list');
  }
} else {
  check(false, 'sw.js is in the build output');
}

// --- report -----------------------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'pass' : 'FAIL'}  ${r.label}${r.detail ? `  — ${r.detail}` : ''}`);
}
console.log(
  failed.length === 0
    ? `\nPWA STATIC CHECKS PASSED — ${results.length} checks\n` +
      'Not covered here: worker registration, a real offline boot, and the install prompt.\n' +
      'Those need a browser — Phase 8 #98/#99.'
    : `\nPWA CHECKS FAILED — ${failed.length} of ${results.length}`
);
process.exit(failed.length === 0 ? 0 : 1);
