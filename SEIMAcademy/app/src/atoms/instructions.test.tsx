import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup } from '@testing-library/preact';
import { AtomView } from './index';
import { assertNoA11yViolations } from '../test/a11y';
import type { Atom, Difficulty } from '../content/types';

afterEach(cleanup);

const instructions = (payload: Record<string, unknown> = {}): Atom => ({
  id: 'i-1',
  type: 'instructions',
  title: 'Before you start: Security',
  body: '',
  source: { path: 'Logging/Notable-Event-IDs-Sigma.md', heading: 'Security' },
  teaches: ['concept:corpus-purpose'],
  estimated_seconds: 30,
  graded: false,
  payload: {
    goal: 'Match each Security Event ID to what it records.',
    what_youll_use: 'The 12 cards you just reviewed — nothing outside them.',
    done_when: 'Every ID on the left has a description on the right.',
    ...payload,
  },
});

test('the fixed anatomy renders as a description list, in order', () => {
  render(<AtomView atom={instructions()} />);

  const terms = [...document.querySelectorAll('.instructions__anatomy dt')].map((t) => t.textContent);
  assert.deepEqual(
    terms,
    ['Goal', "What you'll use", "How you'll know you're done"],
    'the anatomy is fixed and ordered — a learner should never have to parse a new layout'
  );

  const definitions = [...document.querySelectorAll('.instructions__anatomy dd')].map((d) => d.textContent);
  assert.equal(definitions[0], 'Match each Security Event ID to what it records.');
  assert.equal(definitions[2], 'Every ID on the left has a description on the right.');
});

test('a description list, not three loose paragraphs', () => {
  // A screen reader announces a dl's term count and lets a learner move between terms.
  // Divs would announce three unrelated blocks.
  render(<AtomView atom={instructions()} />);
  const dl = document.querySelector('.instructions__anatomy');
  assert.equal(dl?.tagName, 'DL');
  assert.equal(dl?.querySelectorAll('dt').length, 3);
  assert.equal(dl?.querySelectorAll('dd').length, 3);
});

test('the title is reachable as a heading', () => {
  render(<AtomView atom={instructions()} />);
  assert.ok(screen.getByRole('heading', { name: /Before you start: Security/ }));
});

test('a step-up exercise is announced before it, not discovered during it', () => {
  render(
    <AtomView
      atom={instructions({ step_up_notice: 'This one pulls from every channel you have seen so far.' })}
      nextDifficulty="step-up"
    />
  );
  assert.ok(
    screen.getByText(/pulls from every channel you have seen so far/),
    'the step-up notice must be visible on the instructions atom'
  );
  assert.ok(screen.getByText('A step up'));
});

test('difficulty is never signalled by colour alone', () => {
  // Accessibility baseline: a colourblind learner must get the same information.
  for (const difficulty of ['intro', 'standard', 'step-up'] as Difficulty[]) {
    render(<AtomView atom={instructions()} nextDifficulty={difficulty} />);
    const badge = document.querySelector('.difficulty');
    assert.ok(badge, `${difficulty}: no badge rendered`);

    const shape = badge!.querySelector('.difficulty__shape');
    assert.ok(shape, `${difficulty}: no shape alongside the colour`);
    assert.equal(shape!.getAttribute('aria-hidden'), 'true', 'the shape is decorative; the text carries the meaning');

    const label = badge!.textContent?.replace(shape!.textContent ?? '', '').trim();
    assert.ok(label && label.length > 0, `${difficulty}: no text label, so colour is the only signal`);
    cleanup();
  }
});

test('no difficulty badge when the atom introduces nothing harder', () => {
  render(<AtomView atom={instructions()} />);
  assert.equal(document.querySelector('.difficulty'), null);
});

test('a missing payload field renders empty rather than "undefined"', () => {
  render(<AtomView atom={{ ...instructions(), payload: { goal: 'Only a goal.' } }} />);
  assert.equal(document.body.textContent?.includes('undefined'), false);
  assert.ok(screen.getByText('Only a goal.'));
});

test('no axe violations, plain', async () => {
  const { container } = render(<AtomView atom={instructions()} />);
  await assertNoA11yViolations(container);
});

test('no axe violations with a step-up notice and badge', async () => {
  const { container } = render(
    <AtomView atom={instructions({ step_up_notice: 'This one is harder.' })} nextDifficulty="step-up" />
  );
  await assertNoA11yViolations(container);
});
