#!/usr/bin/env node
/**
 * validate-content -- enforces app-data-schema.md against everything in
 * SEIMAcademy/content/. Each check is named after the schema section it implements, so a
 * failure points at a rule rather than a line number.
 *
 *   node SEIMAcademy/scripts/validate-content.mjs [--source=<path>] [--quiet]
 *
 * Exits non-zero on any failure. This is the local stand-in for the Phase 8 CI gate.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { REPO_ROOT, resolveSourceRepo, safeJoin } from './lib/sources.mjs';
import { TAG_RE, slug } from './lib/tags.mjs';
import { BODY_CAPS, PAYLOAD_CAP, UNSAFE_MARKUP_RE, eachString } from './lib/atoms.mjs';
import { EXECUTABLE_HINT_RE } from './lib/ps1-labels.mjs';
import { ALLOWED_KEYS, ALLOWED_PAYLOAD_KEYS } from './lib/contract.mjs';

const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet');

function flagValue(name, fallback) {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = hit.slice(name.length + 3).trim();
  if (value === '') throw new Error(`--${name}= requires a value`);
  return path.resolve(value);
}

// --out lets a sandbox build be validated by the same gate that covers the working tree.
const CONTENT_DIR = flagValue('out', path.join(REPO_ROOT, 'SEIMAcademy', 'content'));

/**
 * The ceiling is hardcoded here on purpose. Reading it from the artifact under test --
 * which is what build-manifest.json is -- means the check validates a number the build
 * chose, and a manifest option of 1e9 would disable the build error and this re-check at
 * the same time. The manifest may lower this, never raise it.
 */
const SRS_CARD_CEILING = 80;

/**
 * Command syntax that must not appear in ANY generated string, whatever its source.
 * Narrower than EXECUTABLE_HINT_RE, which is applied only to .ps1-derived strings: bare
 * `;` and `|` are ordinary punctuation in an Event ID description ("Connection failed;
 * bad username or password") and rejecting them would fail the build on real content.
 * Calibrated against all 3,948 generated strings: zero false positives.
 */
