/**
 * Atom constructors. Every structural rule in app-data-schema.md section 6 that can be
 * enforced at construction time is enforced here, so an over-cap body or a missing
 * `teaches` fails the build at the point it is produced rather than in validation.
 */
import { createHash } from 'node:crypto';
import { normalizeTags } from './tags.mjs';

export const SCHEMA_VERSION = '1.0.0';
export const GENERATOR_VERSION = '1.0.0';

/** section 6.2 atom-body-cap */
export const BODY_CAPS = {
  predict: 400,
  reading: 900,
  flashcard: 300,
  quiz: 500,
  instructions: 600,
  exercise: 500,
  scenario: 900,
  'capstone-step': 900,
};

/** Default effort per atom type, in seconds. Used to keep lessons inside 180-420s. */
export const SECONDS = {
  predict: 30,
  reading: 45,
  flashcard: 15,
  quiz: 35,
  instructions: 30,
  exercise: 60,
  scenario: 90,
  'capstone-step': 90,
};

const TEACHES_TYPES = new Set(['reading', 'flashcard', 'instructions']);
const MAX_ID_LENGTH = 120;

/** section 6.2 -- payload has its own ceiling; the lookup-drill payload embeds a table. */
export const PAYLOAD_CAP = 64 * 1024;

/**
 * section 7 -- markup that must never reach a renderer.
 *
 * Deliberately a targeted denylist, not a blanket ban on "<". The source corpus contains
 * legitimate placeholder brackets -- "Session <X> has been disconnected by session <Y>",
 * "<SessionEnv>" -- and rejecting those would fail the build on real, harmless content.
 * What is rejected is what actually executes or navigates: real HTML tags, inline event
 * handlers, script-bearing URI schemes, and numeric entity encoding used to smuggle them.
 *
 * This is a defence in depth, not the primary control. The primary control is the Phase 2
 * renderer, which MUST disable raw HTML -- see app-data-schema.md section 7.
 */
export const UNSAFE_MARKUP_RE = new RegExp(
  [
    '<\\s*/?\\s*(script|iframe|object|embed|svg|img|link|meta|style|form|input|button|base|body|html|a)\\b',
    '\\bon[a-z]{2,}\\s*=',
    '(javascript|vbscript|data)\\s*:\\s*[^\\s]',
    '&#x?[0-9a-f]+;?',
  ].join('|'),
  'i'
);

/** Walk every string in a value, yielding [value, keyPath]. */
export function eachString(value, visit, keyPath = '') {
  if (typeof value === 'string') return visit(value, keyPath);
  if (Array.isArray(value)) return value.forEach((v, i) => eachString(v, visit, `${keyPath}[${i}]`));
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) eachString(v, visit, keyPath ? `${keyPath}.${k}` : k);
  }
}

/**
 * section 6.8 deterministic-ids -- an id is a function of source coordinates only.
 * Over-long ids are shortened by truncating the descriptive middle and appending a
 * hash of the *full* coordinate, so the result stays unique and stays stable when a
 * neighbouring row is inserted.
 */
export function deterministicId(...parts) {
  const raw = parts.filter((p) => p !== undefined && p !== null && p !== '').join('-');
  const id = raw.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  if (id.length <= MAX_ID_LENGTH) return id;
  const digest = createHash('sha256').update(id).digest('hex').slice(0, 8);
  return `${id.slice(0, MAX_ID_LENGTH - 9).replace(/-+$/, '')}-${digest}`;
}

