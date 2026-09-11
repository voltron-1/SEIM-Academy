import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  load, save, emptyState, completeAtom, setPosition, completedOn, dayKey,
  type PersistedState, type StorageLike,
} from './persistence.js';

/**
 * Exercises the player's state loop against REAL generated lessons, not a fixture.
 *
 * The Phase 2 exit check says "reload resumes exactly where the learner left off". A
 * browserless test cannot click Next, but it can run the exact sequence of state
 * transitions the player performs and then throw the in-memory state away — which is what
 * closing a tab actually does.
 */

const CONTENT = path.resolve(import.meta.dirname, '..', '..', '..', 'content');
const lessonIds = readdirSync(path.join(CONTENT, 'lessons'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();

const readLesson = (id: string) =>
  JSON.parse(readFileSync(path.join(CONTENT, 'lessons', `${id}.json`), 'utf8')) as {
    id: string;
    atoms: { id: string }[];
  };

/** localStorage stores strings; a fake that held objects would not test serialisation. */
const browserStorage = (): StorageLike & { raw: Map<string, string> } => {
  const raw = new Map<string, string>();
  return { raw, getItem: (k) => raw.get(k) ?? null, setItem: (k, v) => void raw.set(k, v) };
};

test('generated content is present to test against', () => {
  assert.ok(lessonIds.length > 0, `no lessons under ${CONTENT} — run build-content.mjs`);
});

test('closing the tab mid-lesson resumes on the same atom', () => {
  const storage = browserStorage();
  const lesson = readLesson(lessonIds[0]!);
  const today = dayKey();

  // Play four atoms the way the player does: complete, then move the cursor.
  let state: PersistedState = emptyState();
  const stopAt = 4;
  for (let i = 0; i < stopAt; i += 1) {
    state = completeAtom(state, lesson.atoms[i]!.id, today);
    state = setPosition(state, { lessonId: lesson.id, atomIndex: i + 1 });
    save(storage, state);
  }

  // The tab closes. Everything in memory is gone; only what was written survives.
  const resumed = load(storage);
  assert.deepEqual(
    resumed.position,
    { lessonId: lesson.id, atomIndex: stopAt },
    'resume lands on the next unseen atom, not back at the start'
  );
  assert.equal(completedOn(resumed, today), stopAt, 'nothing already done is asked for again');
  assert.equal(resumed.streakDays, 1);
});

test('a whole lesson plays start to finish and the position survives each step', () => {
  const storage = browserStorage();
  const lesson = readLesson(lessonIds[Math.floor(lessonIds.length / 2)]!);
  const today = dayKey();
  let state = emptyState();

  lesson.atoms.forEach((atom, i) => {
    state = completeAtom(state, atom.id, today);
    state = setPosition(state, { lessonId: lesson.id, atomIndex: i + 1 });
    save(storage, state);
    assert.deepEqual(
      load(storage).position,
      { lessonId: lesson.id, atomIndex: i + 1 },
      `position not durable after atom ${i + 1}`
    );
  });

  assert.equal(completedOn(load(storage), today), lesson.atoms.length);
});

test('every generated atom id round-trips through storage unchanged', () => {
  // Atom ids are content-derived (app-data-schema.md §6.8) and reach localStorage as JSON.
  // A character that does not survive that trip would silently orphan a learner's progress.
  const storage = browserStorage();
  const today = dayKey();
  let state = emptyState();
  const all: string[] = [];

  for (const id of lessonIds) {
    for (const atom of readLesson(id).atoms) {
      all.push(atom.id);
      state = completeAtom(state, atom.id, today);
    }
  }
  save(storage, state);
  const back = load(storage);

  assert.equal(back.completedAtomIds.length, all.length, 'atom count changed across a save/load');
  assert.deepEqual(back.completedAtomIds, all, 'an atom id did not survive serialisation');
  assert.ok(all.length > 700, `expected the full pilot module, got ${all.length} atoms`);
});

test('resuming a lesson that no longer exists is not a crash', () => {
  // Content regenerates. A lesson id can vanish — Phase 1's own orphan pruning does exactly
  // this when a chunk boundary moves. The stored position must stay readable so the app can
  // fall back rather than fail to start.
  const storage = browserStorage();
  save(storage, setPosition(emptyState(), { lessonId: 't1-m03-deleted-lesson', atomIndex: 3 }));
  const resumed = load(storage);
  assert.equal(resumed.position?.lessonId, 't1-m03-deleted-lesson');
  assert.ok(!lessonIds.includes(resumed.position!.lessonId), 'fixture must name a missing lesson');
});
