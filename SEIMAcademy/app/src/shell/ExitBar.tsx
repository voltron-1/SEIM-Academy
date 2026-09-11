import { useSession } from '../state/session';
import './ExitBar.css';

/**
 * Persistent exit affordances (#29) and the Focus mode toggle (#30).
 *
 * BUILD-PLAN, anxiety-safe: these are "rendered once by the app shell, never hidden".
 * That includes Focus mode — the rail and HUD chrome collapse, this bar does not. A
 * learner must always be able to leave without hunting for the way out.
 *
 * Skip and Hint need an atom on screen, which arrives in Unit 3. Until then they are
 * `aria-disabled` rather than `disabled`: still reachable by keyboard and still announced,
 * so the affordance is discoverable and says why it is inert, instead of vanishing from
 * the tab order.
 */
export function ExitBar() {
  const { activeAtomId, paused, setPaused, navigate, focusMode, toggleFocus } = useSession();
  const noAtom = activeAtomId === null;
  const inertReason = 'Available once a lesson is on screen';

  return (
    <div class="exitbar" role="toolbar" aria-label="Session controls">
      <button
        type="button"
        class="exitbar__btn"
        aria-disabled={noAtom}
        title={noAtom ? inertReason : 'Skip this atom — no penalty, it returns to the queue'}
        onClick={() => {
          if (noAtom) return;
          /* Unit 3 wires this to the atom queue. */
        }}
      >
        Skip
      </button>

      <button
        type="button"
        class="exitbar__btn"
        aria-disabled={noAtom}
        title={noAtom ? inertReason : 'Show a hint — never counts against you'}
        onClick={() => {
          if (noAtom) return;
          /* Unit 3 wires this to the atom renderer. */
        }}
      >
        Hint
      </button>

      <button
        type="button"
        class="exitbar__btn"
        aria-pressed={paused}
        onClick={() => setPaused(!paused)}
      >
        {paused ? 'Resume' : 'Pause'}
      </button>

      <button type="button" class="exitbar__btn" onClick={() => navigate('today')}>
        Exit to Today
      </button>

      <span class="exitbar__spacer" />

      <button
        type="button"
        class="exitbar__btn exitbar__btn--ghost"
        aria-pressed={focusMode}
        title="Hide the rail and HUD chrome. The progress bar and these controls stay."
        onClick={toggleFocus}
      >
        {focusMode ? 'Exit focus' : 'Focus'}
      </button>
    </div>
  );
}

/**
 * Pause is a calm stop, not a modal interruption: no countdown, no "are you sure", nothing
 * lost. BUILD-PLAN treats timers and punishing pauses as an abandonment source.
 */
export function PauseOverlay() {
  const { paused, setPaused } = useSession();
  if (!paused) return null;

  return (
    <div class="pause" role="status">
      <div class="pause__card">
        <h2>Paused</h2>
        <p class="pause__body">
          Nothing is lost. Close the tab if you like — you will come back exactly here.
        </p>
        <button type="button" class="exitbar__btn" onClick={() => setPaused(false)} autofocus>
          Resume
        </button>
      </div>
    </div>
  );
}
