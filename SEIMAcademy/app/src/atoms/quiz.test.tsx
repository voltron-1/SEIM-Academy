import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup, fireEvent } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { Quiz } from './Quiz';
import { assertNoA11yViolations } from '../test/a11y';
import type { Atom } from '../content/types';

afterEach(cleanup);

const base = {
  id: 'q-1',
  type: 'quiz' as const,
  title: 'Which channel records a successful logon?',
  body: '',
  source: { path: 'Logging/Notable-Event-IDs-Sigma.md', heading: 'Security' },
  estimated_seconds: 45,
  graded: true,
};

const choice = (payload: Record<string, unknown> = {}): Atom => ({
  ...base,
  payload: {
    format: 'multiple-choice',
    question: 'Which Event ID records a successful account logon?',
    choices: ['4624', '4625', '4634', '4688'],
    answer_index: 0,
    rationale: 'Security 4624 is logged on a successful logon; 4625 is the failure case.',
    ...payload,
  },
});

const blank = (payload: Record<string, unknown> = {}): Atom => ({
  ...base,
  payload: {
    format: 'fill-blank',
    question: 'Which Event ID records a successful account logon?',
    blank_answer: '4624',
    accepted: ['Event ID 4624'],
    rationale: 'Security 4624 is logged on a successful logon.',
    ...payload,
  },
});

const check = () => screen.getByRole('button', { name: /Check/ });

// ---------------------------------------------------------------------------
// Inline feedback, never a separate results page
// ---------------------------------------------------------------------------

test('nothing is graded until the learner asks for it', () => {
  render(<Quiz atom={choice()} />);
  assert.equal(screen.queryByText(/4625 is the failure case/), null);
});

test('a correct answer is confirmed in place, below the question', () => {
  render(<Quiz atom={choice()} />);
  fireEvent.click(screen.getByRole('radio', { name: '4624' }));
  fireEvent.click(check());

  assert.ok(screen.getByText(/right/i), 'no confirmation of a correct answer');
  assert.ok(screen.getByText(/4625 is the failure case/), 'the rationale is missing');
});

test('a wrong answer names the answer rather than the mistake', () => {
  render(<Quiz atom={choice()} />);
  fireEvent.click(screen.getByRole('radio', { name: '4625' }));
  fireEvent.click(check());

  const copy = document.body.textContent ?? '';
  assert.match(copy, /4624/, 'the correct answer is not stated');
  assert.match(copy, /4625 is the failure case/, 'the rationale is missing');
});

test('the rationale shows whether the answer was right or wrong', () => {
  // It is generated from the source Description cell and cites the row it came from, so
  // it is the teaching content. Showing it only on a miss means a lucky guess teaches
  // nothing.
  for (const pick of ['4624', '4625']) {
    render(<Quiz atom={choice()} />);
    fireEvent.click(screen.getByRole('radio', { name: pick }));
    fireEvent.click(check());
    assert.ok(screen.getByText(/4625 is the failure case/), `no rationale after picking ${pick}`);
    cleanup();
  }
});

test('no shame-adjacent copy anywhere in the feedback', () => {
  // BUILD-PLAN: "no shame-adjacent copy, no harsh red flash". Mistakes are informational.
  render(<Quiz atom={choice()} />);
  fireEvent.click(screen.getByRole('radio', { name: '4625' }));
  fireEvent.click(check());

  const copy = document.body.textContent ?? '';
  for (const word of ['Incorrect', 'Wrong', 'Sorry', 'Try again', 'Failed', 'Oops', '!']) {
    assert.equal(copy.includes(word), false, `"${word}" appears in the feedback`);
  }
});

test('answering is once — the check does not come back', () => {
  // A retry loop invites the "get it right before moving on" pressure the anxiety-safe
  // rules exist to remove.
  render(<Quiz atom={choice()} />);
  fireEvent.click(screen.getByRole('radio', { name: '4625' }));
  fireEvent.click(check());

  assert.equal(screen.queryByRole('button', { name: /Check/ }), null);
  assert.equal((screen.getByRole('radio', { name: '4624' }) as HTMLInputElement).disabled, true);
});

test('checking with nothing selected is not an answer', () => {
  render(<Quiz atom={choice()} />);
  fireEvent.click(check());
  assert.ok(screen.queryByRole('button', { name: /Check/ }), 'an empty submission was graded');
});

