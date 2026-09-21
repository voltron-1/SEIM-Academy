import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { TestOut } from './TestOut';
import { SessionProvider, useSession } from '../state/session';
import { assertNoA11yViolations } from '../test/a11y';
import type { Atom, BuildManifest, ModuleReport, Lesson } from '../content/types';

const flashcard = (id: string, teaches: string[], front: string, back: string): Atom => ({
  id,
  type: 'flashcard',
  title: id,
  body: '',
  source: { path: 'x.md' },
  teaches,
  estimated_seconds: 30,
  graded: false,
  srs: { eligible: true, deck: 'd', reason: 'evidence-set' },
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

const moduleReport = (id: string, title: string, lessonOrder: string[]): ModuleReport => ({
  id,
  tier: 1,
  module: '1',
  title,
  lesson_order: lessonOrder,
  exercise_data: [],
  stats: {
    lessons: lessonOrder.length,
    atoms: 0,
    source_rows: 0,
    lab_pairs: 0,
    lab_pairs_rejected: 0,
    srs_eligible_cards: 5,
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

const threeQuestionModule = moduleReport('m-1', 'Windows Event ID triage', ['l-1']);
const threeCardLesson = lesson('l-1', [
  flashcard('f-1', ['a'], 'Front one', 'Back one'),
  flashcard('f-2', ['b'], 'Front two', 'Back two'),
  flashcard('f-3', ['c'], 'Front three', 'Back three'),
]);

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('l-1.json')) {
      return new Response(JSON.stringify(threeCardLesson), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  cleanup();
  localStorage.clear();
});

function renderTestOut(mod: ModuleReport, mods: ModuleReport[], onClose = () => {}) {
  return render(
    <SessionProvider>
      <TestOut module={mod} manifest={manifest(mods)} onClose={onClose} />
    </SessionProvider>
  );
}

const knewIt = () => fireEvent.click(screen.getByRole('button', { name: 'I knew it' }));
const didnt = () => fireEvent.click(screen.getByRole('button', { name: "I didn't" }));
const reveal = () => fireEvent.click(screen.getByRole('button', { name: /Show the answer/ }));

// ---------------------------------------------------------------------------

test('too few eligible flashcards offers no check', async () => {
  const oneCardLesson = lesson('l-2', [flashcard('f-1', ['a'], 'Front', 'Back')]);
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    if (String(input).includes('l-2.json')) return new Response(JSON.stringify(oneCardLesson), { status: 200 });
    return new Response('not found', { status: 404 });
  }) as typeof globalThis.fetch;

  const mod = moduleReport('m-2', 'Too small', ['l-2']);
  renderTestOut(mod, [mod]);

  await waitFor(() => assert.ok(screen.getByText(/Not enough review material/)));
});

test('steps through each question front-first, answer hidden until revealed', async () => {
  renderTestOut(threeQuestionModule, [threeQuestionModule]);
  await waitFor(() => assert.ok(screen.getByText('Front one')));
  assert.equal(screen.queryByText('Back one'), null);
});

test('a clean pass offers to skip to the next module', async () => {
  const next = moduleReport('m-2', 'Next module', ['l-3']);
  renderTestOut(threeQuestionModule, [threeQuestionModule, next]);

  await waitFor(() => assert.ok(screen.getByText('Front one')));
  reveal();
  knewIt();
  await waitFor(() => assert.ok(screen.getByText('Front two')));
  reveal();
  knewIt();
  await waitFor(() => assert.ok(screen.getByText('Front three')));
  reveal();
  knewIt();

  await waitFor(() => assert.ok(screen.getByText('You know this module.')));
  assert.ok(screen.getByRole('button', { name: /Go to Next module/ }));
});

test('a single miss fails the whole check, with neutral non-punitive copy', async () => {
  renderTestOut(threeQuestionModule, [threeQuestionModule]);

  await waitFor(() => assert.ok(screen.getByText('Front one')));
  reveal();
  didnt();
  await waitFor(() => assert.ok(screen.getByText('Front two')));
  reveal();
  knewIt();
  await waitFor(() => assert.ok(screen.getByText('Front three')));
  reveal();
  knewIt();

  await waitFor(() => assert.ok(screen.getByText(/nothing lost/)));
  const copy = document.body.textContent ?? '';
  for (const word of ['Incorrect', 'Wrong', 'Sorry', 'Try again', 'Failed', 'Oops', '!']) {
    assert.equal(copy.includes(word), false, `"${word}" appears in the fail copy`);
  }
  assert.equal(screen.queryByRole('button', { name: /Go to/ }), null);
});

test('failing does not touch SRS or completed-atom state', async () => {
  function Probe() {
    const session = useSession();
    return <span data-testid="probe">{session.completedToday}:{session.srsCardFor('f-1') ? 'has-card' : 'no-card'}</span>;
  }

  render(
    <SessionProvider>
      <TestOut module={threeQuestionModule} manifest={manifest([threeQuestionModule])} onClose={() => {}} />
      <Probe />
    </SessionProvider>
  );

  await waitFor(() => assert.ok(screen.getByText('Front one')));
  reveal();
  didnt();
  await waitFor(() => assert.ok(screen.getByText('Front two')));
  reveal();
  knewIt();
  await waitFor(() => assert.ok(screen.getByText('Front three')));
  reveal();
  knewIt();
  await waitFor(() => assert.ok(screen.getByText(/nothing lost/)));

  assert.equal(screen.getByTestId('probe').textContent, '0:no-card');
});

test('a pass with nothing later to skip to says so instead of a dead button', async () => {
  renderTestOut(threeQuestionModule, [threeQuestionModule]);

  await waitFor(() => assert.ok(screen.getByText('Front one')));
  reveal();
  knewIt();
  await waitFor(() => assert.ok(screen.getByText('Front two')));
  reveal();
  knewIt();
  await waitFor(() => assert.ok(screen.getByText('Front three')));
  reveal();
  knewIt();

  await waitFor(() => assert.ok(screen.getByText(/no later module built yet/)));
  assert.equal(screen.queryByRole('button', { name: /Go to/ }), null);
});

test('a next module with no lessons of its own is treated as no next module', async () => {
  // A skip has to land somewhere real. A lesson_order[0] guard prevents writing a position
  // that points at nothing rather than trusting an empty array to have a first element.
  const emptyNext = moduleReport('m-2', 'Empty module', []);
  renderTestOut(threeQuestionModule, [threeQuestionModule, emptyNext]);

  await waitFor(() => assert.ok(screen.getByText('Front one')));
  reveal();
  knewIt();
  await waitFor(() => assert.ok(screen.getByText('Front two')));
  reveal();
  knewIt();
  await waitFor(() => assert.ok(screen.getByText('Front three')));
  reveal();
  knewIt();

  await waitFor(() => assert.ok(screen.getByText('You know this module.')));
  assert.equal(screen.queryByRole('button', { name: /Go to/ }), null);
});

test('a fresh fetch shows no stale notice', async () => {
  renderTestOut(threeQuestionModule, [threeQuestionModule]);
  await waitFor(() => assert.ok(screen.getByText('Front one')));
  assert.equal(document.querySelector('.stale'), null);
});

test('content served from the cache after a network failure discloses it as stale', async () => {
  // Mirrors how fetchJson itself decides `stale`: the network call throws, and the answer
  // comes from Cache Storage instead. If even one of a module's lessons falls back this
  // way, the whole check is running on a possibly-outdated copy.
  const originalCaches = globalThis.caches;
  globalThis.fetch = (async () => {
    throw new TypeError('network unreachable');
  }) as typeof globalThis.fetch;
  (globalThis as { caches?: unknown }).caches = {
    match: async (input: RequestInfo | URL) =>
      String(input).includes('l-1.json')
        ? new Response(JSON.stringify(threeCardLesson), { status: 200 })
        : undefined,
  };

  try {
    renderTestOut(threeQuestionModule, [threeQuestionModule]);
    await waitFor(() => assert.ok(screen.getByText('Front one')));
    assert.ok(document.querySelector('.stale'), 'no stale notice for content served from the cache');
  } finally {
    (globalThis as { caches?: unknown }).caches = originalCaches;
  }
});

test('cancel mid-check calls onClose without finishing', async () => {
  let closed = false;
  renderTestOut(threeQuestionModule, [threeQuestionModule], () => {
    closed = true;
  });
  await waitFor(() => assert.ok(screen.getByText('Front one')));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  assert.equal(closed, true);
});

test('has no axe violations mid-check or on the result screen', async () => {
  const { container } = renderTestOut(threeQuestionModule, [threeQuestionModule]);
  await waitFor(() => assert.ok(screen.getByText('Front one')));
  await assertNoA11yViolations(container);

  reveal();
  await assertNoA11yViolations(container);

  knewIt();
  await waitFor(() => assert.ok(screen.getByText('Front two')));
  reveal();
  knewIt();
  await waitFor(() => assert.ok(screen.getByText('Front three')));
  reveal();
  knewIt();
  await waitFor(() => assert.ok(screen.getByText('You know this module.')));
  await assertNoA11yViolations(container);
});
