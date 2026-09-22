import { useEffect, useState } from 'preact/hooks';
import { loadLesson, ContentUnavailable } from '../content';
import type { BuildManifest } from '../content/types';
import { buildReviewQueue, type SrsCard } from '../state/srs';
import { resolveQueueItems, type ReviewItem } from '../state/review';
import { useSession } from '../state/session';
import { Flashcard } from '../atoms/Flashcard';
import { useManifest, Degraded, StaleNotice } from './index';
import './views.css';

/**
 * A hand-edited or corrupted deck value could collide with far more modules than any real
 * queue ever spans — nothing here validates that `SrsCard.deck` still names a real module.
 * This bounds the fetch fan-out to that scenario's worst case rather than the manifest's;
 * any due card whose atom falls outside the fetched slice is dropped the same way a moved
 * or renamed atom already is, by `resolveQueueItems`.
 */
const MAX_REVIEW_LESSON_FETCH = 25;

/**
 * The Review route (#118) — plays `buildReviewQueue(cardsDue(...))` one flashcard per
 * screen, deferred out of #35 because a queue player is a session type, not a component.
 *
 * `SrsCard` only names a module (`deck`), not the lesson an atom lives in, so playing the
 * queue means fetching every lesson in each due card's module and joining atoms back onto
 * cards by id — the same shape Unit 4's test-out check already fetches in, reused here via
 * `resolveQueueItems` instead of duplicated.
 */

type Load =
  | { status: 'loading' }
  | { status: 'ready'; items: ReviewItem[]; stale: boolean }
  | { status: 'error'; reason: 'offline' | 'missing' | 'malformed' };

/**
 * Builds the queue once and never again for the life of this component.
 *
 * Grading a card moves it out of `dueCards` on the very next render — the whole point of
 * SM-2 — but a queue that reacted to that would rebuild itself out from under whoever is
 * mid-session, the exact failure #118 rules out. `built` latches true on the first
 * successful resolution (including the "nothing due" case) and blocks every later run.
 *
 * Deliberately not depending on `dueCards`: it is a snapshot taken on the render that
 * captures the queue, which is safe only because `SessionProvider` hydrates `persisted`
 * from localStorage synchronously before first paint (session.tsx: "on screen at first
 * paint"). If that ever became async, this would need its own "has session loaded yet"
 * gate rather than trusting the first `dueCards` it sees.
 */
function useReviewQueue(dueCards: SrsCard[], manifest: BuildManifest | null): Load & { retry: () => void } {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [built, setBuilt] = useState(false);

  useEffect(() => {
    if (built || !manifest) return;

    if (dueCards.length === 0) {
      setBuilt(true);
      setLoad({ status: 'ready', items: [], stale: false });
      return;
    }

    let live = true;
    const queue = buildReviewQueue(dueCards);
    const decks = new Set(queue.map((c) => c.deck));
    const lessonIds = [
      ...new Set(manifest.modules.filter((m) => decks.has(m.id)).flatMap((m) => m.lesson_order)),
    ].slice(0, MAX_REVIEW_LESSON_FETCH);

    Promise.all(lessonIds.map((id) => loadLesson(id)))
      .then((results) => {
        if (!live) return;
        const lessons = results.map((r) => r.data);
        const stale = results.some((r) => r.stale);
        setBuilt(true);
        setLoad({ status: 'ready', items: resolveQueueItems(queue, lessons), stale });
      })
      .catch((e: unknown) => {
        if (!live) return;
        setLoad({ status: 'error', reason: e instanceof ContentUnavailable ? e.reason : 'offline' });
      });

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built, manifest, attempt]);

  return { ...load, retry: () => setAttempt((n) => n + 1) };
}

/** BUILD-PLAN's ambient accountability: a learner who is caught up is told so, not shown nothing. */
function CaughtUp() {
  return (
    <div class="panel panel--quiet">
      <h1>Review</h1>
      <p>You're caught up — nothing due right now.</p>
      <p class="muted">
        The streak keeps counting either way. Come back once the next card is due.
      </p>
    </div>
  );
}

export function Review() {
  const session = useSession();
  const manifestLoad = useManifest();
  const manifest = manifestLoad.status === 'ready' ? manifestLoad.manifest : null;
  const queueLoad = useReviewQueue(session.dueCards, manifest);
  const [index, setIndex] = useState(0);

  if (manifestLoad.status === 'error') {
    return <Degraded reason={manifestLoad.reason} retry={manifestLoad.retry} />;
  }
  if (queueLoad.status === 'loading') return <p class="muted">Loading what's due…</p>;
  if (queueLoad.status === 'error') {
    return <Degraded reason={queueLoad.reason} retry={queueLoad.retry} />;
  }

  const { items, stale } = queueLoad;
  if (index >= items.length) return <CaughtUp />;

  const { atom, card } = items[index]!;

  return (
    <>
      <h1>Review</h1>
      {stale && <StaleNotice />}
      <p class="panel__kicker">
        Review · card <span class="data">{index + 1}</span> of <span class="data">{items.length}</span>
      </p>
      <Flashcard
        key={atom.id}
        atom={atom}
        card={card}
        onGrade={(grade) => {
          session.gradeCard(atom, grade);
          setIndex((i) => i + 1);
        }}
      />
    </>
  );
}
