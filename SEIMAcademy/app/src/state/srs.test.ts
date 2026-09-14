import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newCard,
  review,
  cardsDue,
  buildReviewQueue,
  INITIAL_EASE,
  MIN_EASE,
  FIRST_INTERVAL_DAYS,
  SECOND_INTERVAL_DAYS,
  DEFAULT_DIVERSITY_WINDOW,
  cardForAtom,
  nextInterval,
  type SrsCard,
} from './srs';
import type { Atom } from '../content/types';

const card = (over: Partial<SrsCard> = {}): SrsCard => ({ ...newCard('a-1', 'security', ['event:4624']), ...over });

/** Replays a grade sequence from a fresh card, returning the interval after each review. */
const intervals = (grades: number[]): number[] => {
  let c = card();
  let day = '2026-01-01';
  return grades.map((q) => {
    c = review(c, q, day);
    day = c.dueDay;
    return c.intervalDays;
  });
};

const eases = (grades: number[]): number[] => {
  let c = card();
  return grades.map((q) => {
    c = review(c, q, '2026-01-01');
    return c.ease;
  });
};

// ---------------------------------------------------------------------------
// SM-2, against the published sequences. These are the assertions that make this
// component a question with an answer rather than an opinion.
// ---------------------------------------------------------------------------

test('a perfectly neutral grade produces the canonical 1, 6, 15, 38, 95 schedule', () => {
  // q=4 is the one grade whose ease adjustment is exactly zero, so ease stays 2.5
  // throughout and the intervals are the specification's own worked example.
  assert.deepEqual(intervals([4, 4, 4, 4, 4]), [1, 6, 15, 38, 95]);
});

test('q=4 leaves ease exactly where it started', () => {
  assert.deepEqual(eases([4, 4, 4]), [INITIAL_EASE, INITIAL_EASE, INITIAL_EASE]);
});

test('the interval uses the ease in effect, not the ease this grade produces', () => {
  // The published order is interval first, then ease. Updating ease first and then
  // multiplying yields 17 and 47 here — a different algorithm with the same name.
  assert.deepEqual(intervals([5, 5, 5, 5]), [1, 6, 16, 45]);
});

test('a lapse resets the repetition count but not the ease', () => {
  // 4,4 climbs to 6. The 2 drops the card to 1 and the ease to 2.18. It then climbs
  // 1 -> 6 -> 13, where an implementation that also reset the ease would say 15.
  assert.deepEqual(intervals([4, 4, 2, 4, 4, 4]), [1, 6, 1, 1, 6, 13]);
});

test('ease floors at 1.3 instead of falling through zero', () => {
  assert.deepEqual(eases([0, 0, 0]), [1.7, MIN_EASE, MIN_EASE]);
});

test('a lapse is counted, so a persistently hard card is visible later', () => {
  let c = card();
  c = review(c, 4, '2026-01-01');
  assert.equal(c.lapses, 0);
  c = review(c, 1, '2026-01-02');
  assert.equal(c.lapses, 1);
});

test('the due day is the review day plus the new interval', () => {
  const first = review(card(), 4, '2026-01-01');
  assert.equal(first.intervalDays, FIRST_INTERVAL_DAYS);
  assert.equal(first.dueDay, '2026-01-02');

  const second = review(first, 4, '2026-01-02');
  assert.equal(second.intervalDays, SECOND_INTERVAL_DAYS);
  assert.equal(second.dueDay, '2026-01-08');
});

test('the due day crosses a month boundary by calendar, not by 30-day arithmetic', () => {
  const c = review(card(), 4, '2026-01-31');
  assert.equal(c.dueDay, '2026-02-01');
});

test('grading a card late schedules from the day it was actually reviewed', () => {
  // A learner who disappears for a month and comes back should not find the card due
  // again immediately because the schedule ran from the day it was missed.
  const due = review(card(), 4, '2026-01-01');
  const late = review(due, 4, '2026-03-01');
  assert.equal(late.dueDay, '2026-03-07');
});

test('a grade outside 0..5 is clamped rather than corrupting the ease', () => {
  assert.equal(review(card(), 9, '2026-01-01').ease, review(card(), 5, '2026-01-01').ease);
  assert.equal(review(card(), -3, '2026-01-01').ease, review(card(), 0, '2026-01-01').ease);
});

// ---------------------------------------------------------------------------
// Due selection
// ---------------------------------------------------------------------------

test('a card due today or overdue is in the queue; a future one is not', () => {
  const cards = [
    card({ atomId: 'yesterday', dueDay: '2026-01-01' }),
    card({ atomId: 'today', dueDay: '2026-01-02' }),
    card({ atomId: 'tomorrow', dueDay: '2026-01-03' }),
  ];
  assert.deepEqual(
    cardsDue(cards, '2026-01-02').map((c) => c.atomId),
    ['yesterday', 'today']
  );
});

// ---------------------------------------------------------------------------
// Topic-diversity window: "never drill one topic ten-in-a-row"
// ---------------------------------------------------------------------------

const tagged = (atomId: string, teaches: string[]): SrsCard => newCard(atomId, 'security', teaches);

/** The property the window exists to enforce, checked directly against the output. */
const closestRepeatDistance = (queue: SrsCard[]): number => {
  let closest = Infinity;
  for (let i = 0; i < queue.length; i++) {
    for (let j = i + 1; j < queue.length; j++) {
      if (queue[i]!.teaches.some((t) => queue[j]!.teaches.includes(t))) {
        closest = Math.min(closest, j - i);
        break;
      }
    }
  }
  return closest;
};

