/**
 * Test-out question selection (#38) — pure logic, no Preact, same posture as `srs.ts`.
 *
 * BUILD-PLAN: "A short, optional check (3–5 generation-format questions covering that
 * module's teaches tags) skips the atom queue if passed."
 *
 * **Questions come from the module's flashcards, not its quiz atoms.** Checked against the
 * actual built content before writing this: every generated quiz atom is `multiple-choice`
 * with no `teaches` tag at all — there is nothing to gate on and multiple-choice is
 * recognition, not generation. Flashcards already carry `teaches` and are generation-format
 * by construction: recall the back, never pick from options. This is a content-pipeline gap,
 * not something this module works around — it is a fact about the input, stated here rather
 * than hidden behind a selection that quietly does something else.
 */

import type { Atom } from '../content/types';

export const MIN_TESTOUT_QUESTIONS = 3;
export const MAX_TESTOUT_QUESTIONS = 5;

/** Only SRS-eligible flashcards — an atom §6.5 keeps out of spaced repetition stays out here too. */
export const eligibleTestOutAtoms = (atoms: Atom[]): Atom[] =>
  atoms.filter((atom) => atom.type === 'flashcard' && atom.srs?.eligible === true);

/**
 * Greedy set-cover over `teaches` tags, deterministic by construction — no shuffle, the same
 * rule `buildReviewQueue` follows and for the same reason: a selection that reorders itself
 * cannot be tested and cannot be trusted to mean the same thing twice.
 *
 * At each step the card that adds the most not-yet-covered tags wins; ties keep source
 * order. Stops at `MAX_TESTOUT_QUESTIONS`, or earlier once nothing left would add new
 * coverage **and** the minimum is already met — padding the count with a redundant card
 * would test the same thing twice under a check whose whole point is breadth.
 *
 * Returns an empty array short of `MIN_TESTOUT_QUESTIONS` eligible cards: a check with two
 * questions is not the check the spec describes, and a caller offering it anyway would be
 * offering something smaller than what "test out" promises.
 */
export function selectTestOutQuestions(atoms: Atom[]): Atom[] {
  const remaining = eligibleTestOutAtoms(atoms);
  const covered = new Set<string>();
  const chosen: Atom[] = [];

  while (chosen.length < MAX_TESTOUT_QUESTIONS && remaining.length > 0) {
    let bestIndex = 0;
    let bestNewTags = -1;

    for (let i = 0; i < remaining.length; i++) {
      const newTags = (remaining[i]!.teaches ?? []).filter((tag) => !covered.has(tag)).length;
      if (newTags > bestNewTags) {
        bestNewTags = newTags;
        bestIndex = i;
      }
    }

    // Below the minimum, a zero-new-coverage card is still taken deliberately — padding to
    // MIN_TESTOUT_QUESTIONS with a redundant card is better than a check with two questions.
    if (bestNewTags <= 0 && chosen.length >= MIN_TESTOUT_QUESTIONS) break;

    const [card] = remaining.splice(bestIndex, 1);
    chosen.push(card!);
    for (const tag of card!.teaches ?? []) covered.add(tag);
  }

  return chosen.length >= MIN_TESTOUT_QUESTIONS ? chosen : [];
}
