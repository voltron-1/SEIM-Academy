/**
 * Local persistence (#27) — pure logic over a storage interface.
 *
 * BUILD-PLAN, ADHD-friendly: "Zero-cost re-entry. Closing the tab mid-lesson costs
 * nothing — no lost progress, no re-reading." That is the whole point of this file, so the
 * state transitions are pure and tested rather than tangled into a component.
 *
 * localStorage, not IndexedDB. The payload is a few kilobytes of ids, it must be readable
 * synchronously on first paint so the app can resume without a flash of the wrong screen,
 * and IndexedDB's asynchrony buys nothing at this size. If a future feature needs blobs,
 * it can add IndexedDB alongside rather than migrating this.
 *
 * Atom ids are content-derived and stable by construction (app-data-schema.md §6.8) —
 * which is exactly why progress keyed on them survives a source edit.
 */

import { MIN_EASE, MAX_EASE, MAX_INTERVAL_DAYS } from './srs';
import type { SrsCard } from './srs';

/** A calendar day key. Shared so the two loops that validate one cannot drift apart. */
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Keys that are not data. `JSON.parse` makes `__proto__` a real own property, so it
 * reaches `Object.entries`, and a bracket assignment would then find the
 * `Object.prototype.__proto__` setter and re-point the map's prototype instead of storing
 * anything.
 */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const STORAGE_KEY = 'seim-academy/v1';
export const STATE_VERSION = 1;

export interface Position {
  lessonId: string;
  atomIndex: number;
}

export interface Flag {
  atomId: string;
  day: string;
  note?: string;
}

export interface PersistedState {
  version: number;
  /** All-time. The HUD's daily counter reads completedByDay instead. */
  completedAtomIds: string[];
  /** 'YYYY-MM-DD' -> atom ids completed that day. */
  completedByDay: Record<string, string[]>;
  lastActiveDay: string | null;
  streakDays: number;
  /** Resume-exactly-here. */
  position: Position | null;
  flags: Flag[];
  /** SM-2 state per flashcard atom, keyed by atom id (#35). */
  srsCards: Record<string, SrsCard>;
}

export const emptyState = (): PersistedState => ({
  version: STATE_VERSION,
  completedAtomIds: [],
  completedByDay: {},
  lastActiveDay: null,
  streakDays: 0,
  position: null,
  flags: [],
  srsCards: {},
});

/** Local calendar day, not UTC: a streak is about the learner's day, not the server's. */
export const dayKey = (date: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const dayBefore = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y!, m! - 1, d!);
  date.setDate(date.getDate() - 1);
  return dayKey(date);
};

/**
 * Anything stored could have been hand-edited, truncated, or written by an older version.
 * Unreadable state resets to empty rather than throwing: losing a streak is a small
 * disappointment, and a shell that will not start is not.
 */
export function migrate(raw: unknown): PersistedState {
  if (!raw || typeof raw !== 'object') return emptyState();
  const candidate = raw as Partial<PersistedState>;
  if (candidate.version !== STATE_VERSION) return emptyState();

  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  const byDay: Record<string, string[]> = {};
  if (candidate.completedByDay && typeof candidate.completedByDay === 'object') {
    for (const [day, ids] of Object.entries(candidate.completedByDay)) {
      if (DAY_KEY.test(day)) byDay[day] = strings(ids);
    }
  }

  /**
   * Anything here could be hand-edited or written by an older build, so a card is kept
   * only if every field it schedules on is *usable*, not merely the right type. One bad
   * card is dropped; the rest of the deck survives, because losing a whole review deck to
   * one corrupt entry is a far worse outcome than losing one card's history.
   *
   * Type checks alone are not enough here. `dueDay: "zzz"` is a string that no date
   * compare ever matches, so the card would be due forever-never and drop silently out of
   * review while still sitting in storage. `ease: 1e308` overflows an interval multiply to
   * Infinity, which makes an Invalid Date and a "NaN-NaN-NaN" day key that sorts above
   * every real date — the same silent disappearance. srs.ts calls that outcome a retention
   * bug the learner cannot see, so it is rejected at the door.
   */
  const bounded = (n: unknown, max: number): n is number =>
    typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;

  const srsCards: Record<string, SrsCard> = {};
  // typeof [] === 'object', so the array check is not redundant: without it, Object.entries
  // files every card under a numeric index it can never be looked up by.
  if (candidate.srsCards && typeof candidate.srsCards === 'object' && !Array.isArray(candidate.srsCards)) {
    for (const [atomId, value] of Object.entries(candidate.srsCards)) {
      if (UNSAFE_KEYS.has(atomId)) continue;
      const c = value as Partial<SrsCard> | null;
      if (
        c &&
        typeof c === 'object' &&
        // Keyed by anything other than its own id, a card can never be updated again but
        // is still counted as due forever.
        c.atomId === atomId &&
        typeof c.deck === 'string' &&
        Array.isArray(c.teaches) &&
        typeof c.ease === 'number' &&
        Number.isFinite(c.ease) &&
        c.ease >= MIN_EASE &&
        c.ease <= MAX_EASE &&
        bounded(c.intervalDays, MAX_INTERVAL_DAYS) &&
        bounded(c.repetitions, Number.MAX_SAFE_INTEGER) &&
        bounded(c.lapses, Number.MAX_SAFE_INTEGER) &&
        typeof c.dueDay === 'string' &&
        DAY_KEY.test(c.dueDay)
      ) {
        srsCards[atomId] = {
          atomId,
          deck: c.deck,
          teaches: c.teaches.filter((t): t is string => typeof t === 'string'),
          ease: c.ease,
          intervalDays: c.intervalDays,
          repetitions: c.repetitions,
          dueDay: c.dueDay,
          lapses: c.lapses,
        };
      }
    }
  }

  const position =
    candidate.position &&
    typeof candidate.position.lessonId === 'string' &&
    Number.isInteger(candidate.position.atomIndex) &&
    candidate.position.atomIndex >= 0
      ? { lessonId: candidate.position.lessonId, atomIndex: candidate.position.atomIndex }
      : null;

  return {
    version: STATE_VERSION,
    completedAtomIds: strings(candidate.completedAtomIds),
    completedByDay: byDay,
    lastActiveDay: typeof candidate.lastActiveDay === 'string' ? candidate.lastActiveDay : null,
    streakDays: Number.isInteger(candidate.streakDays) && candidate.streakDays! >= 0 ? candidate.streakDays! : 0,
    position,
    flags: Array.isArray(candidate.flags)
      ? candidate.flags.filter(
          (f): f is Flag => !!f && typeof f.atomId === 'string' && typeof f.day === 'string'
        )
      : [],
    srsCards,
  };
}

