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
}

export const emptyState = (): PersistedState => ({
  version: STATE_VERSION,
  completedAtomIds: [],
  completedByDay: {},
  lastActiveDay: null,
  streakDays: 0,
  position: null,
  flags: [],
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
      if (/^\d{4}-\d{2}-\d{2}$/.test(day)) byDay[day] = strings(ids);
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
