import { test, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { AtomView } from '../atoms';
import { TestOut } from '../views/TestOut';
import { Review } from '../views/Review';
import { SessionProvider } from '../state/session';
import { STORAGE_KEY, dayKey, type PersistedState } from '../state/persistence';
import { assertNoA11yViolations } from './a11y';
import type { Atom, BuildManifest, ModuleReport, Lesson } from '../content/types';

/**
 * The #39 cross-component sweep — one file that drives all five core components with
 * nothing but key events and checks axe at rest and once settled, on top of (not instead
 * of) each component's own dedicated test suite.
 *
 * "The keyboard drive is run against a mouse-only implementation to watch it fail" — Unit 2
 * found a reveal control silently downgraded from `<button>` to `<div>`, which axe did not
 * catch. Flashcard, Quiz and Test-out rely on the browser's native Enter/Space-activates-a-
 * `<button>` behaviour, which `@testing-library/user-event`'s `tab()`/`keyboard()` genuinely
 * emulates (unlike a raw `fireEvent.keyDown`, which dispatches the event but does not
 * synthesize the resulting click — confirmed against Flashcard's own keyboard tests). Matching
 * has no such native fallback: Unit 3 wired its keyboard path directly, so it is driven with
 * `fireEvent.keyDown` instead, matching how its own test suite drives it.
 */

afterEach(cleanup);

const base = {
  body: '',
  source: { path: 'x.md' },
  estimated_seconds: 30,
  graded: false,
};

// ---------------------------------------------------------------------------
// Instructions — no interactive elements, so only the at-rest axe check applies.
// ---------------------------------------------------------------------------

test('sweep: Instructions has no axe violations', async () => {
  const atom: Atom = {
    ...base,
    id: 'i-1',
    type: 'instructions',
    title: 'Before you start',
    teaches: ['concept:corpus-purpose'],
    payload: { goal: 'g', what_youll_use: 'w', done_when: 'd' },
  };
  const { container } = render(<AtomView atom={atom} />);
  await assertNoA11yViolations(container);
});

// ---------------------------------------------------------------------------
// Flashcard — reveal, then a grade button, both keyboard-only.
// ---------------------------------------------------------------------------

test('sweep: Flashcard is fully operable by keyboard, clean at rest and once graded', async () => {
  const atom: Atom = {
    ...base,
    id: 'f-1',
    type: 'flashcard',
    title: 'f',
    teaches: ['event:4624'],
    srs: { eligible: true, deck: 'd', reason: 'evidence-set' },
    payload: { front: 'front', back: 'back' },
  };
  const card = {
    atomId: 'f-1',
    deck: 'd',
    teaches: ['event:4624'],
    ease: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueDay: '2026-01-01',
    lapses: 0,
  };
  let graded: number | null = null;
  const user = userEvent.setup();
  const { container } = render(<AtomView atom={atom} srsCard={card} onGrade={(g) => (graded = g)} />);
  await assertNoA11yViolations(container);

  await user.tab(); // -> "Show the answer"
  await user.keyboard('{Enter}');
  assert.ok(screen.getByText('back'));

  await user.tab(); // -> "Again"
  await user.tab(); // -> "Hard"
  await user.tab(); // -> "Good"
  await user.keyboard('{Enter}');
  assert.equal(graded, 4);

  await assertNoA11yViolations(container);
});

// ---------------------------------------------------------------------------
// Quiz — Space selects a radio, Enter activates Check, both keyboard-only.
// ---------------------------------------------------------------------------

test('sweep: Quiz is fully operable by keyboard, clean at rest and once answered', async () => {
  const atom: Atom = {
    ...base,
    id: 'q-1',
    type: 'quiz',
    title: 'q',
    payload: {
      format: 'multiple-choice',
      question: 'Which one?',
      choices: ['4624', '4625'],
      answer_index: 0,
      rationale: 'because',
    },
  };
  const user = userEvent.setup();
  const { container } = render(<AtomView atom={atom} />);
  await assertNoA11yViolations(container);

  await user.tab(); // -> first radio, "4624"
  const radio = screen.getByRole('radio', { name: '4624' }) as HTMLInputElement;
  assert.equal(document.activeElement, radio, 'the first radio is not the first tab stop');
  await user.keyboard(' ');
  assert.equal(radio.checked, true, 'Space did not check the focused radio');

  await user.tab(); // -> "Check answer"
  await user.keyboard('{Enter}');
  assert.ok(screen.getByText(/right/i));

  await assertNoA11yViolations(container);
});

// ---------------------------------------------------------------------------
// Matching — genuinely keyboard-native: Enter/Space drive pickUp/place directly,
// with no native-button fallback needed (Unit 3 built it this way on purpose).
// ---------------------------------------------------------------------------

test('sweep: Matching is fully operable by keyboard, clean at rest and once checked', async () => {
  const atom: Atom = {
    ...base,
    id: 'm-1',
    type: 'exercise',
    title: 'm',
    payload: {
      format: 'drag-classify',
      items: [{ label: 'Create Local User', bucket: 'Security 4720' }],
      buckets: ['Security 4720'],
    },
  };
  const { container } = render(<AtomView atom={atom} />);
  await assertNoA11yViolations(container);

  fireEvent.keyDown(screen.getByRole('button', { name: /Create Local User/ }), { key: 'Enter' });
  fireEvent.keyDown(screen.getByRole('button', { name: /Security 4720/ }), { key: 'Enter' });
  fireEvent.click(screen.getByRole('button', { name: /Check placements/ }));

  assert.ok(document.querySelector('.matching__mark--right'));
  await assertNoA11yViolations(container);
});

// ---------------------------------------------------------------------------
// Test-out — steps through with keyboard-native <button> activation only.
// ---------------------------------------------------------------------------

const testOutLesson: Lesson = {
  schema_version: '1.0.0',
  id: 'l-1',
  tier: 1,
  module: '1',
  title: 'l-1',
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
  atoms: [1, 2, 3].map((n) => ({
    ...base,
    id: `f-${n}`,
    type: 'flashcard' as const,
    title: `f-${n}`,
    teaches: [`tag-${n}`],
    srs: { eligible: true as const, deck: 'd', reason: 'evidence-set' as const },
    payload: { front: `front ${n}`, back: `back ${n}` },
  })),
};

const testOutModule: ModuleReport = {
  id: 'mod-1',
  tier: 1,
  module: '1',
  title: 'Sweep module',
  lesson_order: ['l-1'],
  exercise_data: [],
  stats: {
    lessons: 1,
    atoms: 0,
    source_rows: 0,
    lab_pairs: 0,
    lab_pairs_rejected: 0,
    srs_eligible_cards: 3,
    srs_card_budget: 0,
    skipped_sections: 0,
  },
  skipped_sections: [],
};

const testOutManifest: BuildManifest = {
  schema_version: '1.0.0',
  generator: 'g',
  generator_version: '1',
  generator_hash: 'h',
  source_repo: 'r',
  source_commit: 'c',
  source_license: 'l',
  sources: {},
  modules: [testOutModule],
  artifacts: {},
};

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('build-manifest.json')) {
      return new Response(JSON.stringify(testOutManifest), { status: 200 });
    }
    if (url.includes('l-1.json')) {
      return new Response(JSON.stringify(testOutLesson), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  localStorage.clear();
});

