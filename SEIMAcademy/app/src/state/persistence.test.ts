import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, migrate, completeAtom, setPosition, addFlag, removeFlag, isFlagged,
  completedOn, hasCompleted, load, save, dayKey, STORAGE_KEY, STATE_VERSION,
  type PersistedState, type StorageLike,
  putSrsCard, srsCardFor, dueCount,
} from './persistence.js';
import type { SrsCard } from './srs.js';

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

// ---------------------------------------------------------------------------
// SRS card state (#35)
// ---------------------------------------------------------------------------

const srsCard = (over: Partial<SrsCard> = {}): SrsCard => ({
  atomId: 'card-1',
  deck: 'security',
  teaches: ['event:4624'],
  ease: 2.5,
  intervalDays: 6,
  repetitions: 2,
  dueDay: '2026-09-20',
  lapses: 0,
  ...over,
});

test('a review round-trips through storage with its schedule intact', () => {
  const store = memory();
  const saved = putSrsCard(emptyState(), srsCard());
  assert.ok(save(store, saved));

  const loaded = load(store);
  assert.deepEqual(srsCardFor(loaded, 'card-1'), srsCard());
});

test('reviewing the same card again replaces its state rather than piling up', () => {
  let s = putSrsCard(emptyState(), srsCard());
  s = putSrsCard(s, srsCard({ intervalDays: 15, repetitions: 3 }));
  assert.equal(Object.keys(s.srsCards).length, 1);
  assert.equal(srsCardFor(s, 'card-1')?.intervalDays, 15);
});

test('state written before the SRS deck existed keeps its streak', () => {
  // The alternative is bumping STATE_VERSION, which resets to empty on mismatch and
  // would wipe every learner's streak and resume position to add one field.
  const older = { ...emptyState(), streakDays: 9, position: { lessonId: 'l-1', atomIndex: 4 } };
  delete (older as Partial<PersistedState>).srsCards;

  const migrated = migrate(JSON.parse(JSON.stringify(older)));
  assert.equal(migrated.streakDays, 9, 'adding a field must not cost a learner their streak');
  assert.deepEqual(migrated.position, { lessonId: 'l-1', atomIndex: 4 });
  assert.deepEqual(migrated.srsCards, {});
});

test('a card of the wrong shape is dropped without taking the rest of the deck with it', () => {
  const raw = {
    ...emptyState(),
    srsCards: {
      good: srsCard({ atomId: 'good' }),
      bad: { atomId: 'bad', ease: 'very' },
      alsoBad: null,
    },
  };
  const migrated = migrate(JSON.parse(JSON.stringify(raw)));
  assert.deepEqual(Object.keys(migrated.srsCards), ['good']);
});

test('due counting is by day, so the rail can show a number without loading a deck', () => {
  let s = putSrsCard(emptyState(), srsCard({ atomId: 'a', dueDay: '2026-09-19' }));
  s = putSrsCard(s, srsCard({ atomId: 'b', dueDay: '2026-09-20' }));
  s = putSrsCard(s, srsCard({ atomId: 'c', dueDay: '2026-09-21' }));
  assert.equal(dueCount(s, '2026-09-20'), 2);
});

// ---------------------------------------------------------------------------
// migrate() hardening. Persisted state is hand-editable by anyone with the browser
// profile, so these are shapes a real payload can have, not hypotheticals.
// ---------------------------------------------------------------------------

const migrated = (srsCards: unknown): PersistedState =>
  migrate(JSON.parse(JSON.stringify({ ...emptyState(), srsCards })));

test('a __proto__ key is rejected rather than re-pointing the deck prototype', () => {
  // JSON.parse makes __proto__ a real own property, so it reaches Object.entries. A
  // bracket assignment would then hit the Object.prototype setter and silently move the
  // map's prototype instead of storing a card.
  const state = migrated({ __proto__: srsCard({ atomId: '__proto__' }), good: srsCard({ atomId: 'good' }) });
  assert.deepEqual(Object.keys(state.srsCards), ['good']);
  assert.equal(
    Object.getPrototypeOf(state.srsCards),
    Object.prototype,
    'the map prototype was re-pointed at the card instead of the key being rejected'
  );
});

test('an atom id that names an Object.prototype member does not resolve to one', () => {
  const state = migrated({ good: srsCard({ atomId: 'good' }) });
  for (const id of ['toString', 'constructor', 'valueOf', 'hasOwnProperty']) {
    assert.equal(srsCardFor(state, id), undefined, `${id} resolved to an inherited member`);
  }
});

test('a due day that is not a calendar day is rejected', () => {
  // "zzz" never matches a date compare, so the card would be due forever-never and drop
  // silently out of review while still sitting in storage.
  assert.deepEqual(Object.keys(migrated({ a: srsCard({ atomId: 'a', dueDay: 'zzz' }) }).srsCards), []);
  assert.deepEqual(Object.keys(migrated({ b: srsCard({ atomId: 'b', dueDay: '' }) }).srsCards), []);
  assert.deepEqual(Object.keys(migrated({ c: srsCard({ atomId: 'c', dueDay: '2026-9-1' }) }).srsCards), []);
});

test('a number too large to schedule with is rejected', () => {
  // 1e308 * 1e308 overflows to Infinity, which makes an Invalid Date and a "NaN-NaN-NaN"
  // day key that sorts above every real date — the card is never due again.
  assert.deepEqual(Object.keys(migrated({ a: srsCard({ atomId: 'a', ease: 1e308 }) }).srsCards), []);
  assert.deepEqual(Object.keys(migrated({ b: srsCard({ atomId: 'b', intervalDays: 1e308 }) }).srsCards), []);
  assert.deepEqual(Object.keys(migrated({ c: srsCard({ atomId: 'c', repetitions: -4 }) }).srsCards), []);
  assert.deepEqual(Object.keys(migrated({ d: srsCard({ atomId: 'd', ease: 0.2 }) }).srsCards), []);
});

test('an srsCards that is an array is rejected rather than iterated by index', () => {
  // typeof [] === 'object', so the container check passes; Object.entries then yields
  // "0", "1" as keys and every card is filed under a number it can never be found by.
  assert.deepEqual(migrated([srsCard({ atomId: 'a' })]).srsCards, {});
});

test('a card filed under a key that is not its own atom id is rejected', () => {
  // Stored under "A" while claiming to be "B", it can never be updated again but is
  // counted as due forever.
  assert.deepEqual(Object.keys(migrated({ A: srsCard({ atomId: 'B' }) }).srsCards), []);
});
