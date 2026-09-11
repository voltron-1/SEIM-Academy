import type { Atom, Difficulty } from '../content/types';
import './Instructions.css';

/**
 * The Instructions atom (#34).
 *
 * Fixed anatomy, every time: Goal → What you'll use → How you'll know you're done.
 * BUILD-PLAN makes this a schema-enforced prerequisite of every exercise atom
 * (app-data-schema.md §6.4), and it is built first in Phase 3 because every other
 * component in the phase depends on its shape being settled.
 *
 * The anatomy is a description list because that is what it is — three fixed terms with
 * their definitions. A screen reader announces the count and lets a learner jump between
 * them; a stack of divs would announce three unrelated paragraphs.
 */

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  intro: 'Gentle start',
  standard: 'Standard',
  'step-up': 'A step up',
};

/**
 * Difficulty is never signalled by colour alone — the accessibility baseline requires a
 * shape or icon alongside, so a colourblind learner gets the same information. The shape
 * is decorative and the text carries the meaning, which is the right way round.
 */
function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const shape = difficulty === 'step-up' ? '▲' : difficulty === 'standard' ? '■' : '●';
  return (
    <p class={`difficulty difficulty--${difficulty}`}>
      <span class="difficulty__shape" aria-hidden="true">
        {shape}
      </span>
      <span>{DIFFICULTY_LABEL[difficulty]}</span>
    </p>
  );
}

export interface InstructionsProps {
  atom: Atom;
  /**
   * The difficulty of the exercise this atom introduces. It lives on the exercise, not
   * here, so the player passes it down — BUILD-PLAN requires a harder exercise to be
   * "signalled up front, not discovered mid-struggle".
   */
  nextDifficulty?: Difficulty;
}

const text = (payload: Record<string, unknown>, key: string): string =>
  typeof payload[key] === 'string' ? (payload[key] as string) : '';

export function Instructions({ atom, nextDifficulty }: InstructionsProps) {
  const stepUpNotice = text(atom.payload, 'step_up_notice');
  const difficulty = nextDifficulty;

  return (
    <div class="instructions">
      {difficulty && <DifficultyBadge difficulty={difficulty} />}

      {stepUpNotice && (
        <p class="instructions__notice">
          <span class="instructions__shape" aria-hidden="true">
            ▲
          </span>
          {stepUpNotice}
        </p>
      )}

      <dl class="instructions__anatomy">
        <dt>Goal</dt>
        <dd>{text(atom.payload, 'goal')}</dd>

        <dt>What you'll use</dt>
        <dd>{text(atom.payload, 'what_youll_use')}</dd>

        <dt>How you'll know you're done</dt>
        <dd>{text(atom.payload, 'done_when')}</dd>
      </dl>
    </div>
  );
}
