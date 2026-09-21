import './Feedback.css';

/**
 * The shared inline-feedback block (#36, #37).
 *
 * BUILD-PLAN: "Mistakes are informational, never punitive. Wrong-answer feedback states
 * what's true and why in neutral language — no shame-adjacent copy, no harsh red flash."
 *
 * So there is no "incorrect" state here, only `settled` and `correct`. A miss is rendered
 * by *stating the answer*, never by naming the learner's attempt as a failure. Keeping that
 * in one component is what stops the copy drifting between the two components that use it.
 *
 * The block is a polite live region because it appears in place: a sighted learner sees it
 * arrive, and without this a screen-reader user gets nothing at all.
 */

export interface FeedbackProps {
  correct?: boolean;
  /** What is true — the answer, stated plainly. */
  headline: string;
  /** Why it is true. Generated from the source row, so it shows either way. */
  rationale?: string;
}

export function Feedback({ correct, headline, rationale }: FeedbackProps) {
  return (
    <div class={`feedback ${correct ? 'feedback--correct' : 'feedback--answer'}`} aria-live="polite">
      <p class="feedback__headline">
        {/* Decorative. The text carries the meaning, so the result is never colour alone. */}
        <span class="feedback__shape" aria-hidden="true">
          {correct ? '✓' : '→'}
        </span>
        <span>{headline}</span>
      </p>
      {rationale && <p class="feedback__why">{rationale}</p>}
    </div>
  );
}
