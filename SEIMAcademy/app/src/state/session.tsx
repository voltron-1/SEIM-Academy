import { createContext } from 'preact';
import { useContext, useEffect, useMemo, useReducer } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  reducer,
  initialState,
  routeFromHash,
  atomsLeftToday,
  completedToday,
  type Route,
  type SessionState,
} from './session-core';

export { ROUTES, DAILY_TARGET_ATOMS, chromeFor } from './session-core';
export type { Route, SessionState, ChromeVisibility } from './session-core';

/**
 * Preact binding for the session state.
 *
 * All the logic lives in session-core.ts, which has no Preact and no JSX and is covered by
 * `npm test`. This file is the wiring: context, the hash listener, and the memoised API.
 *
 * Unit 3 (#27) swaps the in-memory state for localStorage/IndexedDB behind this same
 * interface — the shell contract does not change, which is the same split as Phase 3
 * filling in the exercise internals without changing the renderer contract.
 */

export interface SessionApi extends SessionState {
  navigate: (route: Route) => void;
  toggleFocus: () => void;
  setPaused: (paused: boolean) => void;
  completeAtom: (atomId: string) => void;
  setActiveAtom: (atomId: string | null) => void;
  atomsLeftToday: number;
  completedToday: number;
}

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ComponentChildren }) {
  const [state, dispatch] = useReducer(reducer, initialState, (base) => ({
    ...base,
    route: routeFromHash(globalThis.location?.hash ?? ''),
  }));

  // Hash routing rather than a routing framework — BUILD-PLAN rules one out, and deep
  // links still have to work.
  useEffect(() => {
    const onHashChange = () =>
      dispatch({ type: 'navigate', route: routeFromHash(globalThis.location.hash) });
    globalThis.addEventListener('hashchange', onHashChange);
    return () => globalThis.removeEventListener('hashchange', onHashChange);
  }, []);

  const api = useMemo<SessionApi>(
    () => ({
      ...state,
      completedToday: completedToday(state),
      atomsLeftToday: atomsLeftToday(state),
      navigate: (route) => {
        globalThis.location.hash = `#/${route}`;
        dispatch({ type: 'navigate', route });
      },
      toggleFocus: () => dispatch({ type: 'toggleFocus' }),
      setPaused: (paused) => dispatch({ type: 'setPaused', paused }),
      completeAtom: (atomId) => dispatch({ type: 'completeAtom', atomId }),
      setActiveAtom: (atomId) => dispatch({ type: 'setActiveAtom', atomId }),
    }),
    [state]
  );

  return <SessionContext.Provider value={api}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const api = useContext(SessionContext);
  if (!api) throw new Error('useSession must be used inside <SessionProvider>');
  return api;
}
