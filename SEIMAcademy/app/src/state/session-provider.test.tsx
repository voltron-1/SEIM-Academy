import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup, fireEvent } from '@testing-library/preact';
import { SessionProvider, useSession } from './session';
import { STORAGE_KEY, type PersistedState } from './persistence';
import type { Atom } from '../content/types';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const flashcard: Atom = {
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
};

const stored = (): PersistedState => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');

/** Grades a card and completes the atom in one handler, the way the lesson player does. */
function GradeThenAdvance() {
  const session = useSession();
  return (
    <button
      type="button"
      onClick={() => {
        session.gradeCard(flashcard, 4);
        session.completeAtom(flashcard.id);
      }}
    >
      grade and advance
    </button>
  );
}

test('two writes in one tick both survive', () => {
  // The lesson player grades a card and then advances, which completes the atom. Both
  // land in the same tick. If each one builds its next state from the same captured
  // snapshot, the second silently discards the first and every grade a learner submits
  // is thrown away — with no error and no failing test anywhere else.
  render(
    <SessionProvider>
      <GradeThenAdvance />
    </SessionProvider>
  );
  fireEvent.click(screen.getByRole('button'));

  const state = stored();
  assert.ok(state.srsCards?.['f-1'], 'the grade was discarded by the write that followed it');
  assert.equal(state.srsCards['f-1']!.repetitions, 1);
  assert.ok(state.completedAtomIds?.includes('f-1'), 'the completion was discarded');
});

test('grading an ineligible card changes nothing rather than erroring', () => {
  const ineligible: Atom = { ...flashcard, srs: { eligible: false, deck: 'd', reason: 'duplicate-event' } };
  // Completing the atom alongside it forces a write, so "no card" is read off real
  // stored state rather than off an empty key that was never written.
  function Probe() {
    const session = useSession();
    return (
      <button
        type="button"
        onClick={() => {
          session.gradeCard(ineligible, 4);
          session.completeAtom(ineligible.id);
        }}
      >
        grade
      </button>
    );
  }
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>
  );
  fireEvent.click(screen.getByRole('button'));
  assert.deepEqual(stored().srsCards, {});
});

test('a second grade of the same card builds on the first, not on a stale snapshot', () => {
  function Probe() {
    const session = useSession();
    return (
      <button type="button" onClick={() => session.gradeCard(flashcard, 4)}>
        grade
      </button>
    );
  }
  render(
    <SessionProvider>
      <Probe />
    </SessionProvider>
  );
  const button = screen.getByRole('button');
  fireEvent.click(button);
  fireEvent.click(button);

  assert.equal(stored().srsCards['f-1']!.repetitions, 2, 'the second grade restarted from a fresh card');
});
