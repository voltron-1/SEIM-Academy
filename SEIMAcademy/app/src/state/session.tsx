import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  reducer, initialState, routeFromHash, type Route, type SessionState,
} from './session-core';
import {
  load as loadPersisted, save as savePersisted, emptyState, dayKey,
  completeAtom as completeAtomIn, setPosition as setPositionIn,
  addFlag, removeFlag, isFlagged as isFlaggedIn, completedOn,
  putSrsCard, srsCardFor as srsCardForIn, dueCount as dueCountIn,
  type PersistedState, type Position,
} from './persistence';
import { DAILY_TARGET_ATOMS } from './session-core';
import { cardForAtom, cardsDue, review as reviewCard, type SrsCard } from './srs';
import type { Atom } from '../content/types';

export { ROUTES, DAILY_TARGET_ATOMS, chromeFor } from './session-core';
export type { Route, SessionState, ChromeVisibility } from './session-core';

/**
 * Preact binding for session state.
 *
 * Two stores, deliberately separate: `session-core` holds what is true about this tab
 * (route, focus, pause) and `persistence` holds what is true about this learner (progress,
 * streak, resume point, flags). Only the second survives a reload, and only the second has
 * to be defensible against a hand-edited or truncated payload.
 *
 * Both are pure modules with their own tests. This file is wiring.
 */

export interface SessionApi extends SessionState {
  navigate: (route: Route) => void;
  toggleFocus: () => void;
  setPaused: (paused: boolean) => void;
  setActiveAtom: (atomId: string | null) => void;

  /** Persisted learner state. */
  streakDays: number;
  completedToday: number;
  atomsLeftToday: number;
  completeAtom: (atomId: string) => void;
  position: Position | null;
  setPosition: (position: Position | null) => void;
  isFlagged: (atomId: string) => boolean;
  toggleFlag: (atomId: string, note?: string) => void;
  flagCount: number;
  /** False when the browser refused to store — private mode, quota, blocked cookies. */
  storageWorks: boolean;

  /**
   * Spaced repetition (#35). The card for an atom, and the grade that reschedules it.
   * `dueCount` is what the rail shows — BUILD-PLAN's ambient accountability, read off
   * persisted state so it is on screen at first paint.
   */
  srsCardFor: (atomId: string) => SrsCard | undefined;
  gradeCard: (atom: Atom, grade: number) => void;
  dueCount: number;
  /** The cards `dueCount` counts, for the Review route to actually play. */
  dueCards: SrsCard[];

  /** Lesson currently being played, if any. */
  activeLessonId: string | null;
  startLesson: (lessonId: string, atomIndex?: number) => void;
  exitLesson: () => void;

  /**
   * Skip and Hint are rendered once by the shell (#29), so they act on whatever atom is on
   * screen without the shell knowing its type. Monotonic counters rather than callbacks:
   * nothing to register, nothing to leak, and a missed signal is impossible.
   */
  skipSignal: number;
  hintSignal: number;
  requestSkip: () => void;
  requestHint: () => void;
}

const SessionContext = createContext<SessionApi | null>(null);

const storage = (): Storage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // blocked entirely by browser settings
  }
};

export function SessionProvider({ children }: { children: ComponentChildren }) {
  const [ui, dispatch] = useReducer(reducer, initialState, (base) => ({
    ...base,
    route: routeFromHash(globalThis.location?.hash ?? ''),
  }));

  const [persisted, setPersisted] = useState<PersistedState>(emptyState);
  const [storageWorks, setStorageWorks] = useState(true);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [skipSignal, setSkipSignal] = useState(0);
  const [hintSignal, setHintSignal] = useState(0);

  /**
   * The committed state, mirrored outside Preact's render cycle.
   *
   * `persisted` is only refreshed on re-render, so two writes in the same tick would both
   * build on the same snapshot and the second would silently discard the first. The lesson
   * player does exactly that — grading a flashcard schedules the card and then completes
   * the atom — so every grade a learner submitted was being thrown away, with no error
   * anywhere. `commit` takes an updater and applies it to this ref instead.
   */
  const latest = useRef<PersistedState>(persisted);

  // Read once, synchronously enough that the first paint can already be the resumed
  // screen rather than a flash of the wrong one.
  useEffect(() => {
    const loaded = loadPersisted(storage());
    latest.current = loaded;
    setPersisted(loaded);
  }, []);

  const commit = useCallback((update: (current: PersistedState) => PersistedState) => {
    const next = update(latest.current);
    if (next === latest.current) return;
    latest.current = next;
    setPersisted(next);
    setStorageWorks(savePersisted(storage(), next));
  }, []);

  useEffect(() => {
    const onHashChange = () =>
      dispatch({ type: 'navigate', route: routeFromHash(globalThis.location.hash) });
    globalThis.addEventListener('hashchange', onHashChange);
    return () => globalThis.removeEventListener('hashchange', onHashChange);
  }, []);

  const api = useMemo<SessionApi>(() => {
    const today = dayKey();
    const completedToday = completedOn(persisted, today);
    return {
      ...ui,
      streakDays: persisted.streakDays,
      completedToday,
      atomsLeftToday: Math.max(0, DAILY_TARGET_ATOMS - completedToday),
      position: persisted.position,
      flagCount: persisted.flags.length,
      storageWorks,
      activeLessonId,
      skipSignal,
      hintSignal,

      navigate: (route) => {
        globalThis.location.hash = `#/${route}`;
        dispatch({ type: 'navigate', route });
      },
      toggleFocus: () => dispatch({ type: 'toggleFocus' }),
      setPaused: (paused) => dispatch({ type: 'setPaused', paused }),
      setActiveAtom: (atomId) => dispatch({ type: 'setActiveAtom', atomId }),

      completeAtom: (atomId) => commit((s) => completeAtomIn(s, atomId, today)),
      srsCardFor: (atomId) => srsCardForIn(persisted, atomId),
      dueCount: dueCountIn(persisted, today),
      dueCards: cardsDue(Object.values(persisted.srsCards), today),
      gradeCard: (atom, grade) =>
        commit((s) => {
          const card = cardForAtom(atom, srsCardForIn(s, atom.id), today);
          // An ineligible or non-flashcard atom has no card; grading it is a no-op rather
          // than an error, so a caller never has to check first.
          return card ? putSrsCard(s, reviewCard(card, grade, today)) : s;
        }),
      setPosition: (position) => commit((s) => setPositionIn(s, position)),
      isFlagged: (atomId) => isFlaggedIn(persisted, atomId),
      toggleFlag: (atomId, note) =>
        commit((s) => (isFlaggedIn(s, atomId) ? removeFlag(s, atomId) : addFlag(s, atomId, today, note))),

      startLesson: (lessonId, atomIndex = 0) => {
        setActiveLessonId(lessonId);
        commit((s) => setPositionIn(s, { lessonId, atomIndex }));
      },
      exitLesson: () => {
        setActiveLessonId(null);
        dispatch({ type: 'setActiveAtom', atomId: null });
      },

      requestSkip: () => setSkipSignal((n) => n + 1),
      requestHint: () => setHintSignal((n) => n + 1),
    };
  }, [ui, persisted, storageWorks, activeLessonId, skipSignal, hintSignal, commit]);

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const api = useContext(SessionContext);
  if (!api) throw new Error('useSession must be used inside <SessionProvider>');
  return api;
}