test('the feedback is announced, not silently inserted', () => {
  render(<Quiz atom={choice()} />);
  fireEvent.click(screen.getByRole('radio', { name: '4624' }));
  fireEvent.click(check());

  const live = document.querySelector('[aria-live]');
  assert.ok(live, 'no live region around the feedback');
  assert.match(live!.textContent ?? '', /4625 is the failure case/);
});

test('correctness is never signalled by colour alone', () => {
  render(<Quiz atom={choice()} />);
  fireEvent.click(screen.getByRole('radio', { name: '4624' }));
  fireEvent.click(check());

  const shape = document.querySelector('.feedback__shape');
  assert.ok(shape, 'no shape alongside the colour');
  assert.equal(shape!.getAttribute('aria-hidden'), 'true', 'the shape is decorative; the text carries it');
  const words = document.querySelector('.feedback')?.textContent?.replace(shape!.textContent ?? '', '').trim();
  assert.ok(words && words.length > 0, 'no text carries the result');
});

test('the question labels the choices as a group', () => {
  // Without a group label, a screen reader reads four bare numbers with no question.
  render(<Quiz atom={choice()} />);
  assert.ok(screen.getByRole('group', { name: /Which Event ID records a successful account logon/ }));
});

// ---------------------------------------------------------------------------
// Fill-in-the-blank
// ---------------------------------------------------------------------------

const answerBlank = async (value: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox'), value);
  await user.click(check());
};

test('a fill-blank answer is matched on content, not on typing exactly', async () => {
  // Losing on capitalisation or a stray space is punitive for no teaching reason.
  for (const typed of ['4624', ' 4624 ', 'event id 4624', 'Event  ID  4624']) {
    render(<Quiz atom={blank()} />);
    await answerBlank(typed);
    assert.ok(screen.getByText(/right/i), `"${typed}" was not accepted`);
    cleanup();
  }
});

test('a genuinely different answer is not accepted', async () => {
  render(<Quiz atom={blank()} />);
  await answerBlank('4625');
  assert.equal(screen.queryByText(/right/i), null, '4625 was accepted for 4624');
  assert.match(document.body.textContent ?? '', /4624/);
});

test('an empty fill-blank submission is not an answer', async () => {
  const user = userEvent.setup();
  render(<Quiz atom={blank()} />);
  await user.click(check());
  assert.ok(screen.queryByRole('button', { name: /Check/ }), 'an empty submission was graded');
});

test('the blank has a real label, not a placeholder standing in for one', async () => {
  render(<Quiz atom={blank()} />);
  const input = screen.getByRole('textbox');
  assert.ok(input.getAttribute('id'), 'no id to associate a label with');
  assert.ok(
    document.querySelector(`label[for="${input.getAttribute('id')}"]`),
    'the input has no associated label element'
  );
});

// ---------------------------------------------------------------------------
// Keyboard and the shell contract
// ---------------------------------------------------------------------------

test('a multiple-choice question is answerable with the keyboard alone', async () => {
  const user = userEvent.setup();
  render(<Quiz atom={choice()} />);

  await user.tab();
  assert.equal((document.activeElement as HTMLInputElement).value, '0', 'the first radio is not the first tab stop');
  await user.keyboard('{ArrowDown}');
  await user.tab();
  await user.keyboard('{Enter}');

  assert.match(document.body.textContent ?? '', /4625 is the failure case/, 'the answer was never checked');
});

test('the shell Hint button reveals the answer without grading it', () => {
  // Hint is rendered once by the shell (#29). Using it is not the same as answering.
  render(<Quiz atom={choice()} hint />);
  assert.match(document.body.textContent ?? '', /4624/);
  assert.equal(screen.queryByText(/right/i), null, 'a hint was recorded as a correct answer');
});

test('an unknown quiz format still renders the question rather than a blank screen', () => {
  render(<Quiz atom={choice({ format: 'ranked-choice' })} />);
  assert.ok(screen.getByText(/Which Event ID records a successful account logon/));
});

// ---------------------------------------------------------------------------
// axe
// ---------------------------------------------------------------------------

test('no axe violations, multiple-choice, before and after answering', async () => {
  const { container } = render(<Quiz atom={choice()} />);
  await assertNoA11yViolations(container);
  fireEvent.click(screen.getByRole('radio', { name: '4624' }));
  fireEvent.click(check());
  await assertNoA11yViolations(container);
});

test('no axe violations, fill-blank, before and after answering', async () => {
  const { container } = render(<Quiz atom={blank()} />);
  await assertNoA11yViolations(container);
  await answerBlank('4624');
  await assertNoA11yViolations(container);
});
