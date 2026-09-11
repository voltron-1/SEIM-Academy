#!/usr/bin/env node
/**
 * build-content -- SEIM-Academy content pipeline.
 *
 * Parses the source knowledge base (TonyPhipps/SIEM, GPL-3.0) into normalized lesson
 * atoms under SEIMAcademy/content/. Governed by SEIMAcademy/app-data-schema.md; every
 * rule reference below (section 6.x) points at that document.
 *
 *   node SEIMAcademy/scripts/build-content.mjs [--source=<path>] [--dry-run] [--verbose]
 *
 * PARSE-ONLY (app-data-schema.md section 0 / Decision B): this pipeline reads the Lab
 * PowerShell generators as text and never executes them. Nothing in this file or in
 * scripts/lib/ imports child_process, vm, or any other execution primitive.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REPO_ROOT, resolveSourceRepo, checkPinnedCommit, sha256, assertInside } from './lib/sources.mjs';
import { SCHEMA_VERSION, GENERATOR_VERSION } from './lib/atoms.mjs';
import { PROFILES } from './lib/profiles/index.mjs';

const DEFAULT_CONTENT_DIR = path.join(REPO_ROOT, 'SEIMAcademy', 'content');

const LESSON_MIN_SECONDS = 180;
const LESSON_MAX_SECONDS = 420;
const CARDS_PER_LESSON = 12;
const DRILL_PROMPTS = 12;
const CLASSIFY_ITEMS = 8;
const PAIR_ITEMS = 6;

/**
 * Hash of the pipeline itself. The scoped-regeneration check needs to tell "the source
 * changed" apart from "the generator changed": without this, editing build-content.mjs
 * makes every lesson look non-deterministic. Trusting a human to bump generator_version
 * would work right up until someone forgets.
 */
function generatorHash() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const files = [path.join(here, 'build-content.mjs')];
  const walk = (dir, prefix) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, `${prefix}${entry.name}/`);
      else if (entry.name.endsWith('.mjs')) files.push([`${prefix}${entry.name}`, full]);
    }
  };
  walk(path.join(here, 'lib'), '');
  const parts = files.map((f) =>
    Array.isArray(f) ? `${f[0]}:${sha256(readFileSync(f[1], 'utf8'))}` : `${path.basename(f)}:${sha256(readFileSync(f, 'utf8'))}`
  );
  return sha256(parts.join('\n'));
}

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const VERBOSE = argv.includes('--verbose');
const PRUNE = argv.includes('--prune');

function flagValue(name, fallback) {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const value = hit.slice(name.length + 3).trim();
  // path.resolve('') silently returns the cwd -- with --prune that deletes $PWD/lessons.
  if (value === '') throw new Error(`--${name}= requires a value`);
  return path.resolve(value);
}

// --out lets the test harness build into a sandbox instead of the working tree.
const CONTENT_DIR = flagValue('out', DEFAULT_CONTENT_DIR);
const MODULE_MANIFEST = flagValue('manifest', path.join(DEFAULT_CONTENT_DIR, 'module-manifest.json'));
const LESSON_DIR = path.join(CONTENT_DIR, 'lessons');
const EXERCISE_DIR = path.join(CONTENT_DIR, 'exercise-data');
const BUILD_MANIFEST = path.join(CONTENT_DIR, 'build-manifest.json');

// ---------------------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------------------

const MODULE_ID_RE = /^t[12]-m[0-9]{2}[a-z]?$/;
const CORPUS_RE = /^[a-z0-9][a-z0-9-]*$/;
// Profiles declare their own accepted data profiles and option ranges, so adding one is
// a new file under lib/profiles/ plus a line in its index -- not an edit to this file.

/**
 * module-manifest.json is the only hand-maintained content file, and its values reach
 * output filenames and safety budgets. Validate it before any of it is used: an unchecked
 * module id becomes a write path, and an unchecked srs_card_budget disables 6.5.
 */
