/**
 * Session state logic, with no Preact and no JSX, so it can be tested directly.
 *
 * The provider in session.tsx is a thin wrapper over this. Keeping the reducer pure is
 * what makes "does Focus mode actually preserve the exit affordances" a question with a
 * test rather than an opinion.
 */

export const ROUTES = ['today', 'tier1', 'tier2', 'copilot', 'review'] as const;
export type Route = (typeof ROUTES)[number];

/**
 * A daily target in atoms, not lessons or minutes.
 *
 * 30 atoms is roughly two to three lessons — about fifteen minutes at the schema's
 * 180-420s per lesson. Fixed on purpose: the real scheduler is Phase 3's SRS, and a second
 * one here would mean two things deciding what a learner sees.
 */
export const DAILY_TARGET_ATOMS = 30;

export interface SessionState {
  route: Route;
  focusMode: boolean;
  paused: boolean;
  /** Atom ids completed this session. Unit 3 persists these and scopes them by day. */
  completedAtomIds: string[];
  /** Consecutive days with a completed session. Needs persistence — Unit 3. */
  streakDays: number;
  /** The atom on screen. Unit 3 sets it; Skip and Hint are inert without it. */
  activeAtomId: string | null;
}

export type Action =
  | { type: 'navigate'; route: Route }
  | { type: 'toggleFocus' }
  | { type: 'setPaused'; paused: boolean }
  | { type: 'completeAtom'; atomId: string }
  | { type: 'setActiveAtom'; atomId: string | null };

export const initialState: SessionState = {
  route: 'today',
  focusMode: false,
  paused: false,
  completedAtomIds: [],
  streakDays: 0,
  activeAtomId: null,
};

export function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case 'navigate':
      // Navigating away clears a pause: arriving somewhere new already paused is a
      // confusing state to land in, and nothing is lost either way.
      return { ...state, route: action.route, paused: false };
    case 'toggleFocus':
      return { ...state, focusMode: !state.focusMode };
    case 'setPaused':
      return { ...state, paused: action.paused };
    case 'completeAtom':
      return state.completedAtomIds.includes(action.atomId)
        ? state
        : { ...state, completedAtomIds: [...state.completedAtomIds, action.atomId] };
    case 'setActiveAtom':
      return { ...state, activeAtomId: action.atomId };
    default:
      return state;
  }
}

export const isRoute = (value: string): value is Route =>
  (ROUTES as readonly string[]).includes(value);

export const routeFromHash = (hash: string): Route => {
  const raw = hash.replace(/^#\/?/, '');
  return isRoute(raw) ? raw : 'today';
};

export const completedToday = (state: SessionState): number => state.completedAtomIds.length;

/** Never negative: overshooting the target is not a deficit. */
export const atomsLeftToday = (state: SessionState): number =>
  Math.max(0, DAILY_TARGET_ATOMS - completedToday(state));

/**
 * What the shell chrome shows for a given state.
 *
 * This is the anxiety-safe contract in one place: Focus mode collapses navigation and the
 * HUD's stats, and the progress bar and the exit affordances survive it. BUILD-PLAN calls
 * the exit affordances "rendered once by the app shell, never hidden" — so that is an
 * assertion, not a styling detail.
 */
export interface ChromeVisibility {
  rail: boolean;
  hudStats: boolean;
  progressBar: boolean;
  exitAffordances: boolean;
}

export const chromeFor = (state: SessionState): ChromeVisibility => ({
  rail: !state.focusMode,
  hudStats: !state.focusMode,
  progressBar: true,
  exitAffordances: true,
});
