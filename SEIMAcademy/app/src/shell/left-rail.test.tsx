import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup } from '@testing-library/preact';
import { LeftRail } from './LeftRail';
import { SessionProvider } from '../state/session';
import { assertNoA11yViolations } from '../test/a11y';
import { STORAGE_KEY, emptyState, putSrsCard, dayKey } from '../state/persistence';
import { newCard } from '../state/srs';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

/** Seeds persisted state the way a previous session would have left it. */
const seedDue = (dueDays: string[]) => {
  let state = emptyState();
  dueDays.forEach((dueDay, i) => {
    state = putSrsCard(state, { ...newCard(`c-${i}`, 'deck', ['t']), dueDay });
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const renderRail = () =>
  render(
    <SessionProvider>
      <LeftRail />
    </SessionProvider>
  );

test('Review carries today s due count, so accountability is ambient', () => {
  // BUILD-PLAN: the due count in the rail is the mechanism "instead of a
  // calendar/syllabus". It has to be readable without opening anything.
  const today = dayKey();
  seedDue([today, today, '2999-01-01']);
  renderRail();

  const review = screen.getByRole('link', { name: /Review/ });
  assert.match(review.textContent ?? '', /2/, 'the two due cards are not counted in the rail');
  assert.doesNotMatch(review.textContent ?? '', /3/, 'a card due in the future was counted as due');
});

test('the count is part of the link s accessible name, not a bare number beside it', () => {
  // A screen reader reading "Review" and then "2" in isolation conveys nothing.
  seedDue([dayKey()]);
  renderRail();
  assert.ok(screen.getByRole('link', { name: /Review.*1 card due/ }));
});

test('nothing due shows no badge at all', () => {
  // An empty queue rendered as "0" is a zero staring at a learner every day they are
  // caught up, which is the opposite of what the counter is for.
  seedDue(['2999-01-01']);
  renderRail();
  const review = screen.getByRole('link', { name: /Review/ });
  assert.equal(review.querySelector('.rail__badge'), null);
  assert.doesNotMatch(review.textContent ?? '', /0/);
});

test('no axe violations with a badge showing', async () => {
  seedDue([dayKey(), dayKey()]);
  const { container } = renderRail();
  await assertNoA11yViolations(container);
});
