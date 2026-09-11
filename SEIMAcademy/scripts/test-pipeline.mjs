#!/usr/bin/env node
/**
 * test-pipeline -- proves the Phase 1 exit-gate claims, repeatably.
 *
 *   node SEIMAcademy/scripts/test-pipeline.mjs [--source=<path>]
 *
 * Every test builds into a throwaway directory under the OS temp dir and against a COPY
 * of the source repo, so nothing here touches the working tree or the source knowledge
 * base. Exits non-zero on the first failing assertion group.
 */
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { REPO_ROOT, resolveSourceRepo } from './lib/sources.mjs';
import { extractEventLabels } from './lib/ps1-labels.mjs';
import { ALLOWED_KEYS } from './lib/contract.mjs';

const BUILD = path.join(REPO_ROOT, 'SEIMAcademy', 'scripts', 'build-content.mjs');
const LIB = path.join(REPO_ROOT, 'SEIMAcademy', 'scripts', 'lib');
const MODULE_MANIFEST = path.join(REPO_ROOT, 'SEIMAcademy', 'content', 'module-manifest.json');

const results = [];
let failed = 0;

function assert(group, ok, detail) {
  results.push({ group, ok, detail });
  if (!ok) failed += 1;
}

/** The build script is a child process here only because that is how CI will invoke it. */
function runBuild(args) {
  const r = spawnSync(process.execPath, [BUILD, ...args], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

function snapshot(dir) {
  const files = new Map();
  for (const sub of ['lessons', 'exercise-data']) {
    const abs = path.join(dir, sub);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs).sort()) {
      files.set(`${sub}/${name}`, readFileSync(path.join(abs, name), 'utf8'));
    }
  }
  return files;
}

function diffKeys(a, b) {
  const changed = [];
  for (const [k, v] of b) if (a.get(k) !== v) changed.push(k);
  for (const k of a.keys()) if (!b.has(k)) changed.push(`${k} (removed)`);
  return changed.sort();
}

// ---------------------------------------------------------------------------------------

const realSource = resolveSourceRepo(process.argv.slice(2));
const work = mkdtempSync(path.join(tmpdir(), 'seim-pipeline-'));
const srcCopy = path.join(work, 'src');
mkdirSync(srcCopy, { recursive: true });
for (const dir of ['Logging', 'Lab']) {
  cpSync(path.join(realSource, dir), path.join(srcCopy, dir), { recursive: true });
}

// --- 1. idempotency (section 6.9) --------------------------------------------------------
{
  const out = path.join(work, 'idem');
  const first = runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${MODULE_MANIFEST}`]);
  assert('idempotency', first.status === 0, `first build exited ${first.status}`);
  const a = snapshot(out);
  assert('idempotency', a.size > 0, 'first build produced no files');

  const second = runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${MODULE_MANIFEST}`]);
  assert('idempotency', second.status === 0, `second build exited ${second.status}`);
  assert('idempotency', /written\s+:\s0\b/.test(second.out), 'second build rewrote files');
  const b = snapshot(out);
  const changed = diffKeys(a, b);
  assert('idempotency', changed.length === 0, `re-run changed ${changed.length} file(s): ${changed.slice(0, 3).join(', ')}`);
  assert('idempotency', !/NON-DETERMINISM/.test(second.out), 'build reported non-determinism');
}

// --- 2. scoped regeneration (Phase 1 exit gate) -----------------------------------------
{
  const out = path.join(work, 'scoped');
  runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${MODULE_MANIFEST}`]);
  const before = snapshot(out);

  // Edit one description cell in the Forensics document only.
  const target = path.join(srcCopy, 'Logging', 'Notable-Event-IDs-Forensics.md');
  const text = readFileSync(target, 'utf8');
  const edited = text.replace('User initiated logoff.', 'User initiated logoff (edited by test).');
  assert('scoped-regeneration', edited !== text, 'test fixture row not found in the Forensics document');
  writeFileSync(target, edited, 'utf8');

  const rebuilt = runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${MODULE_MANIFEST}`]);
  assert('scoped-regeneration', rebuilt.status === 0, `rebuild exited ${rebuilt.status}`);
  const after = snapshot(out);
  const changed = diffKeys(before, after);

  assert('scoped-regeneration', changed.length > 0, 'a source edit regenerated nothing');
  const offTarget = changed.filter((f) => !f.includes('forensics') && !f.includes('list-membership') && !f.includes('action-to-event'));
  assert(
    'scoped-regeneration',
    offTarget.length === 0,
    `edit to the Forensics document regenerated unrelated lessons: ${offTarget.slice(0, 5).join(', ')}`
  );
  const forensicsChanged = changed.filter((f) => f.includes('forensics'));
  assert('scoped-regeneration', forensicsChanged.length > 0, 'the edited document produced no regenerated lesson');
  assert(
    'scoped-regeneration',
    forensicsChanged.length < before.size / 2,
    `edit regenerated ${forensicsChanged.length}/${before.size} files — not scoped`
  );

  writeFileSync(target, text, 'utf8'); // restore the copy
}