test('cards sharing a topic are pushed at least the window apart', () => {
  const cards = [
    tagged('logon-1', ['event:4624']),
    tagged('logon-2', ['event:4624']),
    tagged('logon-3', ['event:4624']),
    tagged('proc-1', ['event:4688']),
    tagged('proc-2', ['event:4688']),
    tagged('svc-1', ['event:7045']),
    tagged('svc-2', ['event:7045']),
  ];
  const queue = buildReviewQueue(cards);
  assert.ok(
    closestRepeatDistance(queue) >= DEFAULT_DIVERSITY_WINDOW,
    `two cards on the same topic landed ${closestRepeatDistance(queue)} apart, inside the window`
  );
});

test('the unshuffled order would fail the same check', () => {
  // Proves the assertion above can fail. A gate nobody has watched fire is not a gate.
  const blocked = [
    tagged('logon-1', ['event:4624']),
    tagged('logon-2', ['event:4624']),
    tagged('proc-1', ['event:4688']),
  ];
  assert.equal(closestRepeatDistance(blocked), 1);
});

test('a deck with only one topic still returns every card', () => {
  // The window is a preference. Dropping a due card to satisfy it would be a retention
  // bug that surfaces months later as a gap in the queue.
  const cards = ['a', 'b', 'c', 'd', 'e'].map((id) => tagged(id, ['event:4624']));
  const queue = buildReviewQueue(cards);
  assert.deepEqual(
    queue.map((c) => c.atomId).sort(),
    ['a', 'b', 'c', 'd', 'e'],
    'every due card must survive the reorder'
  );
});

test('the queue is a permutation of its input, never a filter', () => {
  const cards = [
    tagged('a', ['t1', 'shared']),
    tagged('b', ['t2', 'shared']),
    tagged('c', ['t3']),
    tagged('d', ['t1']),
    tagged('e', ['shared']),
  ];
  const queue = buildReviewQueue(cards);
  assert.equal(queue.length, cards.length);
  assert.deepEqual(queue.map((c) => c.atomId).sort(), ['a', 'b', 'c', 'd', 'e']);
});

test('the same deck always produces the same queue', () => {
  // No Math.random: a queue that reorders itself on re-render moves a card out from
  // under a learner mid-session, and cannot be tested at all.
  const cards = [
    tagged('a', ['t1']),
    tagged('b', ['t1']),
    tagged('c', ['t2']),
    tagged('d', ['t2']),
    tagged('e', ['t3']),
  ];
  assert.deepEqual(buildReviewQueue(cards).map((c) => c.atomId), buildReviewQueue(cards).map((c) => c.atomId));
});

test('an untagged card never blocks another card', () => {
  // teaches is required on flashcards by the schema, but persisted state can be older
  // than the schema that wrote it. An empty tag list shares a topic with nothing.
  const cards = [tagged('a', []), tagged('b', []), tagged('c', [])];
  assert.equal(buildReviewQueue(cards).length, 3);
});

test('an empty deck is an empty queue, not a crash', () => {
  assert.deepEqual(buildReviewQueue([]), []);
});

// ---------------------------------------------------------------------------
// Binding a card to its atom
// ---------------------------------------------------------------------------

const flashcardAtom = (over: Record<string, unknown> = {}): Atom => ({
  id: 'f-1',
  type: 'flashcard',
  title: 'Event ID 4624',
  body: '',
  source: { path: 'Logging/Notable-Event-IDs-Sigma.md' },
  teaches: ['event:4624'],
  estimated_seconds: 30,
  graded: false,
  srs: { eligible: true, deck: 'windows-event-triage', reason: 'evidence-set' },
  payload: { front: 'f', back: 'b' },
  ...over,
} as Atom);

test('an eligible flashcard seen for the first time gets a card due immediately', () => {
  const c = cardForAtom(flashcardAtom(), undefined, '2026-01-01');
  assert.equal(c?.dueDay, '2026-01-01', 'a card never seen has nothing to wait for');
  assert.equal(c?.deck, 'windows-event-triage');
  assert.deepEqual(c?.teaches, ['event:4624']);
  assert.equal(c?.ease, INITIAL_EASE);
});

test('an ineligible flashcard never enters the scheduler', () => {
  const atom = flashcardAtom({ srs: { eligible: false, deck: 'd', reason: 'duplicate-event' } });
  assert.equal(cardForAtom(atom, undefined, '2026-01-01'), undefined);
});

test('an atom that is not a flashcard has no card', () => {
  assert.equal(cardForAtom(flashcardAtom({ type: 'reading', srs: undefined }), undefined, '2026-01-01'), undefined);
});

test('an existing card keeps its history rather than being reset on sight', () => {
  // Returning a fresh card here would silently wipe a learner's schedule every time they
  // opened the lesson the card came from.
  const existing = { ...newCard('f-1', 'windows-event-triage', ['event:4624'], '2026-01-01'), repetitions: 4, ease: 2.2 };
  assert.deepEqual(cardForAtom(flashcardAtom(), existing, '2026-06-01'), existing);
});

test('an interval can be previewed without scheduling anything', () => {
  // The grade buttons show what each grade will do. Rendering a label should not mean
  // calling the function that moves a card's due date.
  const c = { ...newCard('f-1', 'deck', ['t'], '2026-01-01'), repetitions: 1, intervalDays: 1 };
  assert.equal(nextInterval(c, 4), 6);
  assert.equal(nextInterval(c, 1), 1, 'a lapse always comes back tomorrow');
  assert.deepEqual(c, { ...newCard('f-1', 'deck', ['t'], '2026-01-01'), repetitions: 1, intervalDays: 1 });
});