function validateModuleManifest(manifest) {
  const fail = (msg) => { throw new Error(`module-manifest.json: ${msg}`); };
  if (manifest.schema_version !== SCHEMA_VERSION) fail(`schema_version must be ${SCHEMA_VERSION}`);
  if (!Array.isArray(manifest.modules) || manifest.modules.length === 0) fail('modules must be a non-empty array');

  const seen = new Set();
  let previous = null;
  for (const m of manifest.modules) {
    if (!MODULE_ID_RE.test(String(m.id ?? ''))) fail(`module id ${JSON.stringify(m.id)} must match ${MODULE_ID_RE}`);
    if (seen.has(m.id)) fail(`duplicate module id ${m.id}`);
    seen.add(m.id);
    if (m.tier !== 1 && m.tier !== 2) fail(`${m.id}: tier must be 1 or 2`);
    if (!/^[0-9]+[a-z]?$/.test(String(m.module ?? ''))) fail(`${m.id}: module must look like "3" or "5a"`);
    const profile = PROFILES.get(m.profile);
    if (!profile) fail(`${m.id}: unknown profile ${JSON.stringify(m.profile)} (known: ${[...PROFILES.keys()].join(', ')})`);
    if (!Array.isArray(m.sources) || m.sources.length === 0) fail(`${m.id}: sources must be a non-empty array`);
    for (const src of m.sources) {
      if (typeof src.path !== 'string' || src.path === '') fail(`${m.id}: source path must be a non-empty string`);
      if (!CORPUS_RE.test(String(src.corpus ?? ''))) fail(`${m.id}: corpus ${JSON.stringify(src.corpus)} must match ${CORPUS_RE}`);
    }
    for (const ex of m.exercise_data ?? []) {
      if (typeof ex.path !== 'string' || ex.path === '') fail(`${m.id}: exercise_data path must be a non-empty string`);
      // Declared but previously unread -- a second profile would have silently done nothing.
      if (!profile.dataProfiles.has(ex.profile)) fail(`${m.id}: unknown exercise_data profile ${JSON.stringify(ex.profile)} for ${m.profile}`);
    }
    for (const c of m.confirmed_cells ?? []) {
      for (const key of ['path', 'heading', 'cell', 'note']) {
        if (typeof c[key] !== 'string' || c[key] === '') fail(`${m.id}: confirmed_cells entry needs a non-empty ${key}`);
      }
      if (!Array.isArray(c.event_ids) || c.event_ids.length === 0 || !c.event_ids.every(Number.isInteger)) {
        fail(`${m.id}: confirmed_cells entry for "${c.cell}" needs an integer event_ids array`);
      }
    }
    for (const [key, value] of Object.entries(m.options ?? {})) {
      const range = profile.optionRanges[key];
      if (!range) fail(`${m.id}: unknown option ${key}`);
      if (!Number.isInteger(value) || value < range[0] || value > range[1]) {
        fail(`${m.id}: option ${key} must be an integer in ${range[0]}..${range[1]}, got ${JSON.stringify(value)}`);
      }
    }
    // 6.6 accumulates `teaches` in manifest order and calls it play order, so the array
    // must actually be in play order or the prerequisite gate enforces a fiction.
    const rank = [m.tier, Number.parseInt(m.module, 10), m.module];
    if (previous && (rank[0] < previous[0] || (rank[0] === previous[0] && rank[1] < previous[1]))) {
      fail(`modules must be listed in play order; ${m.id} follows a later module`);
    }
    previous = rank;
  }
}

