import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectTestOutQuestions,
  eligibleTestOutAtoms,
  MIN_TESTOUT_QUESTIONS,
  MAX_TESTOUT_QUESTIONS,
} from './testout';
import type { Atom } from '../content/types';

const base = {
  title: 't',
  body: '',
  source: { path: 'x.md' },
  estimated_seconds: 30,
  graded: false,
};

const flashcard = (id: string, teaches: string[], eligible = true): Atom => ({
  ...base,
  id,
  type: 'flashcard',
  teaches,
  srs: { eligible, deck: 'd', reason: 'evidence-set' },
  payload: { front: 'front', back: 'back' },
});

const quiz = (id: string, teaches: string[] = []): Atom => ({
  ...base,
  id,
  type: 'quiz',
  teaches,
  graded: true,
  payload: { format: 'multiple-choice', question: 'q', choices: ['a', 'b'], answer_index: 0 },
});

// ---------------------------------------------------------------------------
// eligibleTestOutAtoms
// ---------------------------------------------------------------------------

test('only SRS-eligible flashcards are candidates', () => {
  const atoms = [
    flashcard('f-1', ['a']),
    flashcard('f-2', ['b'], false),
    quiz('q-1', ['c']),
  ];
  const eligible = eligibleTestOutAtoms(atoms);
  assert.deepEqual(eligible.map((a) => a.id), ['f-1']);
});

// ---------------------------------------------------------------------------
// selectTestOutQuestions
// ---------------------------------------------------------------------------

test('fewer than the minimum eligible cards returns nothing rather than a short check', () => {
  const atoms = [flashcard('f-1', ['a']), flashcard('f-2', ['b'])];
  assert.deepEqual(selectTestOutQuestions(atoms), []);
});

test('exactly the minimum is returned in full', () => {
  const atoms = [flashcard('f-1', ['a']), flashcard('f-2', ['b']), flashcard('f-3', ['c'])];
  const selected = selectTestOutQuestions(atoms);
  assert.equal(selected.length, MIN_TESTOUT_QUESTIONS);
});

test('never returns more than the maximum, even with plenty of candidates', () => {
  const atoms = Array.from({ length: 20 }, (_, i) => flashcard(`f-${i}`, [`tag-${i}`]));
  assert.equal(selectTestOutQuestions(atoms).length, MAX_TESTOUT_QUESTIONS);
});

test('prefers breadth of coverage over redundant tags', () => {
  const atoms = [
    flashcard('f-1', ['event:4624', 'event:4625', 'event:4634']),
    flashcard('f-2', ['event:4624']), // fully redundant against f-1
    flashcard('f-3', ['event:4720']), // new coverage
    flashcard('f-4', ['event:4697']), // new coverage
  ];
  const selected = selectTestOutQuestions(atoms).map((a) => a.id);
  // f-2 adds nothing f-1 does not already cover, so with only four atoms and a minimum of
  // three, the broad ones win over the redundant one.
  assert.ok(selected.includes('f-1'));
  assert.ok(selected.includes('f-3'));
  assert.ok(selected.includes('f-4'));
  assert.equal(selected.includes('f-2'), false);
});

test('selection is deterministic — the same input always produces the same output', () => {
  const atoms = Array.from({ length: 8 }, (_, i) => flashcard(`f-${i}`, [`tag-${i % 3}`]));
  const first = selectTestOutQuestions(atoms).map((a) => a.id);
  const second = selectTestOutQuestions(atoms).map((a) => a.id);
  assert.deepEqual(first, second);
});

test('an atom with no teaches tags is still selectable once the minimum is not yet met', () => {
  const atoms = [flashcard('f-1', []), flashcard('f-2', []), flashcard('f-3', [])];
  const selected = selectTestOutQuestions(atoms);
  assert.equal(selected.length, MIN_TESTOUT_QUESTIONS);
});

test('quiz atoms are never selected, whatever tags they carry', () => {
  const atoms = [
    flashcard('f-1', ['a']),
    flashcard('f-2', ['b']),
    flashcard('f-3', ['c']),
    quiz('q-1', ['d', 'e', 'f']),
  ];
  const selected = selectTestOutQuestions(atoms);
  assert.equal(selected.some((a) => a.type === 'quiz'), false);
});
