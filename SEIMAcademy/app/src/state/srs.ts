/**
 * Spaced repetition — SM-2, plus the topic-diversity window (#35).
 *
 * Pure logic, no Preact and no storage, for the same reason session-core.ts is: the
 * scheduler is the one piece of Phase 3 with a published specification behind it, so
 * "does it implement SM-2" should be a question with a test rather than an opinion.
 *
 * BUILD-PLAN: "Spaced repetition instead of cramming... standard SM-2, per-learner state
 * stored locally" and "Interleaved retrieval, not blocked practice. Never drill one topic
 * ten-in-a-row."  Those are two separate mechanisms and they live in two separate
 * functions here — `review()` decides *when* a card comes back, `buildReviewQueue()`
 * decides *in what order* the cards that are already due get asked.
 */

import { dayKey } from './persistence';
import type { Atom } from '../content/types';

/** SuperMemo's starting easiness factor. */
export const INITIAL_EASE = 2.5;
/** The published floor. Below it, intervals collapse and a card is asked forever. */
export const MIN_EASE = 1.3;

/**
 * Bounds the algorithm itself never needs — SM-2 has no ceiling and no maximum interval.
 * They exist so persisted state that has been hand-edited or has drifted cannot schedule a
 * card past the end of time. A hundred years is far beyond any real schedule and still far
 * short of the overflow that produces an Invalid Date.
 */
export const MAX_EASE = 5;
export const MAX_INTERVAL_DAYS = 36500;
export const FIRST_INTERVAL_DAYS = 1;
export const SECOND_INTERVAL_DAYS = 6;

/**
 * Minimum distance between two cards that share a `teaches` tag.
 *
 * Three means at least two unrelated cards separate any two on the same topic, which is
 * enough to make recall require distinguishing which concept applies rather than riding
 * the momentum of the previous answer.
 */
export const DEFAULT_DIVERSITY_WINDOW = 3;

export interface SrsCard {
  /** The flashcard atom this state belongs to. Content-derived and stable (§6.8). */
  atomId: string;
  /** From `atom.srs.deck` — which module's review deck this card belongs to. */
  deck: string;
  /** The atom's `teaches` tags, which are what the diversity window separates on. */
  teaches: string[];
  ease: number;
  intervalDays: number;
  /** Consecutive successful reviews. A lapse sets it back to zero, not to one. */
  repetitions: number;
  dueDay: string;
  /** All-time count of lapses, so a persistently hard card is visible later. */
  lapses: number;
}

export const newCard = (atomId: string, deck: string, teaches: string[], today: string = dayKey()): SrsCard => ({
  atomId,
  deck,
  teaches: [...teaches],
  ease: INITIAL_EASE,
  intervalDays: 0,
  repetitions: 0,
  // A card the learner has never seen is due now; nothing is gained by making them wait.
  dueDay: today,
  lapses: 0,
});

/** A grade below this is a lapse. SuperMemo's own threshold. */
const PASS_GRADE = 3;

const clampGrade = (grade: number): number => Math.min(5, Math.max(0, Math.round(grade)));

/**
 * Ease is stored to two decimals.
 *
 * `2.5 + (0.1 - 3 * (0.08 + 3 * 0.02))` is 2.1799999999999997 in binary floating point.
 * Left unrounded, drift accumulates across a card's lifetime and persisted state stops
 * comparing equal to the same card computed fresh. Two decimals is more precision than
 * the algorithm's 0.02 granularity needs.
 */
const roundEase = (ease: number): number => Math.round(ease * 100) / 100;

const nextEase = (ease: number, grade: number): number =>
  Math.max(MIN_EASE, roundEase(ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))));

/**
 * Calendar arithmetic, not 24-hour arithmetic: an interval is in days a learner sees.
 *
 * An unusable date returns the day it was given rather than a "NaN-NaN-NaN" key. That
 * string sorts above every real ISO date, so a card carrying one would never be due again
 * — the silent disappearance buildReviewQueue's contract exists to prevent. Persisted
 * input is already bounded on load; this is the second wall.
 */
const addDays = (day: string, days: number): string => {
  if (!Number.isFinite(days)) return day;
  const [year, month, date] = day.split('-').map(Number);
  const d = new Date(year!, month! - 1, date!);
  d.setDate(d.getDate() + days);
  return Number.isNaN(d.getTime()) ? day : dayKey(d);
};

/**
 * What the next interval would be for a given grade, without scheduling anything.
 *
 * The grade buttons show a learner what each choice will do before they press it, and
 * rendering a label should not mean calling the function that moves a card's due date.
 */
