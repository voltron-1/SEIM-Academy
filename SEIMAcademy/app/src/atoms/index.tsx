import { useState } from 'preact/hooks';
import type { Atom } from '../content/types';
import { Markdown } from './Markdown';
import './atoms.css';

/**
 * One shared renderer per atom type, one atom per screen (#26).
 *
 * Phase 2 renders; **Phase 3 makes them interactive** — the SM-2 scheduler, answer
 * grading, drag-and-drop with its keyboard equivalent, and the test-out check. Reveal
 * buttons here let the pilot module be read start to finish, which is what the Phase 2
 * exit check asks for, without pretending to grade anything.
 *
 * Every payload value is read through a narrow accessor rather than cast: `payload` is
 * `Record<string, unknown>` in the schema, and a lesson from a future generator profile
 * could carry a shape this build has never seen.
 */

interface AtomProps {
  atom: Atom;
  /** Set by the shell's Hint button — reveals whatever this atom type hides. */
  hint?: boolean;
}

const str = (payload: Record<string, unknown>, key: string): string =>
  typeof payload[key] === 'string' ? (payload[key] as string) : '';

const list = (payload: Record<string, unknown>, key: string): unknown[] =>
  Array.isArray(payload[key]) ? (payload[key] as unknown[]) : [];

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

function Flashcard({ atom, hint }: AtomProps) {
  return (
    <>
      <p class="atom__front data">{str(atom.payload, 'front')}</p>
      <Reveal label="Show the answer" forceOpen={hint}>
        <p class="atom__back">{str(atom.payload, 'back')}</p>
      </Reveal>
      {atom.srs && !atom.srs.eligible && (
        <p class="atom__aside">
          Not in the review deck — {atom.srs.reason.replace(/-/g, ' ')}. It still plays here;
          it just never enters spaced repetition.
        </p>
      )}
    </>
  );
}

function Quiz({ atom, hint }: AtomProps) {
  const choices = list(atom.payload, 'choices').filter((c): c is string => typeof c === 'string');
  const answerIndex = typeof atom.payload.answer_index === 'number' ? atom.payload.answer_index : -1;
  return (
    <>
      <p class="atom__prompt">{str(atom.payload, 'question')}</p>
      <ol class="choices">
        {choices.map((choice, i) => (
          <li key={i} class="choices__item data">
            {choice}
          </li>
        ))}
      </ol>
      <Reveal label="Show the answer" forceOpen={hint}>
        <p>
          <strong class="data">{choices[answerIndex] ?? '—'}</strong>
        </p>
        <p class="atom__aside">{str(atom.payload, 'rationale')}</p>
      </Reveal>
      <p class="atom__aside">Answering is Phase 3. Reading it through works now.</p>
    </>
  );
}

function Instructions({ atom }: AtomProps) {
  const notice = str(atom.payload, 'step_up_notice');
  return (
    <dl class="instructions">
      {notice && <p class="atom__stepup">{notice}</p>}
      <dt>Goal</dt>
      <dd>{str(atom.payload, 'goal')}</dd>
      <dt>What you'll use</dt>
      <dd>{str(atom.payload, 'what_youll_use')}</dd>
      <dt>How you'll know you're done</dt>
      <dd>{str(atom.payload, 'done_when')}</dd>
    </dl>
  );
}

function Exercise({ atom, hint }: AtomProps) {
  const format = str(atom.payload, 'format');
  return (
    <>
      <Markdown body={atom.body} />
      <p class="atom__aside">
        <span class="data">{format}</span> · interaction arrives in Phase 3. The material is
        below so the lesson reads end to end.
      </p>
      <Reveal label="Show the pairs" forceOpen={hint}>
        {format === 'match' && (
          <ul class="pairs">
            {list(atom.payload, 'pairs').map((p, i) => {
              const pair = p as { left?: unknown; right?: unknown };
              return (
                <li key={i}>
                  <span class="data">{String(pair.left ?? '')}</span>
                  <span class="pairs__arrow" aria-hidden="true">→</span>
                  <span>{String(pair.right ?? '')}</span>
                </li>
              );
            })}
          </ul>
        )}
        {format === 'drag-classify' && (
          <ul class="pairs">
            {list(atom.payload, 'items').map((it, i) => {
              const item = it as { label?: unknown; bucket?: unknown };
              return (
                <li key={i}>
                  <span>{String(item.label ?? '')}</span>
                  <span class="pairs__arrow" aria-hidden="true">→</span>
                  <span class="data">{String(item.bucket ?? '')}</span>
                </li>
              );
            })}
          </ul>
        )}
        {format === 'lookup-drill' && (
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
        )}
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

export function AtomView({ atom, hint }: AtomProps) {
  const Renderer = RENDERERS[atom.type] ?? Unsupported;
  return (
    <article class="atom" aria-labelledby={`${atom.id}-title`}>
      <p class="atom__kicker">
        <span class="atom__type">{atom.type}</span>
        {atom.difficulty === 'step-up' && <span class="atom__badge">a step up</span>}
      </p>
      <h2 id={`${atom.id}-title`}>{atom.title}</h2>
      <Renderer atom={atom} hint={hint} />
      <p class="atom__source">
        from <code>{atom.source.path}</code>
        {atom.source.heading ? <code>#{atom.source.heading}</code> : null}
      </p>
    </article>
  );
}
