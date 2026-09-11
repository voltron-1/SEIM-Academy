import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reducer,
  initialState,
  routeFromHash,
  atomsLeftToday,
  completedToday,
  chromeFor,
  DAILY_TARGET_ATOMS,
  ROUTES,
} from './session-core.js';

test('every route round-trips through the hash', () => {
  for (const route of ROUTES) assert.equal(routeFromHash(`#/${route}`), route);
  assert.equal(routeFromHash(''), 'today', 'no hash lands on Today');
  assert.equal(routeFromHash('#/nonsense'), 'today', 'an unknown hash lands on Today, not a blank screen');
  assert.equal(routeFromHash('#tier1'), 'tier1', 'the slash is optional');
});

test('navigating clears a pause', () => {
  const paused = reducer(initialState, { type: 'setPaused', paused: true });
  assert.equal(paused.paused, true);
  assert.equal(reducer(paused, { type: 'navigate', route: 'review' }).paused, false);
});

test('completing the same atom twice counts once', () => {
  let state = reducer(initialState, { type: 'completeAtom', atomId: 'a1' });
  state = reducer(state, { type: 'completeAtom', atomId: 'a1' });
  assert.equal(completedToday(state), 1);
  assert.equal(reducer(state, { type: 'completeAtom', atomId: 'a1' }), state, 'a no-op returns the same object');
});

test('atoms left today never goes negative', () => {
  let state = initialState;
  for (let i = 0; i < DAILY_TARGET_ATOMS + 5; i += 1) {
    state = reducer(state, { type: 'completeAtom', atomId: `a${i}` });
  }
  assert.equal(atomsLeftToday(state), 0, 'overshooting the target is not a deficit');
});

test('streak stays at zero until persistence exists', () => {
  // Unit 3 (#27) makes this meaningful. Until then it must read 0 rather than a plausible
  // number: the one indicator whose job is honesty should not be the one that lies.
  assert.equal(initialState.streakDays, 0);
});

test('Focus mode hides navigation but never the way out', () => {
  const normal = chromeFor(initialState);
  assert.deepEqual(normal, { rail: true, hudStats: true, progressBar: true, exitAffordances: true });

  const focused = chromeFor(reducer(initialState, { type: 'toggleFocus' }));
  assert.equal(focused.rail, false, 'Focus mode hides the left rail');
  assert.equal(focused.hudStats, false, 'Focus mode hides the HUD stats');
  assert.equal(focused.progressBar, true, 'the progress bar survives Focus mode');
  assert.equal(
    focused.exitAffordances,
    true,
    'exit affordances are rendered once by the shell and never hidden'
  );
});

test('Focus mode toggles back', () => {
  const on = reducer(initialState, { type: 'toggleFocus' });
  assert.equal(reducer(on, { type: 'toggleFocus' }).focusMode, false);
});