/**
 * Record a completed atom and roll the streak.
 *
 * Same day        -> streak unchanged.
 * Yesterday       -> streak + 1.
 * Anything else   -> streak resets to 1, because today still counts. Resetting to 0 would
 *                    mean a learner who came back after a gap sees no credit for showing
 *                    up, which is the opposite of what the counter is for.
 */
export function completeAtom(state: PersistedState, atomId: string, today: string): PersistedState {
  const doneToday = state.completedByDay[today] ?? [];
  if (doneToday.includes(atomId)) return state;

  const streakDays =
    state.lastActiveDay === today
      ? state.streakDays
      : state.lastActiveDay === dayBefore(today)
        ? state.streakDays + 1
        : 1;

  return {
    ...state,
    completedAtomIds: state.completedAtomIds.includes(atomId)
      ? state.completedAtomIds
      : [...state.completedAtomIds, atomId],
    completedByDay: { ...state.completedByDay, [today]: [...doneToday, atomId] },
    lastActiveDay: today,
    streakDays,
  };
}

export const setPosition = (state: PersistedState, position: Position | null): PersistedState => ({
  ...state,
  position,
});

/** Flagging the same atom twice replaces the note rather than piling up duplicates. */
export const addFlag = (state: PersistedState, atomId: string, day: string, note?: string): PersistedState => ({
  ...state,
  flags: [...state.flags.filter((f) => f.atomId !== atomId), { atomId, day, ...(note ? { note } : {}) }],
});

export const removeFlag = (state: PersistedState, atomId: string): PersistedState => ({
  ...state,
  flags: state.flags.filter((f) => f.atomId !== atomId),
});

/** Reviewing a card replaces its state; a card has one schedule, not a history of them. */
export const putSrsCard = (state: PersistedState, card: SrsCard): PersistedState => ({
  ...state,
  srsCards: { ...state.srsCards, [card.atomId]: card },
});

/**
 * `hasOwn`, not a bare lookup: an atom id of `toString` or `constructor` would otherwise
 * resolve to an inherited `Object.prototype` member, which is truthy and would be handed
 * on as if it were a card.
 */
export const srsCardFor = (state: PersistedState, atomId: string): SrsCard | undefined =>
  Object.hasOwn(state.srsCards, atomId) ? state.srsCards[atomId] : undefined;

/**
 * Today's due count for the left rail — BUILD-PLAN's ambient-accountability mechanism,
 * "instead of a calendar/syllabus". Counted off persisted state alone so the rail can
 * show a number on first paint without loading any lesson content.
 */
export const dueCount = (state: PersistedState, today: string = dayKey()): number =>
  Object.values(state.srsCards).filter((card) => card.dueDay <= today).length;

export const isFlagged = (state: PersistedState, atomId: string): boolean =>
  state.flags.some((f) => f.atomId === atomId);

export const completedOn = (state: PersistedState, day: string): number =>
  (state.completedByDay[day] ?? []).length;

export const hasCompleted = (state: PersistedState, atomId: string): boolean =>
  state.completedAtomIds.includes(atomId);

/**
 * A storage that may not exist and may throw — Safari private mode throws on write, and a
 * quota error is a normal outcome, not an exception to crash on.
 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function load(storage: StorageLike | null | undefined): PersistedState {
  if (!storage) return emptyState();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : emptyState();
  } catch {
    return emptyState();
  }
}

/** Returns false when the write failed, so a caller can decide whether to say anything. */
export function save(storage: StorageLike | null | undefined, state: PersistedState): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
