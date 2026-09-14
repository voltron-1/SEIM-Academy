import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { Flashcard } from './Flashcard';
import { assertNoA11yViolations } from '../test/a11y';
import { newCard } from '../state/srs';
import type { Atom } from '../content/types';

afterEach(cleanup);

const flashcard = (over: Partial<Atom> = {}): Atom => ({
  id: 'f-1',
  type: 'flashcard',
  title: 'Event ID 4624',
  body: '',
  source: { path: 'Logging/Notable-Event-IDs-Sigma.md', heading: 'Security' },
  teaches: ['event:4624'],
  estimated_seconds: 30,
  graded: false,
  srs: { eligible: true, deck: 'windows-event-triage', reason: 'evidence-set' },
  payload: { front: 'What does Security 4624 record?', back: 'A successful account logon.' },
  ...over,
});

const card = () => newCard('f-1', 'windows-event-triage', ['event:4624'], '2026-01-01');

// ---------------------------------------------------------------------------
// Reveal before grade
// ---------------------------------------------------------------------------

test('the answer is hidden until the learner asks for it', () => {
  render(<Flashcard atom={flashcard()} card={card()} onGrade={() => {}} />);
  assert.ok(screen.getByText('What does Security 4624 record?'));
  assert.equal(screen.queryByText('A successful account logon.'), null);
});

test('grading is not offered before the answer is seen', () => {
  // Grading a card you have not turned over is not a self-assessment of anything.
  render(<Flashcard atom={flashcard()} card={card()} onGrade={() => {}} />);
  assert.equal(screen.queryByRole('button', { name: /Good/ }), null);
});

test('the shell Hint button reveals the answer too', () => {
  // Hint is rendered once by the shell (#29) and must reach whatever atom is on screen.
  render(<Flashcard atom={flashcard()} card={card()} onGrade={() => {}} hint />);
  assert.ok(screen.getByText('A successful account logon.'));
});

// ---------------------------------------------------------------------------
// Grading
// ---------------------------------------------------------------------------

test('the four grades map to the SM-2 values they claim', async () => {
  const graded: number[] = [];
  const user = userEvent.setup();
  render(<Flashcard atom={flashcard()} card={card()} onGrade={(q) => graded.push(q)} hint />);

  for (const label of [/Again/, /Hard/, /Good/, /Easy/]) {
    await user.click(screen.getByRole('button', { name: label }));
  }
  assert.deepEqual(graded, [1, 3, 4, 5]);
});

test('no grade button blames the learner', () => {
  // Anxiety-safe principle 3: neutral, non-punitive copy. "Again" describes what happens
  // next; "Wrong" grades the person.
  render(<Flashcard atom={flashcard()} card={card()} onGrade={() => {}} hint />);
  const copy = document.body.textContent ?? '';
  for (const word of ['Wrong', 'Incorrect', 'Fail', 'Failed']) {
    assert.equal(copy.includes(word), false, `"${word}" appears in the grading copy`);
  }
});

test('each grade says when the card comes back, before it is chosen', () => {
  // No hidden state: the consequence of a button is visible before it is pressed.
  render(<Flashcard atom={flashcard()} card={card()} onGrade={() => {}} hint />);
  assert.ok(screen.getByRole('button', { name: /Again.*1 day/ }));
  assert.ok(screen.getByRole('button', { name: /Good.*1 day/ }));
});

test('a card already through its first review previews a longer interval', () => {
  const second = { ...card(), repetitions: 1, intervalDays: 1 };
  render(<Flashcard atom={flashcard()} card={second} onGrade={() => {}} hint />);
  assert.ok(screen.getByRole('button', { name: /Good.*6 days/ }));
  assert.ok(screen.getByRole('button', { name: /Again.*1 day/ }), 'a lapse always comes back tomorrow');
});

test('an ineligible card plays as a reveal and never offers a grade', () => {
  // §6.5: an ineligible flashcard is still a real atom. It just never enters the scheduler.
  const atom = flashcard({ srs: { eligible: false, deck: 'windows-event-triage', reason: 'duplicate-event' } });
  render(<Flashcard atom={atom} card={undefined} onGrade={() => {}} hint />);
  assert.ok(screen.getByText('A successful account logon.'));
  assert.equal(screen.queryByRole('button', { name: /Good/ }), null);
  assert.ok(screen.getByText(/duplicate event/));
});

// ---------------------------------------------------------------------------
// Keyboard. No mouse event appears anywhere in this section.
// ---------------------------------------------------------------------------

test('the whole card is operable with the keyboard alone', async () => {
  const graded: number[] = [];
  const user = userEvent.setup();
  render(<Flashcard atom={flashcard()} card={card()} onGrade={(q) => graded.push(q)} />);

  await user.tab();
  assert.equal(document.activeElement?.textContent, 'Show the answer', 'reveal is the first tab stop');

  await user.keyboard('{Enter}');
  assert.ok(screen.getByText('A successful account logon.'), 'Enter did not reveal the answer');

  await user.tab();
  await user.tab();
  await user.tab();
  await user.keyboard('{Enter}');

  assert.deepEqual(graded, [4], 'the third grade button after reveal is Good');
});

test('revealing leaves focus on a control that still exists', async () => {
  const user = userEvent.setup();
  render(<Flashcard atom={flashcard()} card={card()} onGrade={() => {}} />);

  await user.tab();
  await user.keyboard('{Enter}');

  assert.ok(
    document.activeElement && document.activeElement !== document.body,
    'focus was left on a button that no longer exists, so the next Tab restarts at the top'
  );
});

test('the answer is announced, not silently swapped in', async () => {
  // A screen reader user pressing Show the answer gets nothing if the region is inert.
  const user = userEvent.setup();
  render(<Flashcard atom={flashcard()} card={card()} onGrade={() => {}} />);
  await user.tab();
  await user.keyboard('{Enter}');

  const live = document.querySelector('[aria-live]');
  assert.ok(live, 'no live region around the revealed answer');
  assert.ok(live!.textContent?.includes('A successful account logon.'));
});

test('the grades are not distinguished by colour alone', () => {
  render(<Flashcard atom={flashcard()} card={card()} onGrade={() => {}} hint />);
  for (const label of [/Again/, /Hard/, /Good/, /Easy/]) {
    const button = screen.getByRole('button', { name: label });
    const text = button.textContent?.replace(/[^A-Za-z]/g, '');
    assert.ok(text && text.length > 0, 'a grade button carries no text of its own');
  }
});

// ---------------------------------------------------------------------------
// axe
// ---------------------------------------------------------------------------

test('no axe violations before the reveal', async () => {
  const { container } = render(<Flashcard atom={flashcard()} card={card()} onGrade={() => {}} />);
  await assertNoA11yViolations(container);
});

test('no axe violations with the answer and grades showing', async () => {
  const { container } = render(<Flashcard atom={flashcard()} card={card()} onGrade={() => {}} hint />);
  await assertNoA11yViolations(container);
});

test('a card whose ineligibility reason is missing still renders', () => {
  // Lesson JSON is fetched and cast without runtime validation, and there is no error
  // boundary in the app, so an unguarded deref here blanks the whole screen rather than
  // degrading one atom.
  const atom = flashcard({ srs: { eligible: false, deck: 'd' } as Atom['srs'] });
  render(<Flashcard atom={atom} card={undefined} onGrade={() => {}} hint />);
  assert.ok(screen.getByText('A successful account logon.'));
  assert.equal(document.body.textContent?.includes('undefined'), false);
});
