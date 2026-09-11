/**
 * Source-repo resolution, safe path handling, and content hashing.
 *
 * The source knowledge base (TonyPhipps/SIEM, GPL-3.0) is NOT vendored into this repo.
 * It is resolved at build time from, in order of precedence:
 *   1. --source=<path> on the command line
 *   2. $SEIM_SOURCE_REPO
 *   3. ../SIEM relative to this repository's root
 *
 * The source tree is treated as untrusted input: it is a third-party repo that a
 * contributor clones, and a fork of it can contain anything. Hence the symlink, size and
 * ref-name checks below. This module never spawns a subprocess -- the source commit is
 * read straight out of .git rather than by shelling out to git, which keeps the whole
 * pipeline free of process execution (app-data-schema.md section 0).
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, lstatSync, realpathSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));

/** A source file bigger than this is a mistake or an attack, not lesson material. */
export const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
/** Longest line the parsers will look at. The real corpus tops out at 961 characters. */
export const MAX_SOURCE_LINE = 4096;

export function resolveSourceRepo(argv = process.argv.slice(2)) {
  const flag = argv.find((a) => a.startsWith('--source='));
  const value = flag ? flag.slice('--source='.length).trim() : '';
  if (flag && value === '') throw new Error('--source= requires a value');
  const candidate = value || process.env.SEIM_SOURCE_REPO || path.join(path.dirname(REPO_ROOT), 'SIEM');
  const resolved = path.resolve(candidate);
  if (!existsSync(resolved)) {
    throw new Error(
      `Source repo not found at ${resolved}.\n` +
        `Clone TonyPhipps/SIEM and pass --source=<path> or set SEIM_SOURCE_REPO.`
    );
  }
  return resolved;
}

/**
 * Join a repo-relative path to a root, rejecting absolute paths, traversal and symlinks.
 * The lexical check alone is not enough: git preserves symlinks on clone, so a fork can
 * ship a "source file" pointing at ~/.ssh/id_rsa or /dev/zero.
 */
export function safeJoin(root, relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) {
    throw new Error(`Invalid source path: ${JSON.stringify(relPath)}`);
  }
  if (path.isAbsolute(relPath) || relPath.includes('\\')) {
    throw new Error(`Source path must be repo-relative with forward slashes: ${relPath}`);
  }
  const joined = path.resolve(root, relPath);
  assertInside(root, joined, `Source path escapes the source repo: ${relPath}`);
  if (existsSync(joined)) {
    if (lstatSync(joined).isSymbolicLink()) {
      throw new Error(`Source path is a symlink, which is not read: ${relPath}`);
    }
    assertInside(root, realpathSync(joined), `Source path resolves outside the source repo: ${relPath}`);
  }
  return joined;
}

/** Throw unless `candidate` is `root` itself or sits underneath it. */
export function assertInside(root, candidate, message) {
  const rootResolved = path.resolve(root);
  const withSep = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep;
  const target = path.resolve(candidate);
  if (target !== rootResolved && !target.startsWith(withSep)) {
    throw new Error(message ?? `Path escapes ${rootResolved}: ${candidate}`);
  }
  return target;
}

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Read a source file as text plus its hash and line array. */
export function readSource(root, relPath) {
  const abs = safeJoin(root, relPath);
  if (!existsSync(abs)) throw new Error(`Source file missing: ${relPath}`);
  const { size } = statSync(abs);
  if (size > MAX_SOURCE_BYTES) {
    throw new Error(`Source file ${relPath} is ${size} bytes, over the ${MAX_SOURCE_BYTES}-byte cap`);
  }
  const text = readFileSync(abs, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  // A pathological line is the input shape that makes the table and comment regexes
  // backtrack. Refuse it loudly rather than hanging the build.
  const long = lines.findIndex((l) => l.length > MAX_SOURCE_LINE);
  if (long !== -1) {
    throw new Error(
      `Source file ${relPath}:${long + 1} has a ${lines[long].length}-character line, over the ${MAX_SOURCE_LINE} cap`
    );
  }
  return { path: relPath, text, lines, hash: sha256(text) };
}

/**
 * Resolve HEAD of a git working tree without spawning git.
 * The ref name comes from an untrusted repo, so it is validated before it is joined --
 * an unchecked `ref: ../../../../.ssh/id_rsa` would read an arbitrary file and leak its
 * first bytes into committed provenance.
 */
export function readGitHead(root) {
  const headFile = path.join(root, '.git', 'HEAD');
  if (!existsSync(headFile)) return null;
  const head = readFileSync(headFile, 'utf8').trim();
  if (!head.startsWith('ref:')) return /^[0-9a-f]{40}$/.test(head) ? head : null;

  const ref = head.slice(4).trim();
  if (!/^refs\/[A-Za-z0-9._\/-]+$/.test(ref) || ref.includes('..')) return null;

  const gitDir = path.join(root, '.git');
  let loose;
  try {
    loose = assertInside(gitDir, path.resolve(gitDir, ref));
  } catch {
    return null;
  }
  if (existsSync(loose) && !lstatSync(loose).isSymbolicLink() && statSync(loose).size <= 64) {
    const value = readFileSync(loose, 'utf8').trim();
    return /^[0-9a-f]{40}$/.test(value) ? value : null;
  }

  const packed = path.join(gitDir, 'packed-refs');
  if (!existsSync(packed)) return null;
  for (const line of readFileSync(packed, 'utf8').split('\n')) {
    const m = line.match(/^([0-9a-f]{40}) (.+)$/);
    if (m && m[2] === ref) return m[1];
  }
  return null;
}

/**
 * Compare the source tree's actual HEAD against the commit pinned in
 * module-manifest.json. A mismatch is a warning, not an error: contributors legitimately
 * build against a branch. The pinned value is what lands in the generated provenance, so
 * the artifact never claims a commit it was not built from.
 *
 * Returns { head, matches, provenanceCommit } -- `provenanceCommit` is what should be
 * recorded, which is the pin when it matches and the observed HEAD when it does not.
 */
export function checkPinnedCommit(sourceRoot, pinned) {
  if (!/^[0-9a-f]{7,40}$/.test(String(pinned ?? ''))) {
    throw new Error(`module-manifest.json source_commit must be a 7-40 character hex commit, got ${JSON.stringify(pinned)}`);
  }
  const head = readGitHead(sourceRoot);
  if (!head) return { head: null, matches: null, provenanceCommit: pinned };
  const matches = head.startsWith(pinned);
  return { head, matches, provenanceCommit: matches ? pinned : head.slice(0, 7) };
}
