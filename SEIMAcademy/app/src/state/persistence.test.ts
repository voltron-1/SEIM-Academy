import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, migrate, completeAtom, setPosition, addFlag, removeFlag, isFlagged,
  completedOn, hasCompleted, load, save, dayKey, STORAGE_KEY, STATE_VERSION,
  type PersistedState, type StorageLike,
} from './persistence.js';

const memory = (): StorageLike & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

test('a completed atom is recorded once per day', () => {
  let s = completeAtom(emptyState(), 'a1', '2026-09-10');
  s = completeAtom(s, 'a1', '2026-09-10');
  assert.equal(completedOn(s, '2026-09-10'), 1);
  assert.ok(hasCompleted(s, 'a1'));
});

test('streak increments only across consecutive days', () => {
  let s = completeAtom(emptyState(), 'a', '2026-09-08');
  assert.equal(s.streakDays, 1, 'the first day counts as one');

  s = completeAtom(s, 'b', '2026-09-08');
  assert.equal(s.streakDays, 1, 'a second atom the same day does not bump the streak');

  s = completeAtom(s, 'c', '2026-09-09');
  assert.equal(s.streakDays, 2, 'the next day increments');

  s = completeAtom(s, 'd', '2026-09-12');
  assert.equal(s.streakDays, 1, 'a gap resets — but today still counts, so 1 and not 0');
});

test('streak handles a month boundary', () => {
  let s = completeAtom(emptyState(), 'a', '2026-08-31');
  s = completeAtom(s, 'b', '2026-09-01');
  assert.equal(s.streakDays, 2);
});

test('resume position round-trips and can be cleared', () => {
  const s = setPosition(emptyState(), { lessonId: 't1-m03-orientation', atomIndex: 3 });
  assert.deepEqual(s.position, { lessonId: 't1-m03-orientation', atomIndex: 3 });
  assert.equal(setPosition(s, null).position, null);
});

test('flagging the same atom twice replaces the note', () => {
  let s = addFlag(emptyState(), 'a1', '2026-09-10', 'confusing');
  s = addFlag(s, 'a1', '2026-09-10', 'actually fine');
  assert.equal(s.flags.length, 1);
  assert.equal(s.flags[0]!.note, 'actually fine');
  assert.ok(isFlagged(s, 'a1'));
  assert.equal(isFlagged(removeFlag(s, 'a1'), 'a1'), false);
});

test('a flag with no note is still a flag', () => {
  const s = addFlag(emptyState(), 'a1', '2026-09-10');
  assert.equal(s.flags[0]!.note, undefined);
  assert.ok(isFlagged(s, 'a1'));
});

test('state survives a round-trip through storage', () => {
  const store = memory();
  let s = completeAtom(emptyState(), 'a1', '2026-09-10');
  s = setPosition(s, { lessonId: 'L', atomIndex: 2 });
  s = addFlag(s, 'a1', '2026-09-10', 'note');
  assert.ok(save(store, s));
  assert.deepEqual(load(store), s);
});

test('unreadable storage resets instead of throwing', () => {
  const corrupt: StorageLike = { getItem: () => '{not json', setItem: () => {} };
  assert.deepEqual(load(corrupt), emptyState());

  const throwing: StorageLike = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('QuotaExceededError'); },
  };
  assert.deepEqual(load(throwing), emptyState(), 'a throwing read must not break startup');
  assert.equal(save(throwing, emptyState()), false, 'a failed write reports rather than throws');
  assert.deepEqual(load(null), emptyState(), 'no storage at all is a normal case');
  assert.equal(save(undefined, emptyState()), false);
});

test('a version bump discards old state rather than half-reading it', () => {
  const old = { ...emptyState(), version: STATE_VERSION + 99, streakDays: 12 };
  assert.equal(migrate(old).streakDays, 0);
});

test('migrate discards fields of the wrong shape but keeps the rest', () => {
  const messy = {
    version: STATE_VERSION,
    completedAtomIds: ['good', 42, null, 'also-good'],
    completedByDay: { '2026-09-10': ['a'], 'not-a-day': ['b'] },
    lastActiveDay: 12345,
    streakDays: -4,
    position: { lessonId: 'L', atomIndex: -1 },
    flags: [{ atomId: 'a', day: '2026-09-10' }, { nope: true }],
  };
  const s: PersistedState = migrate(messy);
  assert.deepEqual(s.completedAtomIds, ['good', 'also-good']);
  assert.deepEqual(Object.keys(s.completedByDay), ['2026-09-10']);
  assert.equal(s.lastActiveDay, null);
  assert.equal(s.streakDays, 0);
  assert.equal(s.position, null, 'a negative atom index is not a resume point');
  assert.equal(s.flags.length, 1);
});

test('dayKey is the local calendar day', () => {
  assert.equal(dayKey(new Date(2026, 8, 10, 23, 59)), '2026-09-10');
  assert.equal(dayKey(new Date(2026, 0, 1, 0, 0)), '2026-01-01');
});

test('the storage key is versioned', () => {
  assert.match(STORAGE_KEY, /\/v\d+$/);
});
