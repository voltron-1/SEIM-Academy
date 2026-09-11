import { useSession, DAILY_TARGET_ATOMS } from '../state/session';
import './Hud.css';

/**
 * Persistent HUD — progress, streak, "N left today" (#25).
 *
 * BUILD-PLAN: "Progress is visible, not implied — ambient reward, not end-of-course
 * reward." In Focus mode everything here collapses except the progress bar (#30), which is
 * the one signal worth keeping when the chrome is gone.
 *
 * The streak reads 0 until Unit 3 persists day boundaries. Seeding it with a plausible
 * number would make the one indicator whose whole job is honesty into a lie.
 */
export function Hud() {
  const { completedToday, atomsLeftToday, streakDays, focusMode } = useSession();
  const pct = Math.min(100, Math.round((completedToday / DAILY_TARGET_ATOMS) * 100));

  return (
    <header class={`hud${focusMode ? ' hud--focus' : ''}`}>
      <div
        class="hud__bar"
        role="progressbar"
        aria-valuenow={completedToday}
        aria-valuemin={0}
        aria-valuemax={DAILY_TARGET_ATOMS}
        aria-label={`${completedToday} of ${DAILY_TARGET_ATOMS} atoms done today`}
      >
        <div class="hud__fill" style={{ width: `${pct}%` }} />
      </div>

      {!focusMode && (
        <div class="hud__stats">
          <span class="hud__stat">
            <strong class="data">{atomsLeftToday}</strong> left today
          </span>
          <span class="hud__sep" aria-hidden="true" />
          <span class="hud__stat hud__stat--muted">
            <strong class="data">{streakDays}</strong> day streak
          </span>
        </div>
      )}
    </header>
  );
}
