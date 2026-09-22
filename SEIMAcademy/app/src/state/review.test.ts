import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveQueueItems, type ReviewItem } from './review';
import type { Atom, Lesson } from '../content/types';
import type { SrsCard } from './srs';

const atom = (id: string): Atom => ({
  id,
  type: 'flashcard',
  title: id,
  body: '',
  source: { path: 'x.md' },
  estimated_seconds: 30,
  graded: false,
  srs: { eligible: true, deck: 'd', reason: 'evidence-set' },
  payload: { front: id, back: id },
});

const lesson = (id: string, atoms: Atom[]): Lesson => ({
  schema_version: '1.0.0',
  id,
  tier: 1,
  module: '1',
  title: id,
  summary: '',
  estimated_seconds: 60,
  teaches: [],
  requires: [],
  sources: [],
  generated: {
    generator: 'g',
    generator_version: '1',
    source_repo: 'r',
    source_commit: 'c',
    source_license: 'l',
    profile: 'p',
    content_hash: 'h',
  },
  atoms,
});

const card = (atomId: string): SrsCard => ({
  atomId,
  deck: 'd',
  teaches: [],
  ease: 2.5,
  intervalDays: 1,
  repetitions: 1,
  dueDay: '2026-01-01',
  lapses: 0,
});

test('resolves each queued card to its atom, preserving queue order', () => {
  const lessons = [lesson('l-1', [atom('a'), atom('b')]), lesson('l-2', [atom('c')])];
  const queue = [card('c'), card('a')];

  const items = resolveQueueItems(queue, lessons);

  assert.deepEqual(
    items.map((i: ReviewItem) => i.atom.id),
    ['c', 'a']
  );
  assert.equal(items[0]!.card, queue[0]);
  assert.equal(items[1]!.card, queue[1]);
});

test('drops a card whose atom cannot be found instead of crashing', () => {
  const lessons = [lesson('l-1', [atom('a')])];
  const queue = [card('a'), card('missing')];

  const items = resolveQueueItems(queue, lessons);

  assert.deepEqual(
    items.map((i: ReviewItem) => i.atom.id),
    ['a']
  );
});

test('drops a card whose id collides with a non-flashcard atom rather than playing it blank', () => {
  // A stale SrsCard should only ever match the flashcard it was scheduled for. If content
  // moved and a later atom reused that id for something else — a quiz, an exercise — this
  // is not the same card any more, and rendering it as a blank front/back would silently
  // grade content that was never reviewed.
  const notAFlashcard: Atom = { ...atom('a'), type: 'quiz' };
  const lessons = [lesson('l-1', [notAFlashcard])];
  const queue = [card('a')];

  const items = resolveQueueItems(queue, lessons);

  assert.deepEqual(items, []);
});