export function truncateTitle(title, max = 80) {
  const t = String(title).replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Build an atom, enforcing the per-type caps and the conditional field rules.
 * Key order is fixed so JSON.stringify output is byte-stable.
 */
export function makeAtom(spec) {
  const { id, type, title, body = '', source, teaches, requires, seconds, difficulty, lifecycleStage, graded, srs, payload } = spec;

  if (!BODY_CAPS[type]) throw new Error(`Unknown atom type: ${type}`);
  const cleanBody = String(body).replace(/[ \t]+\n/g, '\n').trim();
  if (cleanBody.length > BODY_CAPS[type]) {
    throw new Error(
      `atom-body-cap: ${id} (${type}) body is ${cleanBody.length} chars, cap is ${BODY_CAPS[type]}`
    );
  }
  if (!source || !source.path) throw new Error(`source-required: ${id} has no source.path`);

  const payloadJson = JSON.stringify(payload ?? {});
  if (payloadJson.length > PAYLOAD_CAP) {
    throw new Error(`payload-cap: ${id} payload is ${payloadJson.length} bytes, cap is ${PAYLOAD_CAP}`);
  }
  for (const [value, keyPath] of [[cleanBody, 'body'], [String(title), 'title']]) {
    if (UNSAFE_MARKUP_RE.test(value)) {
      throw new Error(`markdown-subset: ${id} ${keyPath} contains markup that must not reach a renderer`);
    }
  }
  eachString(payload ?? {}, (value, keyPath) => {
    if (UNSAFE_MARKUP_RE.test(value)) {
      throw new Error(`markdown-subset: ${id} payload.${keyPath} contains markup that must not reach a renderer`);
    }
  });

  const wantsTeaches = TEACHES_TYPES.has(type);
  if (wantsTeaches && (!teaches || teaches.length === 0)) {
    throw new Error(`${type} atom ${id} must declare at least one teaches tag`);
  }
  if (!wantsTeaches && teaches && teaches.length) {
    throw new Error(`teaches is forbidden on ${type} atoms (${id})`);
  }
  if (type === 'exercise') {
    if (!requires || requires.length === 0) throw new Error(`exercise atom ${id} must declare requires`);
    if (!difficulty) throw new Error(`exercise atom ${id} must declare difficulty`);
  }
  if (type === 'predict' && requires && requires.length) {
    throw new Error(`predict-never-graded: ${id} must not declare requires`);
  }
  if (type === 'flashcard' && !srs) throw new Error(`flashcard atom ${id} must declare srs`);
  if (type !== 'flashcard' && srs) throw new Error(`srs is forbidden on ${type} atoms (${id})`);

  const atom = {
    id,
    type,
    title: truncateTitle(title),
    body: cleanBody,
    source: normalizeSource(source),
    estimated_seconds: seconds ?? SECONDS[type],
    graded: graded ?? (type === 'quiz' || type === 'exercise' || type === 'scenario' || type === 'capstone-step'),
    payload: payload ?? {},
  };
  if (wantsTeaches) atom.teaches = normalizeTags(teaches);
  if (requires && requires.length) atom.requires = normalizeTags(requires);
  if (difficulty) atom.difficulty = difficulty;
  if (lifecycleStage) atom.lifecycle_stage = lifecycleStage;
  if (srs) atom.srs = srs;

  // Re-order keys to the schema's documented order for stable diffs.
  const ORDER = ['id', 'type', 'title', 'body', 'source', 'teaches', 'requires', 'estimated_seconds', 'difficulty', 'lifecycle_stage', 'graded', 'srs', 'payload'];
  const ordered = {};
  for (const k of ORDER) if (k in atom) ordered[k] = atom[k];
  return ordered;
}

function normalizeSource(source) {
  const out = { path: source.path };
  if (source.heading) out.heading = source.heading;
  // Absolute line numbers are recorded ONLY where there is no better coordinate.
  //
  // A Markdown table row is addressed by path + heading + its Event ID, all of which are
  // stable when an unrelated row is inserted above it. Storing an absolute line instead
  // makes every downstream lesson's bytes change on any line-count-changing edit -- one
  // added row rewrote 22 of 65 artifacts -- which defeats scoped regeneration (6.9) for
  // every realistic authoring edit.
  //
  // PowerShell comments have no heading to anchor to, and their line is the audit trail
  // for Decision B ground truth, so they keep it. Editing a Lab file already regenerates
  // broadly by design, since those files decide SRS eligibility.
  if (source.lines && source.path.endsWith('.ps1')) out.lines = [source.lines[0], source.lines[1]];
  return out;
}

export function dedupeSources(sources) {
  const seen = new Map();
  for (const s of sources) {
    const key = `${s.path}#${s.heading ?? ''}`;
    if (!seen.has(key)) seen.set(key, { path: s.path, ...(s.heading ? { heading: s.heading } : {}) });
  }
  return [...seen.values()].sort((a, b) =>
    `${a.path}#${a.heading ?? ''}`.localeCompare(`${b.path}#${b.heading ?? ''}`)
  );
}

export function contentHash(atoms) {
  return createHash('sha256').update(JSON.stringify(atoms)).digest('hex');
}
