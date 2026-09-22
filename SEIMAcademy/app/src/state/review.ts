/**
 * Review route glue (#118) — pure logic, no Preact.
 *
 * `SrsCard` only carries an `atomId` and a `deck` (module id), not the atom's content, so
 * playing the due queue needs a step `buildReviewQueue` itself has no reason to do: turning
 * an ordered list of cards into the atoms a `Flashcard` can actually render. That atom
 * content comes from whichever lessons the caller already fetched — this module just joins
 * the two.
 */

import type { Atom, Lesson } from '../content/types';
import type { SrsCard } from './srs';

export interface ReviewItem {
  atom: Atom;
  card: SrsCard;
}

/**
 * Pairs each queued card with its atom, preserving the queue's order.
 *
 * A card whose atom is not present in `lessons` is dropped rather than thrown on — content
 * can move between a card being scheduled and a learner reviewing it, and losing one stale
 * card from a session is a far smaller failure than crashing the whole queue.
 */
export function resolveQueueItems(queue: SrsCard[], lessons: Lesson[]): ReviewItem[] {
  const atomsById = new Map<string, Atom>();
  for (const lesson of lessons) {
    // Only flashcards: a stale card whose atom id was reused by a later, non-flashcard
    // atom is not the same card any more, and playing it as a blank front/back would
    // silently grade content that was never actually reviewed.
    for (const atom of lesson.atoms) {
      if (atom.type === 'flashcard') atomsById.set(atom.id, atom);
    }
  }

  const items: ReviewItem[] = [];
  for (const card of queue) {
    const atom = atomsById.get(card.atomId);
    if (atom) items.push({ atom, card });
  }
  return items;
}
