import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { Review } from './Review';
import { SessionProvider, useSession } from '../state/session';
import { STORAGE_KEY, dayKey, type PersistedState } from '../state/persistence';
import { assertNoA11yViolations } from '../test/a11y';
import type { Atom, BuildManifest, ModuleReport, Lesson } from '../content/types';
import type { SrsCard } from '../state/srs';

const flashcard = (id: string, teaches: string[], front: string, back: string): Atom => ({
  id,
  type: 'flashcard',
  title: id,
  body: '',
  source: { path: 'x.md' },
  teaches,
  estimated_seconds: 30,
  graded: false,
  srs: { eligible: true, deck: 'm-1', reason: 'evidence-set' },
  payload: { front, back },
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

const moduleReport = (id: string, lessonOrder: string[]): ModuleReport => ({
  id,
  tier: 1,
  module: '1',
  title: id,
  lesson_order: lessonOrder,
  exercise_data: [],
  stats: {
    lessons: lessonOrder.length,
    atoms: 0,
    source_rows: 0,
    lab_pairs: 0,
    lab_pairs_rejected: 0,
    srs_eligible_cards: 2,
    srs_card_budget: 0,
    skipped_sections: 0,
  },
  skipped_sections: [],
});

const manifest = (modules: ModuleReport[]): BuildManifest => ({
  schema_version: '1.0.0',
  generator: 'g',
  generator_version: '1',
  generator_hash: 'h',
  source_repo: 'r',
  source_commit: 'c',
  source_license: 'l',
  sources: {},
  modules,
  artifacts: {},
});

const card = (atomId: string, dueDay: string, deck = 'm-1'): SrsCard => ({
  atomId,
  deck,
  teaches: [],
  ease: 2.5,
  intervalDays: 1,
  repetitions: 1,
  dueDay,
  lapses: 0,
});

const seedDue = (cards: SrsCard[]) => {
  const state: PersistedState = {
    version: 1,
    completedAtomIds: [],
    completedByDay: {},
    lastActiveDay: null,
    streakDays: 0,
    position: null,
    flags: [],
    srsCards: Object.fromEntries(cards.map((c) => [c.atomId, c])),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

const twoCardLesson = lesson('l-1', [
  flashcard('f-1', ['a'], 'Front one', 'Back one'),
  flashcard('f-2', ['b'], 'Front two', 'Back two'),
]);
const oneModule = moduleReport('m-1', ['l-1']);

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('build-manifest.json')) {
      return new Response(JSON.stringify(manifest([oneModule])), { status: 200 });
    }
    if (url.includes('l-1.json')) {
      return new Response(JSON.stringify(twoCardLesson), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  cleanup();
  localStorage.clear();
});

const renderReview = () =>
  render(
    <SessionProvider>
      <Review />
    </SessionProvider>
  );

const reveal = () => fireEvent.click(screen.getByRole('button', { name: /Show the answer/ }));
const grade = (label: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));

// ---------------------------------------------------------------------------

test('nothing due shows a real caught-up state, not an empty list', async () => {
  seedDue([]);
  renderReview();
  await waitFor(() => assert.ok(screen.getByText(/caught up/i)));
});

test('plays the due queue one card per screen, front-first', async () => {
  const today = dayKey();
  seedDue([card('f-1', today), card('f-2', today)]);
  renderReview();

  await waitFor(() => assert.ok(screen.getByText('Front one')));
  assert.equal(screen.queryByText('Back one'), null);
});

test('grading advances to the next card, then to the caught-up state', async () => {
  const today = dayKey();
  seedDue([card('f-1', today), card('f-2', today)]);
  renderReview();

  await waitFor(() => assert.ok(screen.getByText('Front one')));
  reveal();
  grade('Good');

  await waitFor(() => assert.ok(screen.getByText('Front two')));
  reveal();
  grade('Good');

  await waitFor(() => assert.ok(screen.getByText(/caught up/i)));
});

test('grading records the review through the normal SM-2 path', async () => {
  const today = dayKey();
  seedDue([card('f-1', today)]);

  function Probe() {
    const session = useSession();
    return <span data-testid="probe">{session.srsCardFor('f-1')?.repetitions ?? 'none'}</span>;
  }

  render(
    <SessionProvider>
      <Review />
      <Probe />
    </SessionProvider>
  );

  await waitFor(() => assert.ok(screen.getByText('Front one')));
  reveal();
  grade('Good');

  await waitFor(() => assert.equal(screen.getByTestId('probe').textContent, '2'));
});

test('the queue is built once per session — grading the first card does not shrink or reorder what is left', async () => {
  // A card graded well moves out of `dueCards` immediately (its dueDay moves forward).
  // #118 requires the session's queue to hold steady anyway, so the second card is still
  // reachable even though it is no longer "due" by the time the session gets to it.
  const today = dayKey();
  seedDue([card('f-1', today), card('f-2', today)]);
  renderReview();

  await waitFor(() => assert.ok(screen.getByText('Front one')));
  assert.equal(document.querySelector('.panel__kicker')?.textContent, 'Review · card 1 of 2');
  reveal();
  grade('Easy');

  await waitFor(() => assert.ok(screen.getByText('Front two')));
  assert.equal(document.querySelector('.panel__kicker')?.textContent, 'Review · card 2 of 2');
});

test('a manifest module with a malformed lesson_order degrades calmly instead of crashing', async () => {
  const today = dayKey();
  const brokenModule = { ...oneModule, lesson_order: undefined as unknown as string[] };
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('build-manifest.json')) {
      return new Response(JSON.stringify(manifest([brokenModule])), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof globalThis.fetch;
  seedDue([card('f-1', today)]);

  renderReview();

  await waitFor(() => assert.ok(screen.getByText(/did not load cleanly|has moved|No connection/)));
});

test('caps how many lessons it will fetch for one session, even if a corrupted deck matches every module', async () => {
  const today = dayKey();
  const manyModules = Array.from({ length: 40 }, (_, i) => moduleReport(`m-${i}`, [`l-${i}`]));
  let fetchCount = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('build-manifest.json')) {
      return new Response(JSON.stringify(manifest(manyModules)), { status: 200 });
    }
    fetchCount++;
    return new Response(JSON.stringify(lesson('x', [])), { status: 200 });
  }) as typeof globalThis.fetch;
  // One due card whose deck cannot possibly match 40 modules in honest data — this
  // models a corrupted/hand-edited deck value that happens to collide with many ids.
  seedDue(manyModules.map((m, i) => card(`f-${i}`, today, m.id)));

  renderReview();

  await waitFor(() => assert.ok(fetchCount > 0 || screen.queryByText(/caught up/i)));
  assert.ok(fetchCount <= 25, `fetched ${fetchCount} lessons for one session — no cap applied`);
});

test('has no axe violations mid-review or on the caught-up screen', async () => {
  const today = dayKey();
  seedDue([card('f-1', today)]);
  const { container } = renderReview();

  await waitFor(() => assert.ok(screen.getByText('Front one')));
  await assertNoA11yViolations(container);

  reveal();
  await assertNoA11yViolations(container);

  grade('Good');
  await waitFor(() => assert.ok(screen.getByText(/caught up/i)));
  await assertNoA11yViolations(container);
});