// --- 3. orphan detection ----------------------------------------------------------------
{
  const out = path.join(work, 'orphan');
  runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${MODULE_MANIFEST}`]);
  const stray = path.join(out, 'lessons', 't1-m03-stray-orphan.json');
  writeFileSync(stray, '{}\n', 'utf8');

  const noPrune = runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${MODULE_MANIFEST}`]);
  assert('orphan-detection', noPrune.status !== 0, 'build passed with an orphaned artifact on disk');
  assert('orphan-detection', /ORPHANED ARTIFACTS/.test(noPrune.out), 'orphan not reported');
  assert('orphan-detection', existsSync(stray), 'orphan deleted without --prune');

  const pruned = runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${MODULE_MANIFEST}`, '--prune']);
  assert('orphan-detection', pruned.status === 0, `--prune build exited ${pruned.status}`);
  assert('orphan-detection', !existsSync(stray), '--prune did not delete the orphan');
}

// --- 4. parse-only constraint (app-data-schema.md section 0, Decision B) -----------------
// An import allowlist, not a substring grep. A grep over comment-stripped text is evaded
// by import('node:child'+'_process') or constructor.constructor, and the previous version
// also excluded this file from its own rule.
{
  const ALLOWED_IMPORTS = new Set(['node:fs', 'node:path', 'node:crypto', 'node:url', 'node:os']);
  const DYNAMIC = /\bimport\s*\(|\brequire\s*\(|\bnew\s+Function\b|\beval\s*\(|constructor\s*\.\s*constructor|process\s*\.\s*binding/;
  const scripts = readdirSync(path.dirname(BUILD)).filter((f) => f.endsWith('.mjs')).map((f) => path.join(path.dirname(BUILD), f));
  // Recurse: lib/profiles/ holds the generator profiles, which are exactly the code that
  // touches the Lab .ps1 files. A non-recursive walk would exempt them from this rule.
  const walkMjs = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walkMjs(path.join(dir, e.name)) : (e.name.endsWith('.mjs') ? [path.join(dir, e.name)] : [])
  );
  const libs = walkMjs(LIB);

  for (const f of [...scripts, ...libs]) {
    const name = path.basename(f);
    const text = readFileSync(f, 'utf8');
    const imports = [...text.matchAll(/^\s*import\b[^\n]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
    for (const spec of imports) {
      if (spec.startsWith('./') || spec.startsWith('../')) continue;
      // This harness alone may spawn node to invoke the build the way CI will.
      const allowed = ALLOWED_IMPORTS.has(spec) || (name === 'test-pipeline.mjs' && spec === 'node:child_process');
      assert('parse-only', allowed, `${name} imports ${spec}, which is not on the allowlist`);
    }
    const code = text.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
    assert('parse-only', !DYNAMIC.test(code), `${name} uses a dynamic execution primitive`);
    if (name !== 'test-pipeline.mjs') {
      assert('parse-only', !/\b(powershell|pwsh)\b/i.test(code), `${name} references a PowerShell binary in code`);
    }
  }
}

// --- 6. realistic source edits stay scoped (the shape the first version missed) ----------
{
  const out = path.join(work, 'edits');
  const sigma = path.join(srcCopy, 'Logging', 'Notable-Event-IDs-Sigma.md');
  const pristine = readFileSync(sigma, 'utf8');
  const build = () => runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${MODULE_MANIFEST}`, '--prune']);

  build();
  const base = snapshot(out);

  // 6a. A blank line between two sections must change nothing. Absolute line numbers in
  // atom provenance used to make this rewrite 20 files.
  const lines = pristine.split('\n');
  const blankAt = lines.findIndex((l, i) => i > 60 && l.startsWith('## '));
  lines.splice(blankAt, 0, '');
  writeFileSync(sigma, lines.join('\n'), 'utf8');
  const afterBlank = build();
  assert('realistic-edits', afterBlank.status === 0, `blank-line rebuild exited ${afterBlank.status}`);
  const blankChanged = diffKeys(base, snapshot(out));
  assert('realistic-edits', blankChanged.length === 0, `a mid-document blank line rewrote ${blankChanged.length} file(s): ${blankChanged.slice(0, 3).join(', ')}`);

  // 6b. Adding a row must not touch other channels' lessons.
  writeFileSync(sigma, pristine, 'utf8');
  build();
  const beforeRow = snapshot(out);
  const withRow = pristine.replace(
    /^(\|\s*201\s*\|[^\n]*)$/m,
    '$1\n|  9099  | SyntheticTestProvider | A synthetic row added by the pipeline test. |'
  );
  assert('realistic-edits', withRow !== pristine, 'row-insert fixture row not found');
  writeFileSync(sigma, withRow, 'utf8');
  const afterRow = build();
  assert('realistic-edits', afterRow.status === 0, `row-insert rebuild exited ${afterRow.status}`);
  const rowChanged = diffKeys(beforeRow, snapshot(out));
  const unrelated = rowChanged.filter((f) => /sigma-(security|system|smaller-channels|microsoft)/.test(f));
  assert('realistic-edits', unrelated.length === 0, `adding one Application row rewrote unrelated channels: ${unrelated.slice(0, 5).join(', ')}`);
  assert('realistic-edits', rowChanged.some((f) => f.includes('application')), 'adding an Application row changed no Application lesson');

  writeFileSync(sigma, pristine, 'utf8');
  build();
}

