import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup, fireEvent } from '@testing-library/preact';
import { Matching } from './Matching';
import { assertNoA11yViolations } from '../test/a11y';
import type { Atom } from '../content/types';

afterEach(cleanup);

const base = {
  id: 'm-1',
  type: 'exercise' as const,
  title: 'Sort each action into its logging channel',
  body: '',
  source: { path: 'Lab/Generate-Suspicious-Activity.ps1', heading: undefined },
  estimated_seconds: 60,
  graded: true,
};

const dragClassify = (payload: Record<string, unknown> = {}): Atom => ({
  ...base,
  payload: {
    format: 'drag-classify',
    items: [
      { label: 'Create Local User', bucket: 'Security 4720' },
      { label: 'Create a Service', bucket: 'Security 4697' },
    ],
    buckets: ['Security 4720', 'Security 4697'],
    ...payload,
  },
});

const match = (payload: Record<string, unknown> = {}): Atom => ({
  ...base,
  payload: {
    format: 'match',
    pairs: [
      { left: 'Create Local User', right: 'Security 4720' },
      { left: 'Create a Service', right: 'Security 4697' },
    ],
    ...payload,
  },
});

const item = (label: string) => screen.getByRole('button', { name: new RegExp(label) });
const bucket = (label: string) => screen.getByRole('button', { name: new RegExp(`${label}.*item`, 's') });
const check = () => screen.getByRole('button', { name: /Check placements/ });

// ---------------------------------------------------------------------------
// Click (pointer) path
// ---------------------------------------------------------------------------

test('a pointerdown on an item then a pointerup on a bucket places it', () => {
  render(<Matching atom={dragClassify()} />);
  fireEvent.pointerDown(item('Create Local User'));
  fireEvent.pointerUp(bucket('Security 4720'));

  assert.ok(screen.getByText(/1 item/), 'the bucket count did not update');
});

test('pointerdown on the held item again releases it without placing it anywhere', () => {
  render(<Matching atom={dragClassify()} />);
  const el = item('Create Local User');
  fireEvent.pointerDown(el);
  fireEvent.pointerDown(el);

  fireEvent.pointerUp(bucket('Security 4720'));
  // Nothing was held at the point of pointerup, so the bucket stayed empty.
  assert.equal(document.querySelectorAll('.matching__bucketCount').length, 2);
  for (const count of document.querySelectorAll('.matching__bucketCount')) {
    assert.match(count.textContent ?? '', /0 items/);
  }
});

test('a pointerup on a bucket with nothing held does nothing', () => {
  render(<Matching atom={dragClassify()} />);
  fireEvent.pointerUp(bucket('Security 4720'));
  for (const count of document.querySelectorAll('.matching__bucketCount')) {
    assert.match(count.textContent ?? '', /0 items/);
  }
});

// ---------------------------------------------------------------------------
// Keyboard path — the primary path, not a fallback
// ---------------------------------------------------------------------------

test('Enter on a focused item then Enter on a bucket places it, with no pointer event at all', () => {
  render(<Matching atom={dragClassify()} />);
  fireEvent.keyDown(item('Create Local User'), { key: 'Enter' });
  fireEvent.keyDown(bucket('Security 4720'), { key: 'Enter' });

  assert.ok(screen.getByText(/1 item/));
});

test('Space activates an item exactly like Enter', () => {
  render(<Matching atom={dragClassify()} />);
  fireEvent.keyDown(item('Create Local User'), { key: ' ' });
  fireEvent.keyDown(bucket('Security 4720'), { key: ' ' });

  assert.ok(screen.getByText(/1 item/));
});

test('the held item is announced in a live region', () => {
  render(<Matching atom={dragClassify()} />);
  fireEvent.keyDown(item('Create Local User'), { key: 'Enter' });

  const live = document.querySelector('[aria-live]');
  assert.ok(live);
  assert.match(live!.textContent ?? '', /Create Local User/);
});

test('Escape cancels a pick-up without placing the item anywhere', () => {
  render(<Matching atom={dragClassify()} />);
  fireEvent.keyDown(item('Create Local User'), { key: 'Enter' });
  fireEvent.keyDown(document, { key: 'Escape' });

  const live = document.querySelector('[aria-live]');
  assert.equal(live!.textContent, '', 'still holding an item after Escape');

  // The bucket refuses activation with nothing held, so this must not place it.
  fireEvent.keyDown(bucket('Security 4720'), { key: 'Enter' });
  for (const count of document.querySelectorAll('.matching__bucketCount')) {
    assert.match(count.textContent ?? '', /0 items/);
  }
});

test('a mouse-driven implementation would fail this: a bucket is a real button, not a div', () => {
  // Unit 2 found a reveal control silently downgraded from <button> to <div>, which axe
  // did not catch. This assertion is the regression gate for that shape of bug here.
  render(<Matching atom={dragClassify()} />);
  assert.equal(bucket('Security 4720').tagName, 'BUTTON');
  assert.equal(item('Create Local User').tagName, 'BUTTON');
});

// ---------------------------------------------------------------------------
// The state machine drives both payload formats identically
// ---------------------------------------------------------------------------

test('the match format reduces to the same buckets as drag-classify', () => {
  render(<Matching atom={match()} />);
  fireEvent.pointerDown(item('Create Local User'));
  fireEvent.pointerUp(bucket('Security 4720'));

  assert.ok(screen.getByText(/1 item/));
});

// ---------------------------------------------------------------------------
// Checking and feedback
// ---------------------------------------------------------------------------