export function nextInterval(card: SrsCard, grade: number): number {
  const q = clampGrade(grade);
  if (q < PASS_GRADE) return FIRST_INTERVAL_DAYS;
  if (card.repetitions === 0) return FIRST_INTERVAL_DAYS;
  if (card.repetitions === 1) return SECOND_INTERVAL_DAYS;
  return Math.min(MAX_INTERVAL_DAYS, Math.round(card.intervalDays * card.ease));
}

/**
 * Grade one review and return the card's new state.
 *
 * **The order is interval first, then ease** — that is how SM-2 is published, and it means
 * a grade's effect on the ease lands on the *next* interval rather than this one. Updating
 * ease first and multiplying by the new value is a different algorithm wearing the same
 * name; it produces 17 where the specification says 16.
 *
 * Ease is updated on every review including lapses. The repetition count is what a lapse
 * resets, not the ease: a card that was hard stays hard, so it climbs back at its own
 * earned pace rather than at a beginner's.
 *
 * Scheduling runs from `today` — the day the review actually happened — so a learner who
 * comes back after a month away does not find the card instantly due again because its
 * schedule ran from the day it was missed.
 */
export function review(card: SrsCard, grade: number, today: string = dayKey()): SrsCard {
  const q = clampGrade(grade);
  const passed = q >= PASS_GRADE;
  const intervalDays = nextInterval(card, q);

  return {
    ...card,
    intervalDays,
    repetitions: passed ? card.repetitions + 1 : 0,
    ease: nextEase(card.ease, q),
    dueDay: addDays(today, intervalDays),
    lapses: passed ? card.lapses : card.lapses + 1,
  };
}

/**
 * The scheduler state for an atom, creating it on first sight.
 *
 * `undefined` for anything that does not belong in the scheduler: a non-flashcard, and an
 * `srs.eligible === false` flashcard, which §6.5 keeps as a real atom that plays as a
 * front/back reveal and never enters spaced repetition.
 *
 * An existing card is returned untouched. Rebuilding it here would wipe a learner's
 * schedule every time they reopened the lesson the card came from.
 */
export function cardForAtom(atom: Atom, existing?: SrsCard, today: string = dayKey()): SrsCard | undefined {
  if (existing) return existing;
  if (atom.type !== 'flashcard' || !atom.srs?.eligible) return undefined;
  return newCard(atom.id, atom.srs.deck, atom.teaches ?? [], today);
}

/** Due means due today or overdue. Day keys are ISO, so a string compare is a date compare. */
export const cardsDue = (cards: SrsCard[], today: string = dayKey()): SrsCard[] =>
  cards.filter((card) => card.dueDay <= today);

const shareTopic = (a: SrsCard, b: SrsCard): boolean => a.teaches.some((tag) => b.teaches.includes(tag));

/**
 * Order the due cards so no two on the same topic land within `window` positions.
 *
 * **The window never drops a card.** When nothing left satisfies it, the queue takes the
 * card whose nearest same-topic neighbour is furthest back rather than deferring it to
 * tomorrow. A due card quietly leaving the queue is a retention bug that surfaces months
 * later as a gap the learner cannot see — the same failure shape as a silently truncated
 * deck (app-data-schema.md §6.5). A deck with one topic in it is drilled in order, which is
 * the honest outcome; the alternative is an empty queue.
 *
 * Deterministic by construction — no shuffle. A queue that reorders itself on re-render
 * moves a card out from under a learner mid-session, and cannot be tested at all.
 */
export function buildReviewQueue(cards: SrsCard[], options: { window?: number } = {}): SrsCard[] {
  const window = options.window ?? DEFAULT_DIVERSITY_WINDOW;
  const remaining = [...cards];
  const queue: SrsCard[] = [];

  /** How far back the nearest already-queued card sharing a tag is; Infinity if none. */
  const conflictDistance = (candidate: SrsCard): number => {
    // Bounded at the window: the caller only ever asks whether a conflict is *closer than*
    // the window, so scanning further back changes no decision and turns the whole
    // function from O(n^2) into O(n * window) over the queue.
    for (let back = 1; back <= Math.min(window, queue.length); back++) {
      if (shareTopic(candidate, queue[queue.length - back]!)) return back;
    }
    return Infinity;
  };

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = -1;

    for (let i = 0; i < remaining.length; i++) {
      const distance = conflictDistance(remaining[i]!);
      // The first card that clears the window wins, which keeps the original order
      // wherever the constraint allows it.
      if (distance >= window) {
        bestIndex = i;
        break;
      }
      if (distance > bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    queue.push(remaining.splice(bestIndex, 1)[0]!);
  }

  return queue;
}