// --- 7. a legitimate edit must never be reported as non-determinism ----------------------
// The cross-corpus lessons draw on all three corpus docs while citing only one, so their
// declared dependencies used to under-report and the self-check misfired on a real edit.
{
  const out = path.join(work, 'crosscorpus');
  const risk = path.join(srcCopy, 'Logging', 'Notable-Event-IDs-Risk.md');
  const pristine = readFileSync(risk, 'utf8');
  runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${MODULE_MANIFEST}`, '--prune']);

  const lines = pristine.split('\n');
  const rowAt = lines.findIndex((l) => /^\|\s*4722\s*\|/.test(l));
  assert('cross-corpus-deps', rowAt !== -1, 'Risk fixture row 4722 not found');
  lines.splice(rowAt, 1);
  writeFileSync(risk, lines.join('\n'), 'utf8');

  const rebuilt = runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${MODULE_MANIFEST}`, '--prune']);
  assert('cross-corpus-deps', !/NON-DETERMINISM/.test(rebuilt.out), 'deleting one Risk row was reported as non-determinism');
  assert('cross-corpus-deps', rebuilt.status === 0, `Risk-edit rebuild exited ${rebuilt.status}`);

  writeFileSync(risk, pristine, 'utf8');
}

// --- 8. hostile source content fails the build rather than reaching a renderer -----------
{
  const out = path.join(work, 'hostile');
  const sigma = path.join(srcCopy, 'Logging', 'Notable-Event-IDs-Sigma.md');
  const pristine = readFileSync(sigma, 'utf8');
  const hostile = pristine.replace(/^## Application\r?$/m, '## Application <script>alert(1)</script>');
  assert('hostile-content', hostile !== pristine, 'hostile-heading fixture not applied');
  writeFileSync(sigma, hostile, 'utf8');

  const r = runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${MODULE_MANIFEST}`]);
  assert('hostile-content', r.status !== 0, 'a heading containing <script> built successfully');
  assert('hostile-content', /markdown-subset/.test(r.out), `build failed but not on markdown-subset: ${r.out.slice(0, 200)}`);

  writeFileSync(sigma, pristine, 'utf8');
}

// --- 5. lab label extraction, including the shapes that must yield nothing ---------------
{
  const fixture = [
    '# Create Local User (Security 4720)',
    'New-LocalUser -Name test',
    '# Create a Computer Object (Security 4741 on DC)',
    '# title: Possible DC Shadow Attack',
    '# id: 32e19d25-4aed-4860-a55a-be99cb0bf7ed (Security 4742, 5136)',
    '# Bitsadmin.exe T1105',
    '# Invoke-WebRequest something (Security 4688)',
    '',
  ].join('\n');
  const { pairs } = extractEventLabels(fixture, 'Lab/fixture.ps1');
  const byAction = Object.fromEntries(pairs.map((p) => [p.action, p]));

  assert('lab-labels', pairs.length === 3, `expected 3 pairs, got ${pairs.length}`);
  assert('lab-labels', byAction['Create Local User']?.event_ids.join() === '4720', 'simple label not parsed');
  assert('lab-labels', byAction['Create a Computer Object']?.scope === 'dc', 'DC scope not captured');
  assert('lab-labels', byAction['Possible DC Shadow Attack']?.event_ids.join() === '4742,5136', 'title lookback failed');
  assert('lab-labels', !('Invoke-WebRequest something' in byAction), 'executable-looking comment became content');
  assert('lab-labels', pairs.every((p) => !/New-LocalUser/.test(JSON.stringify(p))), 'executable line leaked into a pair');

  const lolbins = extractEventLabels('# AppInstaller.exe T1105\n# at.exe T1053.002\n', 'Lab/lolbins.ps1');
  assert('lab-labels', lolbins.pairs.length === 0, 'ATT&CK-only generator produced pairs');
}

// --- 9. the JSON Schema mirror must not drift from the enforced contract ----------------
// The mirror is not executed by anything, so nothing else would notice it going stale.
{
  const mirror = JSON.parse(readFileSync(path.join(REPO_ROOT, 'SEIMAcademy', 'schema', 'app-data-schema.json'), 'utf8'));
  const pairs = [
    ['lesson', mirror.$defs.lesson],
    ['atom', mirror.$defs.atom],
    ['source', mirror.$defs.source],
    ['srs', mirror.$defs.srs],
    ['generated', mirror.$defs.provenance],
    ['exerciseSet', mirror.$defs.exerciseDataSet],
    ['pair', mirror.$defs.exerciseDataSet.properties.pairs.items],
  ];
  for (const [name, def] of pairs) {
    assert('schema-mirror', !!def, `JSON Schema mirror has no definition for ${name}`);
    if (!def) continue;
    assert('schema-mirror', def.additionalProperties === false, `${name} in the mirror is not closed`);
    const mirrored = new Set(Object.keys(def.properties ?? {}));
    const enforced = ALLOWED_KEYS[name];
    const missing = [...enforced].filter((k) => !mirrored.has(k));
    const extra = [...mirrored].filter((k) => !enforced.has(k));
    assert('schema-mirror', missing.length === 0, `${name}: enforced but absent from the mirror: ${missing.join(', ')}`);
    assert('schema-mirror', extra.length === 0, `${name}: in the mirror but not enforced: ${extra.join(', ')}`);
  }
}

// --- 10. manifest validation is registry-driven -----------------------------------------
// The point of the profile registry is that adding a profile does not mean editing
// build-content.mjs. These assert the host defers to the profile rather than to its own
// hardcoded lists, and that a bad manifest fails before anything is written.
{
  const out = path.join(work, 'manifest');
  const base = JSON.parse(readFileSync(MODULE_MANIFEST, 'utf8'));
  const write = (mutate) => {
    const copy = JSON.parse(JSON.stringify(base));
    mutate(copy);
    const f = path.join(work, `manifest-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(f, JSON.stringify(copy, null, 2), 'utf8');
    return f;
  };
  const expectFail = (label, needle, mutate) => {
    const r = runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${write(mutate)}`]);
    assert('manifest-validation', r.status !== 0, `${label}: build succeeded`);
    assert('manifest-validation', r.out.includes(needle), `${label}: message lacked "${needle}" — got ${r.out.slice(0, 160)}`);
  };

  expectFail('unknown profile', 'unknown profile', (m) => { m.modules[0].profile = 'not-a-profile'; });
  expectFail('unknown exercise_data profile', 'unknown exercise_data profile', (m) => { m.modules[0].exercise_data[0].profile = 'nope'; });
  expectFail('unknown option', 'unknown option', (m) => { m.modules[0].options.made_up = 4; });
  expectFail('budget above the ceiling', 'srs_card_budget', (m) => { m.modules[0].options.srs_card_budget = 1e9; });
  expectFail('module id that is a path', 'module id', (m) => { m.modules[0].id = '../../escape'; });
  expectFail('modules out of play order', 'play order', (m) => {
    m.modules = [{ ...m.modules[0], id: 't2-m01', tier: 2, module: '1' }, m.modules[0]];
  });
}

// --- 11. a human's answer on an ambiguous source cell is recorded, not re-litigated ------
{
  const out = path.join(work, 'confirmed');
  const base = JSON.parse(readFileSync(MODULE_MANIFEST, 'utf8'));
  const withManifest = (mutate) => {
    const copy = JSON.parse(JSON.stringify(base));
    mutate(copy);
    const f = path.join(work, `cc-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(f, JSON.stringify(copy, null, 2), 'utf8');
    return runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${f}`, '--prune']);
  };

  const asShipped = withManifest(() => {});
  assert('confirmed-cells', asShipped.status === 0, `confirmed build exited ${asShipped.status}`);
  assert('confirmed-cells', !/WARN:.*mixes spaces and commas/.test(asShipped.out), 'a confirmed cell still warns on every build');
  assert('confirmed-cells', /8 15, 16, 33" split into 8, 15, 16, 33/.test(asShipped.out), 'confirmed split not reported as a note');

  const unconfirmed = withManifest((m) => { delete m.modules[0].confirmed_cells; });
  assert('confirmed-cells', /WARN:.*mixes spaces and commas/.test(unconfirmed.out), 'an unconfirmed ambiguous cell did not warn');

  // The recorded answer disagreeing with the parse means one of them is wrong; shipping
  // either would be guessing, so the build must stop rather than pick a side.
  const contradicted = withManifest((m) => { m.modules[0].confirmed_cells[0].event_ids = [815, 16, 33]; });
  assert('confirmed-cells', contradicted.status !== 0, 'a contradicted confirmation still built');
  assert('confirmed-cells', /confirmed-cell-mismatch/.test(contradicted.out), `wrong failure: ${contradicted.out.slice(0, 160)}`);
}

// --- 12. a wholesale-collected channel is taught, not dropped ---------------------------
// "*" in an EventID cell is a collection directive, not a malformed ID. Rejecting the row
// removed the entire channel from the curriculum with only a console warning to show for it.
{
  const out = path.join(work, 'wildcard');
  const r = runBuild([`--source=${srcCopy}`, `--out=${out}`, `--manifest=${MODULE_MANIFEST}`, '--prune']);
  assert('wildcard-channels', r.status === 0, `build exited ${r.status}`);
  assert('wildcard-channels', !/non-numeric-event-id/.test(r.out), 'wildcard row still reported as malformed');

  const lessons = readdirSync(path.join(out, 'lessons')).map((f) =>
    JSON.parse(readFileSync(path.join(out, 'lessons', f), 'utf8'))
  );
  const atoms = lessons.flatMap((l) => l.atoms);
  const tag = 'channel:microsoft-windows-security-mitigations-kernelmode';
  const taught = atoms.filter((a) => (a.teaches ?? []).includes(tag));
  assert('wildcard-channels', taught.length > 0, `${tag} is in no atom's teaches`);
  assert('wildcard-channels', taught.every((a) => a.type === 'reading'), 'wholesale channel produced a non-reading atom');
  assert('wildcard-channels', !atoms.some((a) => (a.teaches ?? []).some((t) => t.startsWith(`event:${tag.slice('channel:'.length)}:`))),
    'a wholesale channel produced a fabricated Event ID card');

  const manifest = JSON.parse(readFileSync(path.join(out, 'build-manifest.json'), 'utf8'));
  assert('wildcard-channels', manifest.modules[0].skipped_sections.length === 0,
    `sections still dropped: ${JSON.stringify(manifest.modules[0].skipped_sections)}`);
}

// ---------------------------------------------------------------------------------------

rmSync(work, { recursive: true, force: true });

const groups = [...new Set(results.map((r) => r.group))];
const lines = [];
for (const g of groups) {
  const rs = results.filter((r) => r.group === g);
  const bad = rs.filter((r) => !r.ok);
  lines.push(`${bad.length ? 'FAIL' : 'pass'}  ${g.padEnd(22)} ${rs.length} assertions${bad.length ? `, ${bad.length} failed` : ''}`);
  bad.forEach((r) => lines.push(`        - ${r.detail}`));
}
lines.push('');
lines.push(failed === 0 ? `PIPELINE TESTS PASSED — ${results.length} assertions` : `PIPELINE TESTS FAILED — ${failed}/${results.length}`);
process.stdout.write(`${lines.join('\n')}\n`);
process.exit(failed === 0 ? 0 : 1);