test('checking is disabled until every item is placed', () => {
  render(<Matching atom={dragClassify()} />);
  assert.equal((check() as HTMLButtonElement).disabled, true);

  fireEvent.pointerDown(item('Create Local User'));
  fireEvent.pointerUp(bucket('Security 4720'));
  assert.equal((check() as HTMLButtonElement).disabled, true, 'one of two placed should not enable it');

  fireEvent.pointerDown(item('Create a Service'));
  fireEvent.pointerUp(bucket('Security 4697'));
  assert.equal((check() as HTMLButtonElement).disabled, false);
});

test('checking with everything correct marks every item right, with shape not colour alone', () => {
  render(<Matching atom={dragClassify()} />);
  fireEvent.pointerDown(item('Create Local User'));
  fireEvent.pointerUp(bucket('Security 4720'));
  fireEvent.pointerDown(item('Create a Service'));
  fireEvent.pointerUp(bucket('Security 4697'));
  fireEvent.click(check());

  const marks = document.querySelectorAll('.matching__mark--right');
  assert.equal(marks.length, 2);
  const shapes = document.querySelectorAll('.matching__mark [aria-hidden="true"]');
  assert.equal(shapes.length, 2, 'no decorative shape alongside the colour');
});

test('a wrong placement names where the item actually belongs, not just "wrong"', () => {
  render(<Matching atom={dragClassify()} />);
  fireEvent.pointerDown(item('Create Local User'));
  fireEvent.pointerUp(bucket('Security 4697'));
  fireEvent.pointerDown(item('Create a Service'));
  fireEvent.pointerUp(bucket('Security 4720'));
  fireEvent.click(check());

  const copy = document.body.textContent ?? '';
  assert.match(copy, /belongs in Security 4720/);
  assert.match(copy, /belongs in Security 4697/);
});

test('no shame-adjacent copy in the matching feedback', () => {
  render(<Matching atom={dragClassify()} />);
  fireEvent.pointerDown(item('Create Local User'));
  fireEvent.pointerUp(bucket('Security 4697'));
  fireEvent.pointerDown(item('Create a Service'));
  fireEvent.pointerUp(bucket('Security 4720'));
  fireEvent.click(check());

  const copy = document.body.textContent ?? '';
  for (const word of ['Incorrect', 'Wrong', 'Sorry', 'Try again', 'Failed', 'Oops', '!']) {
    assert.equal(copy.includes(word), false, `"${word}" appears in the feedback`);
  }
});

test('once settled, items and buckets stop responding to further input', () => {
  render(<Matching atom={dragClassify()} />);
  fireEvent.pointerDown(item('Create Local User'));
  fireEvent.pointerUp(bucket('Security 4720'));
  fireEvent.pointerDown(item('Create a Service'));
  fireEvent.pointerUp(bucket('Security 4697'));
  fireEvent.click(check());

  assert.equal(screen.queryByRole('button', { name: /Check placements/ }), null);
});

// ---------------------------------------------------------------------------
// Moving a placed item — never final until checked
// ---------------------------------------------------------------------------

test('a placed item can be taken back out and moved to a different bucket', () => {
  render(<Matching atom={dragClassify()} />);
  fireEvent.pointerDown(item('Create Local User'));
  fireEvent.pointerUp(bucket('Security 4697'));
  assert.ok(screen.getByText(/1 item/));

  fireEvent.click(screen.getByRole('button', { name: /Take.*Create Local User.*back out/ }));
  fireEvent.pointerDown(item('Create Local User'));
  fireEvent.pointerUp(bucket('Security 4720'));

  assert.equal(document.querySelectorAll('.matching__bucketCount').length, 2);
  const copy = document.body.textContent ?? '';
  assert.match(copy, /Security 4720[\s\S]*1 item/);
});

// ---------------------------------------------------------------------------
// Hint — reveals correct placements without recording one
// ---------------------------------------------------------------------------

test('hint reveals where every item belongs even with nothing placed', () => {
  render(<Matching atom={dragClassify()} hint />);

  const copy = document.body.textContent ?? '';
  assert.match(copy, /belongs in Security 4720/);
  assert.match(copy, /belongs in Security 4697/);
});

test('hint does not put an unearned checkmark on the feedback', () => {
  render(<Matching atom={dragClassify()} hint />);
  const shape = document.querySelector('.feedback__shape');
  assert.equal(shape?.getAttribute('aria-hidden'), 'true');
  // A hint never claims the learner got it right — that would be Check's job.
  assert.equal(document.querySelector('.feedback--correct'), null);
});

test('hint disables further placement', () => {
  render(<Matching atom={dragClassify()} hint />);
  assert.equal((item('Create Local User') as HTMLButtonElement).disabled, true);
  assert.equal((bucket('Security 4720') as HTMLButtonElement).disabled, true);
});

test('hint has no axe violations', async () => {
  const { container } = render(<Matching atom={dragClassify()} hint />);
  await assertNoA11yViolations(container);
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test('has no axe violations at rest', async () => {
  const { container } = render(<Matching atom={dragClassify()} />);
  await assertNoA11yViolations(container);
});

test('has no axe violations once settled', async () => {
  const { container } = render(<Matching atom={dragClassify()} />);
  fireEvent.pointerDown(item('Create Local User'));
  fireEvent.pointerUp(bucket('Security 4720'));
  fireEvent.pointerDown(item('Create a Service'));
  fireEvent.pointerUp(bucket('Security 4697'));
  fireEvent.click(check());

  await assertNoA11yViolations(container);
});
