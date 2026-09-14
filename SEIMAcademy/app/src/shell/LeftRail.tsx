import { useSession, ROUTES, type Route } from '../state/session';
import './LeftRail.css';

const LABELS: Record<Route, string> = {
  today: 'Today',
  tier1: 'Tier 1',
  tier2: 'Tier 2',
  copilot: 'Copilot',
  review: 'Review',
};

/**
 * Left rail — the five destinations from BUILD-PLAN's UI/UX spec.
 *
 * Hidden in Focus mode (#30). It is navigation, not an exit affordance: the Skip / Hint /
 * Pause / Exit bar stays visible in Focus mode because a learner must always be able to
 * leave without hunting for the way out.
 */
export function LeftRail() {
  const { route, navigate, focusMode, dueCount } = useSession();
  if (focusMode) return null;

  return (
    <nav class="rail" aria-label="Sections">
      <div class="rail__brand">
        <span class="rail__mark" aria-hidden="true" />
        <span class="rail__name">SEIM Academy</span>
      </div>
      <ul class="rail__list">
        {ROUTES.map((r) => (
          <li key={r}>
            <a
              class="rail__link"
              href={`#/${r}`}
              aria-current={route === r ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate(r);
              }}
            >
              {LABELS[r]}
              {/* The count is inside the link, so a screen reader reads "Review, 2 cards
                  due" rather than "Review" and then a stray number. Nothing due renders
                  nothing: a 0 staring back every day a learner is caught up is the
                  opposite of what the counter is for. */}
              {r === 'review' && dueCount > 0 && (
                <span class="rail__badge">
                  {dueCount} {dueCount === 1 ? 'card due' : 'cards due'}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