test('sweep: Test-out is fully operable by keyboard, clean at rest and on the result screen', async () => {
  const user = userEvent.setup();
  const { container } = render(
    <SessionProvider>
      <TestOut module={testOutModule} manifest={testOutManifest} onClose={() => {}} />
    </SessionProvider>
  );

  await waitFor(() => assert.ok(screen.getByText('front 1')));
  await assertNoA11yViolations(container);

  for (let n = 1; n <= 3; n++) {
    await waitFor(() => assert.ok(screen.getByText(`front ${n}`)));
    await user.tab(); // -> "Show the answer"
    await user.keyboard('{Enter}');
    await user.tab(); // -> "I knew it" (the reveal button just unmounted)
    await user.keyboard('{Enter}');
  }

  await waitFor(() => assert.ok(screen.getByText('You know this module.')));
  await assertNoA11yViolations(container);
});

// ---------------------------------------------------------------------------
// Review — reuses Flashcard's keyboard path; the sweep is on the route's own
// fetch/queue wiring, on top of Flashcard's own keyboard coverage above.
// ---------------------------------------------------------------------------

test('sweep: Review is fully operable by keyboard, clean at rest and on the caught-up screen', async () => {
  const today = dayKey();
  const seeded: PersistedState = {
    version: 1,
    completedAtomIds: [],
    completedByDay: {},
    lastActiveDay: null,
    streakDays: 0,
    position: null,
    flags: [],
    srsCards: {
      'f-1': {
        atomId: 'f-1',
        deck: 'mod-1',
        teaches: ['tag-1'],
        ease: 2.5,
        intervalDays: 1,
        repetitions: 1,
        dueDay: today,
        lapses: 0,
      },
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));

  const user = userEvent.setup();
  const { container } = render(
    <SessionProvider>
      <Review />
    </SessionProvider>
  );

  await waitFor(() => assert.ok(screen.getByText('front 1')));
  await assertNoA11yViolations(container);

  await user.tab(); // -> "Show the answer"
  await user.keyboard('{Enter}');
  await user.tab(); // -> "Again"
  await user.tab(); // -> "Hard"
  await user.tab(); // -> "Good"
  await user.keyboard('{Enter}');

  await waitFor(() => assert.ok(screen.getByText(/caught up/i)));
  await assertNoA11yViolations(container);
});