function main() {
  const sourceRoot = resolveSourceRepo(argv);
  const manifest = JSON.parse(readFileSync(MODULE_MANIFEST, 'utf8'));
  validateModuleManifest(manifest);
  const commit = checkPinnedCommit(sourceRoot, manifest.source_commit);

  const report = {
    sourceRoot,
    commit,
    warnings: [],
    notes: [],
    files: [],
    sourceHashes: {},
    modules: [],
    generatorHash: generatorHash(),
  };

  for (const module of manifest.modules) {
    const profile = PROFILES.get(module.profile);
    const ctx = {
      module,
      manifest,
      sourceRoot,
      provenanceBase: {
        generator: 'build-content',
        generator_version: GENERATOR_VERSION,
        source_repo: manifest.source_repo,
        source_commit: commitForProvenance(manifest, report),
        source_license: manifest.source_license,
        profile: module.profile,
      },
      note: (msg) => report.notes.push(msg),
      warn: (msg) => report.warnings.push(msg),
      recordSource: (relPath, hash) => { report.sourceHashes[relPath] = hash; },
    };

    const { lessons, exerciseSets, dependsOn, moduleReport } = profile.build(ctx);
    const emit = (kind, dir, items) => {
      for (const data of items) {
        const file = path.join(dir, `${data.id}.json`);
        report.files.push({
          kind,
          id: data.id,
          file,
          absolute: path.join(CONTENT_DIR, file),
          data,
          contentHash: data.generated.content_hash,
          dependsOn: dependsOn.get(data.id) ?? [],
        });
      }
    };
    emit('exercise-data', 'exercise-data', exerciseSets);
    emit('lesson', 'lessons', lessons);
    report.modules.push(moduleReport);
  }

  const previous = existsSync(BUILD_MANIFEST) ? JSON.parse(readFileSync(BUILD_MANIFEST, 'utf8')) : null;
  const scoping = writeOutputs(report, previous, manifest);
  printReport(report, scoping);
}

function commitForProvenance(manifest, report) {
  const c = report.commit;
  if (c.matches === false) {
    report.warnings.push(
      `Source tree HEAD is ${c.head.slice(0, 7)} but module-manifest.json pins ${manifest.source_commit}. ` +
        `Provenance records the commit actually built from.`
    );
  }
  return c.provenanceCommit;
}

// ---------------------------------------------------------------------------------------
// output
// ---------------------------------------------------------------------------------------

function serialize(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function writeOutputs(report, previous, manifest) {
  const scoping = { written: [], unchanged: [], depsChanged: [], nondeterministic: [] };

  const writtenPaths = new Set();
  for (const file of report.files) {
    // slug() collapses punctuation, so two source headings can produce one artifact path.
    // Without this the second write silently replaces the first and validation still
    // passes, because the surviving file is internally consistent.
    if (writtenPaths.has(file.absolute)) {
      throw new Error(`duplicate-artifact-path: ${file.id} would overwrite ${file.file}`);
    }
    writtenPaths.add(file.absolute);
    // safeJoin() guards reads; writes need the same containment. A module id reaches this
    // path, and so do the --out/--manifest flags.
    assertInside(CONTENT_DIR, file.absolute, `Artifact path escapes the content directory: ${file.file}`);
    const text = serialize(file.data);
    const existing = existsSync(file.absolute) ? readFileSync(file.absolute, 'utf8') : null;
    const prevHash = previous?.artifacts?.[file.id]?.content_hash ?? null;
    const depsChanged =
      !previous ||
      file.dependsOn.some((dep) => previous.sources?.[dep] !== report.sourceHashes[dep]) ||
      previous.generator_version !== GENERATOR_VERSION ||
      previous.generator_hash !== report.generatorHash;

    if (depsChanged) scoping.depsChanged.push(file.id);
    // Self-check: a lesson whose sources are byte-identical must regenerate byte-identically.
    if (!depsChanged && prevHash && prevHash !== file.contentHash) {
      scoping.nondeterministic.push(file.id);
    }

    if (existing === text) {
      scoping.unchanged.push(file.id);
      continue;
    }
    scoping.written.push(file.id);
    if (!DRY_RUN) {
      mkdirSync(path.dirname(file.absolute), { recursive: true });
      writeFileSync(file.absolute, text, 'utf8');
    }
  }

  // A lesson that stops being produced -- a source section shrinks, a module is dropped --
  // leaves a stale file that the app would still load. Detect it from what is actually on
  // disk, not just from the previous manifest, so an interrupted build is caught too.
  const produced = new Set(report.files.map((f) => f.file.split(path.sep).join('/')));
  scoping.orphans = [];
  scoping.pruned = [];
  for (const dir of ['lessons', 'exercise-data']) {
    const abs = path.join(CONTENT_DIR, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs).filter((f) => f.endsWith('.json')).sort()) {
      const rel = `${dir}/${name}`;
      if (produced.has(rel)) continue;
      scoping.orphans.push(rel);
      if (PRUNE && !DRY_RUN) {
        rmSync(path.join(abs, name));
        scoping.pruned.push(rel);
      }
    }
  }

  const buildManifest = {
    schema_version: SCHEMA_VERSION,
    generator: 'build-content',
    generator_version: GENERATOR_VERSION,
    generator_hash: report.generatorHash,
    source_repo: manifest.source_repo,
    source_commit: report.commit.provenanceCommit,
    source_license: manifest.source_license,
    sources: Object.fromEntries(Object.entries(report.sourceHashes).sort(([a], [b]) => a.localeCompare(b))),
    // Deletions used to survive only as a line on stdout. Recording them here keeps the
    // audit trail in the same reviewable artifact as everything else this build did.
    ...(scoping.pruned.length ? { pruned: [...scoping.pruned].sort() } : {}),
    modules: report.modules,
    artifacts: Object.fromEntries(
      report.files
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((f) => [f.id, { kind: f.kind, file: f.file.split(path.sep).join('/'), content_hash: f.contentHash, depends_on: f.dependsOn }])
    ),
  };
  const manifestText = serialize(buildManifest);
  if (!DRY_RUN && (!existsSync(BUILD_MANIFEST) || readFileSync(BUILD_MANIFEST, 'utf8') !== manifestText)) {
    mkdirSync(path.dirname(BUILD_MANIFEST), { recursive: true });
    writeFileSync(BUILD_MANIFEST, manifestText, 'utf8');
  }
  return scoping;
}

