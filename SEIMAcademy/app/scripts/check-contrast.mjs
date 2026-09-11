#!/usr/bin/env node
/**
 * WCAG 2.1 AA contrast verification for the theme tokens.
 *
 *   npm run check:contrast
 *
 * Every pairing the UI can actually produce is declared below and computed, rather than
 * spot-checked by eye. Same posture as the Phase 1 content validators: a rule that is only
 * checked when someone remembers to look is not a rule.
 *
 * Thresholds (WCAG 2.1):
 *   4.5:1  normal body text                      (1.4.3 Contrast (Minimum))
 *   3.0:1  large text, and UI component boundaries / focus indicators (1.4.11 Non-text)
 *
 * Zero dependencies, so it runs before `npm install` has a chance to matter.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOKENS = path.join(HERE, '..', 'src', 'theme', 'tokens.css');

const AA_TEXT = 4.5;
const AA_UI = 3.0;

/** Pull `--name: #rrggbb;` declarations out of the token file. */
function readTokens(file) {
  const css = readFileSync(file, 'utf8');
  const tokens = new Map();
  for (const [, name, hex] of css.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    tokens.set(name, hex);
  }
  return tokens;
}

function toRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6); // ignore alpha; these pairings are all opaque
  if (h.length !== 6) throw new Error(`Unsupported colour: ${hex}`);
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
}

/** WCAG relative luminance. */
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/**
 * Every pairing the UI can produce. Adding a token means adding its pairings here —
 * an unused token is fine, an unverified one is not.
 */
const PAIRINGS = [
  ['text', 'bg', AA_TEXT, 'body copy on the page'],
  ['text', 'surface', AA_TEXT, 'body copy on a card'],
  ['text', 'surface-raised', AA_TEXT, 'body copy on a raised panel'],
  ['text-muted', 'bg', AA_TEXT, 'secondary copy on the page'],
  ['text-muted', 'surface', AA_TEXT, 'secondary copy on a card'],
  ['text-muted', 'surface-raised', AA_TEXT, 'secondary copy on a raised panel'],
  ['accent', 'bg', AA_TEXT, 'interactive text on the page'],
  ['accent', 'surface', AA_TEXT, 'interactive text on a card'],
  ['accent-strong', 'bg', AA_TEXT, 'hovered interactive text'],
  ['danger', 'bg', AA_TEXT, 'error copy on the page'],
  ['danger', 'surface', AA_TEXT, 'error copy on a card'],
  ['success', 'bg', AA_TEXT, 'success copy on the page'],
  ['success', 'surface', AA_TEXT, 'success copy on a card'],
  ['bg', 'accent', AA_TEXT, 'label on a filled accent button'],
  ['focus', 'bg', AA_UI, 'focus ring against the page'],
  ['focus', 'surface', AA_UI, 'focus ring against a card'],
  ['focus', 'surface-raised', AA_UI, 'focus ring against a raised panel'],
  ['border-strong', 'bg', AA_UI, 'control boundary on the page'],
  ['border-strong', 'surface', AA_UI, 'control boundary on a card'],
  ['accent', 'surface-raised', AA_UI, 'accent as a UI mark on a raised panel'],
];

const tokens = readTokens(TOKENS);
const rows = [];
let failed = 0;

for (const [fg, bg, min, why] of PAIRINGS) {
  const fgHex = tokens.get(fg);
  const bgHex = tokens.get(bg);
  if (!fgHex || !bgHex) {
    rows.push({ ok: false, line: `MISSING  --${fg} on --${bg}  (token not declared)` });
    failed += 1;
    continue;
  }
  const r = ratio(fgHex, bgHex);
  const ok = r >= min;
  if (!ok) failed += 1;
  rows.push({
    ok,
    line: `${ok ? 'pass' : 'FAIL'}  ${`--${fg}`.padEnd(16)} on ${`--${bg}`.padEnd(16)} ` +
      `${r.toFixed(2).padStart(5)}:1  (needs ${min.toFixed(1)})  ${why}`,
  });
}

process.stdout.write(`${rows.map((r) => r.line).join('\n')}\n\n`);
process.stdout.write(
  failed === 0
    ? `CONTRAST PASSED — ${PAIRINGS.length} pairings meet WCAG 2.1 AA\n`
    : `CONTRAST FAILED — ${failed} of ${PAIRINGS.length} pairings below threshold\n`
);
process.exit(failed === 0 ? 0 : 1);
