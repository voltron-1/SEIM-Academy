import { useState } from 'preact/hooks';
import type { Atom, Difficulty } from '../content/types';
import { Markdown } from './Markdown';
import { Instructions as InstructionsAtom } from './Instructions';
import { Flashcard as FlashcardAtom } from './Flashcard';
import { Quiz as QuizAtom } from './Quiz';
import { Matching as MatchingAtom } from './Matching';
import type { SrsCard } from '../state/srs';
import { str, list } from './payload';
import './atoms.css';

/**
 * One shared renderer per atom type, one atom per screen (#26).
 *
 * Phase 2 rendered; **Phase 3 makes them interactive**, one component per unit. Unit 1
 * moved the instructions atom out into its own file and Unit 2 does the same for the
 * flashcard, which now grades into the SM-2 scheduler. The reveal-only renderers left
 * here are the ones whose units have not landed yet.
 *
 * Every payload value is read through a narrow accessor rather than cast — see
 * `payload.ts`, which both this file and the extracted components share.
 */

interface AtomProps {
  atom: Atom;
  /** Set by the shell's Hint button — reveals whatever this atom type hides. */
  hint?: boolean;
  /** Difficulty of the exercise an instructions atom introduces; passed down by the player. */
  nextDifficulty?: Difficulty;
  /**
   * Scheduler state for a flashcard, and the grade handler that reschedules it. Optional
   * so the renderer contract stays additive — an atom rendered without them still plays as
   * a reveal, which is what an ineligible card does anyway (§6.5).
   */
  srsCard?: SrsCard;
  onGrade?: (grade: number) => void;
}

/**
 * `forceOpen` is how the shell's Hint button reaches in: Hint is a persistent affordance
 * rendered once by the shell (#29), so it needs a way to act on whatever atom is on screen
 * without the shell knowing what kind of atom that is.
 */
function Reveal({ label, children, forceOpen }: { label: string; children: preact.ComponentChildren; forceOpen?: boolean }) {
  const [shown, setShown] = useState(false);
  return shown || forceOpen ? (
    <div class="reveal reveal--open">{children}</div>
  ) : (
    <button type="button" class="reveal__btn" onClick={() => setShown(true)}>
      {label}
    </button>
  );
}

function Predict({ atom, hint }: AtomProps) {
  return (
    <>
      <p class="atom__prompt">{str(atom.payload, 'prompt')}</p>
      <Markdown body={atom.body} />
      <p class="atom__aside">No wrong answers. This one is a guess, and a guess costs nothing.</p>
      <Reveal label="Show what it turned out to be" forceOpen={hint}>
        <p>{str(atom.payload, 'reveal')}</p>
      </Reveal>
    </>
  );
}

function Reading({ atom }: AtomProps) {
  return <Markdown body={atom.body} />;
}

function Flashcard({ atom, hint, srsCard, onGrade }: AtomProps) {
  return <FlashcardAtom atom={atom} card={srsCard} onGrade={onGrade ?? (() => {})} hint={hint} />;
}

function Quiz({ atom, hint }: AtomProps) {
  return <QuizAtom atom={atom} hint={hint} />;
}

function Instructions({ atom, nextDifficulty }: AtomProps) {
  return <InstructionsAtom atom={atom} nextDifficulty={nextDifficulty} />;
}

function Exercise({ atom, hint }: AtomProps) {
  const format = str(atom.payload, 'format');

  if (format === 'match' || format === 'drag-classify') {
    return <MatchingAtom atom={atom} hint={hint} />;
  }

  // lookup-drill has no Unit 3 issue behind it; it stays a reveal until its own unit lands.
  return (
    <>
      <Markdown body={atom.body} />
      <p class="atom__aside">
        <span class="data">{format}</span> · interaction arrives in a later unit. The material
        is below so the lesson reads end to end.
      </p>
      <Reveal label="Show the pairs" forceOpen={hint}>
        <ul class="pairs">
          {list(atom.payload, 'prompts').map((p, i) => {
            const prompt = p as { ask?: unknown; answer?: unknown };
            return (
              <li key={i}>
                <span class="data">{String(prompt.ask ?? '')}</span>
                <span class="pairs__arrow" aria-hidden="true">→</span>
                <span>{String(prompt.answer ?? '')}</span>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </>
  );
}

/**
 * An atom type this build does not render yet — `scenario` and `capstone-step` arrive with
 * Phases 4 and 6. It says so rather than rendering nothing, because a silently blank screen
 * mid-lesson is exactly the anxiety the design principles exist to avoid.
 */
function Unsupported({ atom }: AtomProps) {
  return (
    <>
      <Markdown body={atom.body} />
      <p class="atom__aside">
        <span class="data">{atom.type}</span> atoms are not rendered by this build yet. You
        can move past this one — nothing is lost.
      </p>
    </>
  );
}

const RENDERERS: Partial<Record<Atom['type'], (props: AtomProps) => preact.JSX.Element>> = {
  predict: Predict,
  reading: Reading,
  flashcard: Flashcard,
  quiz: Quiz,
  instructions: Instructions,
  exercise: Exercise,
};

export function AtomView({ atom, hint, nextDifficulty, srsCard, onGrade }: AtomProps) {
  const Renderer = RENDERERS[atom.type] ?? Unsupported;
  return (
    <article class="atom" aria-labelledby={`${atom.id}-title`}>
      <p class="atom__kicker">
        <span class="atom__type">{atom.type}</span>
        {atom.difficulty === 'step-up' && <span class="atom__badge">a step up</span>}
      </p>
      <h2 id={`${atom.id}-title`}>{atom.title}</h2>
      <Renderer atom={atom} hint={hint} nextDifficulty={nextDifficulty} srsCard={srsCard} onGrade={onGrade} />
      <p class="atom__source">
        from <code>{atom.source.path}</code>
        {atom.source.heading ? <code>#{atom.source.heading}</code> : null}
      </p>
    </article>
  );
}