function printReport(report, scoping) {
  const lines = [];
  lines.push(`source repo   : ${report.sourceRoot}`);
  lines.push(
    `source commit : ${report.commit.head ? report.commit.head.slice(0, 7) : 'unknown'}` +
      (report.commit.matches === false ? '  (differs from the pinned commit)' : '')
  );
  for (const m of report.modules) {
    lines.push('');
    lines.push(`module ${m.id} — ${m.title}`);
    lines.push(`  lessons              : ${m.stats.lessons}   atoms: ${m.stats.atoms}`);
    lines.push(`  source rows parsed   : ${m.stats.source_rows}`);
    lines.push(`  lab action→event     : ${m.stats.lab_pairs} pairs (${m.stats.lab_pairs_rejected} rejected)`);
    lines.push(`  SRS-eligible cards   : ${m.stats.srs_eligible_cards} / ${m.stats.srs_card_budget} budget`);
  }
  lines.push('');
  lines.push(`written   : ${scoping.written.length}`);
  lines.push(`unchanged : ${scoping.unchanged.length}`);
  lines.push(`deps changed since last build : ${scoping.depsChanged.length}`);
  lines.push(`generator hash : ${report.generatorHash.slice(0, 12)}`);
  if (scoping.orphans.length) {
    lines.push('');
    lines.push(
      PRUNE
        ? `pruned ${scoping.orphans.length} orphaned artifact(s): ${scoping.orphans.join(', ')}`
        : `ORPHANED ARTIFACTS — ${scoping.orphans.length} file(s) on disk are no longer produced by any module.\n` +
          `  ${scoping.orphans.join('\n  ')}\n` +
          `  The app would still load them. Re-run with --prune to delete them.`
    );
  }
  if (scoping.nondeterministic.length) {
    lines.push('');
    lines.push('NON-DETERMINISM: these artifacts changed with no source change —');
    scoping.nondeterministic.forEach((id) => lines.push(`  ${id}`));
  }
  for (const note of report.notes) lines.push(`note: ${note}`);
  for (const w of report.warnings) lines.push(`WARN: ${w}`);
  if (DRY_RUN) lines.push('(--dry-run: nothing written)');
  process.stdout.write(`${lines.join('\n')}\n`);

  if (scoping.nondeterministic.length) process.exitCode = 1;
  if (scoping.orphans.length && !PRUNE) process.exitCode = 1;
  if (VERBOSE) process.stdout.write(`${JSON.stringify(scoping, null, 2)}\n`);
}

main();

