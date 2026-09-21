#!/usr/bin/env node
/**
 * Compile the pure modules and run their tests.
 *
 *   npm test
 *
 * The guard below exists because this suite already failed silently once: the base
 * tsconfig excludes *.test.ts so the app build ignores them, `exclude` is inherited
 * through `extends`, and the test config emitted zero test files. `node --test` then
 * reported "# pass 0 / # fail 0" and exited 0 — a green run that tested nothing.
 *
 * A test suite that can pass by being empty is not a gate.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const APP = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(APP, '.tmp-test');
const MIN_TEST_FILES = 11;

const run = (cmd, args) => spawnSync(cmd, args, { cwd: APP, stdio: 'inherit', shell: process.platform === 'win32' });

rmSync(OUT, { recursive: true, force: true });

const compiled = run('npx', ['tsc', '-p', 'tsconfig.test.json']);
if (compiled.status !== 0) process.exit(compiled.status ?? 1);

const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.test.js') ? [path.join(dir, e.name)] : []
      )
    : [];

const files = walk(OUT);
if (files.length < MIN_TEST_FILES) {
  console.error(
    `\nRefusing to report success: compiled ${files.length} test file(s), expected at least ${MIN_TEST_FILES}.\n` +
      `Check tsconfig.test.json — an inherited "exclude" silently drops tests.\n`
  );
  process.exit(1);
}

// --import loads the DOM environment and the resolve hooks before any test module is
// evaluated. It points at src/, not the build output: .mjs files are not compiled by tsc.
const tested = run('node', ['--import', './src/test/setup.mjs', '--test', ...files]);
process.exit(tested.status ?? 1);
