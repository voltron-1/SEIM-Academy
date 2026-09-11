#!/usr/bin/env node
/**
 * check-prereqs -- the anxiety-safe gate, on its own, fast enough for a pre-commit hook.
 *
 *   node SEIMAcademy/scripts/check-prereqs.mjs
 *
 * Enforces exactly two rules from app-data-schema.md:
 *   6.6 requires-subset-of-teaches -- no exercise may require something not taught first
 *   6.4 instructions-precede-exercise -- every exercise has its Instructions atom
 *
 * These are the two that are expensive to discover late: by Phase 4 a violation means
 * regenerating and re-reviewing content, not editing a line. validate-content.mjs runs
 * these too, alongside everything else; this script exists so the check can run on every
 * commit without waiting for the full pass.
 *
 * Install as a hook:
 *   printf '#!/bin/sh\nnode SEIMAcademy/scripts/check-prereqs.mjs\n' > .git/hooks/pre-commit
 *   chmod +x .git/hooks/pre-commit
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './lib/sources.mjs';

const CONTENT_DIR = path.join(REPO_ROOT, 'SEIMAcademy', 'content');
const manifestPath = path.join(CONTENT_DIR, 'build-manifest.json');

if (!existsSync(manifestPath)) {
  console.error('check-prereqs: no build-manifest.json — run build-content.mjs first.');
  process.exit(2);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const problems = [];
const taught = new Set();
let atoms = 0;
let exercises = 0;

for (const module of manifest.modules) {
  for (const lessonId of module.lesson_order) {
    // This runs as a git pre-commit hook, on whatever branch is checked out. A lesson id
    // from a tampered manifest must not become a read path.
    if (!/^t[12]-m[0-9]{2}[a-z]?-[a-z0-9-]+$/.test(lessonId)) {
      problems.push({ rule: 'manifest-coverage', detail: `${lessonId}: not a valid lesson id` });
      continue;
    }
    const file = path.join(CONTENT_DIR, 'lessons', `${lessonId}.json`);
    if (!existsSync(file)) {
      problems.push({ rule: 'manifest-coverage', detail: `${lessonId}: listed in lesson_order but not on disk` });
      continue;
    }
    const lesson = JSON.parse(readFileSync(file, 'utf8'));
    lesson.atoms.forEach((atom, i) => {
      atoms += 1;
      for (const tag of atom.requires ?? []) {
        if (!taught.has(tag)) {
          problems.push({
            rule: 'requires-subset-of-teaches',
            detail: `${lessonId} / ${atom.id} requires "${tag}" — no preceding atom teaches it`,
          });
        }
      }
      if (atom.type === 'exercise') {
        exercises += 1;
        const prev = lesson.atoms[i - 1];
        if (prev?.type !== 'instructions') {
          problems.push({
            rule: 'instructions-precede-exercise',
            detail: `${lessonId} / ${atom.id} is preceded by ${prev?.type ?? 'nothing'}, not an instructions atom`,
          });
        } else if (atom.difficulty === 'step-up' && !prev.payload?.step_up_notice) {
          problems.push({
            rule: 'instructions-precede-exercise',
            detail: `${lessonId} / ${atom.id} is a step-up with no step_up_notice on its instructions atom`,
          });
        }
      }
      for (const tag of atom.teaches ?? []) taught.add(tag);
    });
  }
}

const summary = `check-prereqs: ${atoms} atoms, ${exercises} exercises, ${taught.size} distinct teaches tags`;
if (problems.length === 0) {
  console.log(`${summary} — OK`);
  process.exit(0);
}
console.error(summary);
for (const p of problems.slice(0, 20)) console.error(`  ${p.rule}: ${p.detail}`);
if (problems.length > 20) console.error(`  … and ${problems.length - 20} more`);
console.error(`check-prereqs FAILED — ${problems.length} problem(s)`);
process.exit(1);