const COMMAND_SYNTAX_RE =
  /(^|\s)(New|Set|Add|Remove|Invoke|Start|Stop|Get|Enable|Disable|Import|Export)-[A-Z][A-Za-z]+|[$][({]|<%|\{\{|`\(/;

const ATOM_TYPES = new Set(Object.keys(BODY_CAPS));
const LIFECYCLE = new Set(['preparation', 'identification', 'containment', 'eradication', 'recovery', 'lessons-learned']);
const DIFFICULTY = new Set(['intro', 'standard', 'step-up']);
const SRS_REASONS = new Set(['evidence-set', 'not-in-evidence-set', 'duplicate-event']);
const TEACHES_TYPES = new Set(['reading', 'flashcard', 'instructions']);
const ISO_DATETIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const TIME_KEY = /(^|_)(at|timestamp|generated_on|built_at|date)$/i;

const failures = [];
const counts = new Map();

function check(name, condition, detail) {
  counts.set(name, (counts.get(name) ?? 0) + 1);
  if (!condition) failures.push({ name, detail });
}

const walkStrings = eachString;

/** Reject any key outside the closed set -- this is what stops a smuggled `reviewed`
 *  date or a numeric `seq` epoch from riding along unnoticed. */
function checkKeys(name, object, allowed, where) {
  for (const key of Object.keys(object ?? {})) {
    check('closed-schema', allowed.has(key), `${where}: unexpected ${name} field "${key}"`);
  }
}

function walkKeys(value, visit, keyPath = '') {
  if (Array.isArray(value)) return value.forEach((v, i) => walkKeys(v, visit, `${keyPath}[${i}]`));
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      visit(k, keyPath ? `${keyPath}.${k}` : k);
      walkKeys(v, visit, keyPath ? `${keyPath}.${k}` : k);
    }
  }
}

// ---------------------------------------------------------------------------------------

function loadContent() {
  const manifestPath = path.join(CONTENT_DIR, 'build-manifest.json');
  if (!existsSync(manifestPath)) {
    console.error('No build-manifest.json — run build-content.mjs first.');
    process.exit(2);
  }
  const buildManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const lessons = new Map();
  const exerciseSets = new Map();

  for (const dir of ['lessons', 'exercise-data']) {
    const abs = path.join(CONTENT_DIR, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs).filter((f) => f.endsWith('.json')).sort()) {
      const data = JSON.parse(readFileSync(path.join(abs, name), 'utf8'));
      const target = dir === 'lessons' ? lessons : exerciseSets;
      target.set(data.id, { file: `${dir}/${name}`, data });
      check('file-name-matches-id', `${data.id}.json` === name, `${dir}/${name} declares id ${data.id}`);
    }
  }
  return { buildManifest, lessons, exerciseSets };
}

function validateAtom(atom, lesson, index, ctx) {
  const where = `${lesson.id}[${index}] ${atom.id}`;

  checkKeys('atom', atom, ALLOWED_KEYS.atom, where);
  checkKeys('source', atom.source, ALLOWED_KEYS.source, where);
  if (atom.srs) checkKeys('srs', atom.srs, ALLOWED_KEYS.srs, where);
  const payloadKey = atom.payload?.format ? `${atom.type}:${atom.payload.format}` : atom.type;
  const allowedPayload = ALLOWED_PAYLOAD_KEYS[payloadKey];
  check('closed-schema', !!allowedPayload, `${where}: no payload contract for ${payloadKey}`);
  if (allowedPayload) checkKeys('payload', atom.payload, allowedPayload, where);
  for (const row of atom.payload?.rows ?? []) checkKeys('lookup-drill row', row, ALLOWED_KEYS.drillRow, where);

  const payloadBytes = JSON.stringify(atom.payload ?? {}).length;
  check('payload-cap', payloadBytes <= PAYLOAD_CAP, `${where}: payload ${payloadBytes} bytes > cap ${PAYLOAD_CAP}`);

  // Tier 1 -- applies to every string the app will render, whatever produced it.
  walkStrings({ title: atom.title, body: atom.body, payload: atom.payload }, (value, keyPath) => {
    check('markdown-subset', !UNSAFE_MARKUP_RE.test(value), `${where}: ${keyPath} contains renderable markup`);
    check('no-executable-content', !COMMAND_SYNTAX_RE.test(value), `${where}: ${keyPath} contains command syntax: ${value.slice(0, 60)}`);
  });

  check('schema-shape', typeof atom.id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(atom.id) && atom.id.length <= 120, `${where}: bad id`);
  check('schema-shape', ATOM_TYPES.has(atom.type), `${where}: unknown type ${atom.type}`);
  check('schema-shape', typeof atom.title === 'string' && atom.title.length > 0 && atom.title.length <= 80, `${where}: title length ${atom.title?.length}`);
  check('schema-shape', typeof atom.body === 'string', `${where}: body must be a string`);
  check('schema-shape', Number.isInteger(atom.estimated_seconds) && atom.estimated_seconds >= 5 && atom.estimated_seconds <= 180, `${where}: estimated_seconds ${atom.estimated_seconds}`);
  check('schema-shape', typeof atom.graded === 'boolean', `${where}: graded must be boolean`);
  check('schema-shape', atom.payload && typeof atom.payload === 'object' && !Array.isArray(atom.payload), `${where}: payload must be an object`);

  check('atom-body-cap', (atom.body ?? '').length <= (BODY_CAPS[atom.type] ?? 0), `${where}: body ${atom.body?.length} > cap ${BODY_CAPS[atom.type]}`);

  for (const tag of [...(atom.teaches ?? []), ...(atom.requires ?? [])]) {
    check('tag-grammar', TAG_RE.test(tag), `${where}: tag "${tag}" violates the tag grammar`);
  }
  const wantsTeaches = TEACHES_TYPES.has(atom.type);
  check('schema-shape', wantsTeaches ? Array.isArray(atom.teaches) && atom.teaches.length > 0 : atom.teaches === undefined, `${where}: teaches presence wrong for ${atom.type}`);
  if (atom.type === 'exercise') {
    check('schema-shape', Array.isArray(atom.requires) && atom.requires.length > 0, `${where}: exercise needs requires`);
    check('schema-shape', DIFFICULTY.has(atom.difficulty), `${where}: exercise needs a valid difficulty`);
  } else {
    check('schema-shape', atom.difficulty === undefined || DIFFICULTY.has(atom.difficulty), `${where}: bad difficulty`);
  }
  if (atom.lifecycle_stage !== undefined) {
    check('schema-shape', LIFECYCLE.has(atom.lifecycle_stage), `${where}: bad lifecycle_stage`);
    const mirrored = `lifecycle:${atom.lifecycle_stage}`;
    const bucket = wantsTeaches ? atom.teaches : atom.requires;
    check('lifecycle-tag-mirrored', (bucket ?? []).includes(mirrored), `${where}: lifecycle_stage not mirrored as ${mirrored}`);
  }

  if (atom.type === 'predict') {
    check('predict-never-graded', atom.graded === false, `${where}: predict must not be graded`);
    check('predict-never-graded', atom.requires === undefined, `${where}: predict must not declare requires`);
  }

  if (atom.type === 'flashcard') {
    check('schema-shape', !!atom.srs, `${where}: flashcard needs srs`);
    if (atom.srs) {
      check('schema-shape', typeof atom.srs.eligible === 'boolean' && typeof atom.srs.deck === 'string' && atom.srs.deck.length > 0, `${where}: bad srs shape`);
      check('srs-anti-flood', SRS_REASONS.has(atom.srs.reason), `${where}: srs.reason "${atom.srs.reason}" not one of ${[...SRS_REASONS].join('|')}`);
      check('srs-anti-flood', !(atom.srs.eligible && atom.srs.reason !== 'evidence-set'), `${where}: eligible card with reason ${atom.srs.reason}`);
      if (atom.srs.eligible) ctx.eligible.push(atom.id);
    }
    check('schema-shape', typeof atom.payload.front === 'string' && typeof atom.payload.back === 'string' && atom.payload.back.length > 0, `${where}: flashcard payload needs front and back`);
  } else {
    check('schema-shape', atom.srs === undefined, `${where}: srs forbidden on ${atom.type}`);
  }

  if (atom.type === 'quiz') {
    const p = atom.payload;
    if (p.format === 'multiple-choice') {
      check('quiz-integrity', Array.isArray(p.choices) && p.choices.length >= 3 && p.choices.length <= 6, `${where}: ${p.choices?.length} choices`);
      check('quiz-integrity', new Set(p.choices).size === (p.choices ?? []).length, `${where}: duplicate choices`);
      check('quiz-integrity', Number.isInteger(p.answer_index) && p.answer_index >= 0 && p.answer_index < (p.choices ?? []).length, `${where}: answer_index out of range`);
      check('quiz-integrity', typeof p.rationale === 'string' && p.rationale.length > 0, `${where}: quiz needs a rationale`);
    } else if (p.format === 'fill-blank') {
      check('quiz-integrity', typeof p.blank_answer === 'string' && p.blank_answer.length > 0, `${where}: fill-blank needs blank_answer`);
    } else {
      check('quiz-integrity', false, `${where}: unknown quiz format ${p.format}`);
    }
  }

  if (atom.type === 'instructions') {
    const p = atom.payload;
    for (const key of ['goal', 'what_youll_use', 'done_when']) {
      check('instructions-anatomy', typeof p[key] === 'string' && p[key].trim().length > 0, `${where}: instructions missing ${key}`);
    }
  }

  if (atom.type === 'exercise') {
    const p = atom.payload;
    if (p.format === 'match') {
      check('exercise-integrity', Array.isArray(p.pairs) && p.pairs.length >= 2, `${where}: match needs 2+ pairs`);
      check('exercise-integrity', new Set((p.pairs ?? []).map((x) => x.left)).size === (p.pairs ?? []).length, `${where}: duplicate match keys`);
    } else if (p.format === 'drag-classify') {
      check('exercise-integrity', Array.isArray(p.buckets) && p.buckets.length >= 2, `${where}: drag-classify needs 2+ buckets`);
      check('exercise-integrity', (p.items ?? []).every((i) => p.buckets.includes(i.bucket)), `${where}: item references a bucket that does not exist`);
    } else if (p.format === 'lookup-drill') {
      check('exercise-integrity', Array.isArray(p.rows) && p.rows.length > 0, `${where}: lookup-drill needs rows`);
      check('exercise-integrity', Array.isArray(p.prompts) && p.prompts.length > 0, `${where}: lookup-drill needs prompts`);
    } else {
      check('exercise-integrity', false, `${where}: unknown exercise format ${p.format}`);
    }
  }

  // 6.7 source-required
  const src = atom.source;
  check('source-required', !!src && typeof src.path === 'string' && src.path.length > 0, `${where}: no source.path`);
  if (src?.path) {
    check('source-required', !src.path.includes('..') && !path.isAbsolute(src.path), `${where}: unsafe source path ${src.path}`);
    if (ctx.sourceRoot) {
      let exists = false;
      try { exists = existsSync(safeJoin(ctx.sourceRoot, src.path)); } catch { exists = false; }
      check('source-resolves', exists, `${where}: ${src.path} does not exist in the source repo`);
    }
  }

  // 6.10 tier 2 -- lab-derived strings get the strict rule, the same one the extractor
  // applies. Title and body are included: previously only payload was scanned.
  if (src?.path?.endsWith('.ps1')) {
    walkStrings({ title: atom.title, body: atom.body, payload: atom.payload }, (value, keyPath) => {
      check('no-executable-content', !EXECUTABLE_HINT_RE.test(value), `${where}: ${keyPath} looks executable: ${value.slice(0, 60)}`);
    });
  }
}

function validateLesson(entry, ctx) {
  const lesson = entry.data;
  checkKeys('lesson', lesson, ALLOWED_KEYS.lesson, lesson.id);
  checkKeys('generated', lesson.generated, ALLOWED_KEYS.generated, lesson.id);
  for (const src of lesson.sources ?? []) checkKeys('source', src, ALLOWED_KEYS.source, lesson.id);
  check('schema-shape', lesson.schema_version === '1.0.0', `${lesson.id}: schema_version ${lesson.schema_version}`);
  check('schema-shape', /^t[12]-m[0-9]{2}[a-z]?-[a-z0-9-]+$/.test(lesson.id), `${lesson.id}: id does not match the lesson id grammar`);
  check('schema-shape', lesson.tier === 1 || lesson.tier === 2, `${lesson.id}: bad tier`);
  check('schema-shape', typeof lesson.summary === 'string' && lesson.summary.length > 0 && lesson.summary.length <= 240, `${lesson.id}: summary length`);
  check('schema-shape', Array.isArray(lesson.atoms) && lesson.atoms.length >= 1 && lesson.atoms.length <= 24, `${lesson.id}: ${lesson.atoms?.length} atoms (1-24)`);
  check('schema-shape', Array.isArray(lesson.sources) && lesson.sources.length >= 1, `${lesson.id}: no sources`);

  const summed = lesson.atoms.reduce((n, a) => n + (a.estimated_seconds ?? 0), 0);
  check('lesson-time-budget', lesson.estimated_seconds === summed, `${lesson.id}: declares ${lesson.estimated_seconds}s, atoms sum to ${summed}s`);
  check('lesson-time-budget', summed >= 180 && summed <= 420, `${lesson.id}: ${summed}s outside 180-420s`);

  lesson.atoms.forEach((atom, i) => {
    check('deterministic-ids', !ctx.atomIds.has(atom.id), `${lesson.id}: duplicate atom id ${atom.id}`);
    ctx.atomIds.add(atom.id);
    validateAtom(atom, lesson, i, ctx);
    if (atom.type === 'exercise') {
      const prev = lesson.atoms[i - 1];
      check('instructions-precede-exercise', prev?.type === 'instructions', `${lesson.id}[${i}] ${atom.id}: preceded by ${prev?.type ?? 'nothing'}`);
      if (atom.difficulty === 'step-up') {
        check('instructions-precede-exercise', !!prev?.payload?.step_up_notice, `${lesson.id}[${i}]: step-up exercise without a step_up_notice`);
      }
    }
  });

  // 6.9 no-timestamps
  walkKeys(lesson, (key, keyPath) => {
    check('no-timestamps', !TIME_KEY.test(key), `${lesson.id}: time-varying key at ${keyPath}`);
  });
  walkStrings(lesson, (value, keyPath) => {
    check('no-timestamps', !ISO_DATETIME.test(value), `${lesson.id}: ISO datetime at ${keyPath}`);
  });
}

function validateExerciseSet(entry, ctx) {
  const set = entry.data;
  checkKeys('exercise set', set, ALLOWED_KEYS.exerciseSet, set.id);
  checkKeys('generated', set.generated, ALLOWED_KEYS.generated, set.id);
  for (const pair of set.pairs ?? []) {
    checkKeys('pair', pair, ALLOWED_KEYS.pair, `${set.id} "${pair.action}"`);
    checkKeys('source', pair.source, ALLOWED_KEYS.source, `${set.id} "${pair.action}"`);
  }
  check('schema-shape', set.schema_version === '1.0.0', `${set.id}: schema_version`);
  check('schema-shape', set.kind === 'action-event-pairs', `${set.id}: unknown kind ${set.kind}`);
  check('parse-only-asserted', set.parse_only === true, `${set.id}: parse_only must be literal true`);
  check('schema-shape', Array.isArray(set.pairs), `${set.id}: pairs must be an array`);

  for (const pair of set.pairs ?? []) {
    const where = `${set.id} "${pair.action}"`;
    check('schema-shape', typeof pair.action === 'string' && pair.action.length > 0 && pair.action.length <= 160, `${where}: action length`);
    check('schema-shape', Array.isArray(pair.event_ids) && pair.event_ids.length > 0 && pair.event_ids.every(Number.isInteger), `${where}: event_ids`);
    check('schema-shape', pair.scope === undefined || pair.scope === 'dc' || pair.scope === 'target-system', `${where}: bad scope`);
    check('source-required', pair.source?.path?.endsWith('.ps1'), `${where}: pair source must be the generator file`);
    check('no-executable-content', !EXECUTABLE_HINT_RE.test(pair.action), `${where}: action looks executable`);
    if (ctx.sourceRoot && pair.source?.path) {
      let exists = false;
      try { exists = existsSync(safeJoin(ctx.sourceRoot, pair.source.path)); } catch { exists = false; }
      check('source-resolves', exists, `${where}: ${pair.source.path} missing from the source repo`);
    }
  }
  walkStrings(set, (value, keyPath) => {
    check('no-timestamps', !ISO_DATETIME.test(value), `${set.id}: ISO datetime at ${keyPath}`);
  });
}

/** 6.6 requires-subset-of-teaches, walked in the manifest's declared play order. */
function validatePrerequisites(buildManifest, lessons) {
  const taught = new Set();
  for (const module of buildManifest.modules) {
    for (const lessonId of module.lesson_order) {
      const entry = lessons.get(lessonId);
      check('manifest-coverage', !!entry, `${module.id}: lesson_order names ${lessonId}, which has no file`);
      if (!entry) continue;
      for (const atom of entry.data.atoms) {
        for (const tag of atom.requires ?? []) {
          check('requires-subset-of-teaches', taught.has(tag), `${lessonId} / ${atom.id} requires "${tag}", not taught by any preceding atom`);
        }
        for (const tag of atom.teaches ?? []) taught.add(tag);
      }
    }
  }
  const ordered = new Set(buildManifest.modules.flatMap((m) => m.lesson_order));
  for (const id of lessons.keys()) {
    check('manifest-coverage', ordered.has(id), `lesson ${id} exists but is in no module's lesson_order`);
  }
}

function validateSrsBudget(buildManifest, ctx) {
  for (const module of buildManifest.modules) {
    const declared = module.stats?.srs_card_budget ?? SRS_CARD_CEILING;
    const budget = Math.min(declared, SRS_CARD_CEILING);
    check('srs-anti-flood', Number.isInteger(declared) && declared >= 1 && declared <= SRS_CARD_CEILING,
      `${module.id}: declared srs_card_budget ${declared} is outside 1..${SRS_CARD_CEILING}`);
    check('srs-anti-flood', (module.stats?.srs_eligible_cards ?? 0) <= budget,
      `${module.id}: ${module.stats?.srs_eligible_cards} eligible cards over budget ${budget}`);
  }
  check('srs-anti-flood', ctx.eligible.length === new Set(ctx.eligible).size, 'duplicate SRS-eligible card ids');
}

/**
 * 6.5 truthfulness -- the eligibility claim is re-derived from the lab evidence, not
 * taken from the file. Checking `eligible` against `reason` only proves the record is
 * internally consistent; a fabricated `reason: "evidence-set"` sails straight through.
 * This rebuilds the evidence set from exercise-data and re-runs the same matching rule
 * the builder uses.
 */
function validateSrsEvidence(lessons, exerciseSets) {
  const evidence = new Map();
  for (const entry of exerciseSets.values()) {
    for (const pair of entry.data.pairs ?? []) {
      for (const id of pair.event_ids) {
        const key = String(id);
        if (!evidence.has(key)) evidence.set(key, new Set());
        evidence.get(key).add(slug(pair.channel));
      }
    }
  }
  const matchEvidence = (headingSlug, eventId) => {
    const channels = evidence.get(String(eventId));
    if (!channels) return null;
    for (const c of [...channels].sort()) {
      if (headingSlug === c || headingSlug.startsWith(`${c}-`)) return c;
    }
    return null;
  };

  const eligibleByKey = new Map();
  for (const entry of lessons.values()) {
    for (const atom of entry.data.atoms) {
      if (atom.type !== 'flashcard' || !atom.srs) continue;
      const tag = (atom.teaches ?? []).find((t) => t.startsWith('event:'));
      if (!tag) {
        check('srs-evidence', false, `${atom.id}: flashcard has no event: tag to verify eligibility against`);
        continue;
      }
      const m = tag.match(/^event:(.+):([0-9]+)$/);
      if (!m) { check('srs-evidence', false, `${atom.id}: malformed event tag ${tag}`); continue; }
      const matched = matchEvidence(m[1], m[2]);

      if (atom.srs.eligible) {
        check('srs-evidence', !!matched, `${atom.id}: marked eligible but ${tag} has no lab ground-truth pair`);
        check('srs-evidence', atom.srs.reason === 'evidence-set', `${atom.id}: eligible with reason ${atom.srs.reason}`);
        if (matched) {
          const key = `${matched}:${m[2]}`;
          check('srs-evidence', !eligibleByKey.has(key), `${atom.id}: second eligible card for evidence key ${key} (first was ${eligibleByKey.get(key)})`);
          eligibleByKey.set(key, atom.id);
        }
      } else if (atom.srs.reason === 'not-in-evidence-set') {
        check('srs-evidence', !matched, `${atom.id}: claims no evidence but ${tag} does have a lab pair`);
      } else if (atom.srs.reason === 'duplicate-event') {
        check('srs-evidence', !!matched, `${atom.id}: claims duplicate-event but ${tag} has no lab pair at all`);
      }
    }
  }
}

function validateManifestIntegrity(buildManifest, lessons, exerciseSets) {
  for (const [id, meta] of Object.entries(buildManifest.artifacts ?? {})) {
    const entry = lessons.get(id) ?? exerciseSets.get(id);
    check('manifest-coverage', !!entry, `build-manifest lists ${id}, which has no file`);
    if (entry) {
      check('manifest-coverage', entry.data.generated?.content_hash === meta.content_hash, `${id}: content_hash disagrees with build-manifest`);
      check('manifest-coverage', Array.isArray(meta.depends_on) && meta.depends_on.length > 0, `${id}: no depends_on recorded`);
    }
  }
  for (const dep of Object.keys(buildManifest.sources ?? {})) {
    check('manifest-coverage', /^[0-9a-f]{64}$/.test(buildManifest.sources[dep]), `source hash for ${dep} is not a sha256`);
  }
}

// ---------------------------------------------------------------------------------------

function main() {
  let sourceRoot = null;
  try { sourceRoot = resolveSourceRepo(argv); } catch { /* source-resolves checks skipped */ }

  const { buildManifest, lessons, exerciseSets } = loadContent();
  const ctx = { sourceRoot, atomIds: new Set(), eligible: [] };

  for (const entry of lessons.values()) validateLesson(entry, ctx);
  for (const entry of exerciseSets.values()) validateExerciseSet(entry, ctx);
  validatePrerequisites(buildManifest, lessons);
  validateSrsBudget(buildManifest, ctx);
  validateSrsEvidence(lessons, exerciseSets);
  validateManifestIntegrity(buildManifest, lessons, exerciseSets);

  const byCheck = new Map();
  for (const f of failures) byCheck.set(f.name, [...(byCheck.get(f.name) ?? []), f.detail]);

  const lines = [];
  lines.push(`lessons: ${lessons.size}   exercise sets: ${exerciseSets.size}   atoms: ${ctx.atomIds.size}   SRS-eligible: ${ctx.eligible.length}`);
  lines.push(`assertions run: ${[...counts.values()].reduce((a, b) => a + b, 0)} across ${counts.size} named checks`);
  lines.push('');
  for (const name of [...counts.keys()].sort()) {
    const bad = byCheck.get(name) ?? [];
    lines.push(`${bad.length ? 'FAIL' : 'pass'}  ${name.padEnd(30)} ${counts.get(name)} assertions${bad.length ? `, ${bad.length} failed` : ''}`);
    if (bad.length && !QUIET) bad.slice(0, 8).forEach((d) => lines.push(`        - ${d}`));
    if (bad.length > 8 && !QUIET) lines.push(`        … and ${bad.length - 8} more`);
  }
  lines.push('');
  lines.push(failures.length === 0 ? 'VALIDATION PASSED' : `VALIDATION FAILED — ${failures.length} failing assertions`);
  process.stdout.write(`${lines.join('\n')}\n`);
  if (failures.length) process.exitCode = 1;
}

main();
