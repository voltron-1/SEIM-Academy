import { useState } from 'preact/hooks';
import type { Atom } from '../content/types';
import { str, list } from './payload';
import { Feedback } from './Feedback';
import './Quiz.css';

/**
 * Multiple-choice and fill-in-the-blank concept checks (#36).
 *
 * BUILD-PLAN: "Immediate inline feedback, never a separate results page." The answer and
 * its rationale appear below the question, in place, and the learner moves on with the
 * normal Continue button.
 *
 * **Answering is once.** Re-answering with the correct answer already on screen tests
 * nothing, and a retry loop invites the "get it right before moving on" pressure the
 * anxiety-safe rules exist to remove. A miss costs nothing and is not recorded anywhere.
 *
 * **The rationale shows either way.** §4.4 generates it from the source Description cell
 * and requires it to cite the row it came from, so it is the teaching content rather than a
 * consolation prize — a learner who guessed right would otherwise learn nothing.
 */

/** Trimmed, case-folded, internal whitespace collapsed. */
const normalise = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

interface QuizProps {
  atom: Atom;
  /** Set by the shell's Hint button — shows the answer without recording one. */
  hint?: boolean;
}

export function Quiz({ atom, hint }: QuizProps) {
  const format = str(atom.payload, 'format');
  const question = str(atom.payload, 'question');
  const rationale = str(atom.payload, 'rationale');

  const choices = list(atom.payload, 'choices').filter((c): c is string => typeof c === 'string');
  const answerIndex = typeof atom.payload.answer_index === 'number' ? atom.payload.answer_index : -1;
  const blankAnswer = str(atom.payload, 'blank_answer');
  const accepted = list(atom.payload, 'accepted').filter((a): a is string => typeof a === 'string');

  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [answered, setAnswered] = useState(false);

  const isBlank = format === 'fill-blank';
  const answerText = isBlank ? blankAnswer : (choices[answerIndex] ?? '');

  const correct = isBlank
    ? [blankAnswer, ...accepted].some((a) => normalise(a) === normalise(typed))
    : picked === answerIndex;

  // An empty submission is not an answer. Grading one would settle the question on a
  // learner who has not answered it yet.
  const hasAttempt = isBlank ? normalise(typed).length > 0 : picked !== null;
  const settled = answered || hint === true;

  const fieldId = `${atom.id}-blank`;

  return (
    <div class="quiz">
      <fieldset class="quiz__group" disabled={settled}>
        <legend class="quiz__question">{question}</legend>

        {isBlank ? (
          <p class="quiz__blank">
            <label for={fieldId}>Your answer</label>
            <input
              id={fieldId}
              type="text"
              class="quiz__input data"
              autocomplete="off"
              value={typed}
              disabled={settled}
              onInput={(e) => setTyped((e.target as HTMLInputElement).value)}
            />
          </p>
        ) : (
          <ul class="choices">
            {choices.map((choiceText, i) => (
              <li key={i} class="choices__item">
                <label class="choices__label">
                  <input
                    type="radio"
                    name={`${atom.id}-choice`}
                    value={String(i)}
                    checked={picked === i}
                    disabled={settled}
                    onChange={() => setPicked(i)}
                  />
                  <span class="data">{choiceText}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>

      {!settled && (
        <button
          type="button"
          class="quiz__check"
          onClick={() => {
            if (hasAttempt) setAnswered(true);
          }}
        >
          Check answer
        </button>
      )}

      {settled && (
        <Feedback
          /* A hint states the answer without claiming the learner got it. */
          correct={answered && correct}
          headline={
            answered && correct ? "That's right." : `The answer is ${answerText}.`
          }
          rationale={rationale}
        />
      )}
    </div>
  );
}
