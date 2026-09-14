import { useState } from 'preact/hooks';
import type { Atom } from '../content/types';
import { nextInterval, type SrsCard } from '../state/srs';
import { str, text } from './payload';
import './Flashcard.css';

/**
 * The flashcard component (#35).
 *
 * Front, then a reveal, then a self-assessment that feeds the SM-2 scheduler in
 * `state/srs.ts`. This file decides nothing about scheduling — it collects a grade and
 * shows what that grade will do. Keeping the algorithm out of the component is what lets
 * the schedule be tested against the specification instead of against the DOM.
 *
 * A disclosure, not a swap: "Show the answer" stays in the DOM with `aria-expanded`, so
 * keyboard focus is never stranded on a button that has just been removed. The answer also
 * sits in a polite live region, because the shell's Hint button (#29) can reveal it from
 * across the screen — in that case the live region is the only announcement a screen
 * reader gets.
 */

/**
 * Four grades, not SuperMemo's six.
 *
 * A 0-5 scale asks a learner to introspect on distinctions they cannot make reliably, and
 * the unused grades are reachable only by a judgement nobody has. These four map onto the
 * SM-2 values that matter: a lapse, a scraped pass, a clean pass, and an effortless one.
 *
 * The copy is neutral. "Again" describes what happens next; "Wrong" grades the person,
 * which is the anxiety-safe principle this project keeps.
 */
const GRADES = [
  { grade: 1, label: 'Again', shape: '↺' },
  { grade: 3, label: 'Hard', shape: '◔' },
  { grade: 4, label: 'Good', shape: '●' },
  { grade: 5, label: 'Easy', shape: '✦' },
] as const;

const days = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`;

export interface FlashcardProps {
  atom: Atom;
  /** The card's SM-2 state. Absent for a card that is not in the scheduler (§6.5). */
  card?: SrsCard;
  onGrade: (grade: number) => void;
  /** Set by the shell's Hint button — reveals the answer from outside this component. */
  hint?: boolean;
}

export function Flashcard({ atom, card, onGrade, hint }: FlashcardProps) {
  const [shown, setShown] = useState(false);
  const open = shown || hint === true;
  const back = str(atom.payload, 'back');

  return (
    <div class="flashcard">
      <p class="flashcard__front data">{str(atom.payload, 'front')}</p>

      {/* With hint on, the shell has already revealed it; a toggle that cannot close is
          worse than no toggle. */}
      {!hint && (
        <button
          type="button"
          class="flashcard__reveal"
          aria-expanded={open}
          onClick={() => setShown(true)}
        >
          {open ? 'Hide the answer' : 'Show the answer'}
        </button>
      )}

      <div class="flashcard__answer" aria-live="polite">
        {open && <p class="flashcard__back">{back}</p>}
      </div>

      {open && card && (
        <>
          <p class="flashcard__ask" id={`${atom.id}-grade`}>
            How did that go?
          </p>
          <ul class="grades" aria-labelledby={`${atom.id}-grade`}>
            {GRADES.map(({ grade, label, shape }) => (
              <li key={grade}>
                <button
                  type="button"
                  class={`grade grade--${label.toLowerCase()}`}
                  onClick={() => onGrade(grade)}
                >
                  {/* Decorative: the label and the interval carry the meaning, so the
                      grades are never distinguished by colour alone. */}
                  <span class="grade__shape" aria-hidden="true">
                    {shape}
                  </span>
                  <span class="grade__label">{label}</span>
                  {/* The consequence of the button is visible before it is pressed. */}
                  <span class="grade__interval">{days(nextInterval(card, grade))}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {open && atom.srs && !atom.srs.eligible && (
        <p class="atom__aside">
          Not in the review deck — {text(atom.srs.reason, 'not eligible').replace(/-/g, ' ')}. It
          still plays here; it just never enters spaced repetition.
        </p>
      )}
    </div>
  );
}
