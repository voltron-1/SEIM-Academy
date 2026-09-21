import { useEffect, useState } from 'preact/hooks';
import { loadManifest, modulesForTier, ContentUnavailable } from '../content';
import type { BuildManifest, ModuleReport } from '../content/types';
import { useSession, DAILY_TARGET_ATOMS } from '../state/session';
import { isOnline, watchConnectivity } from '../offline';
import { MIN_TESTOUT_QUESTIONS } from '../state/testout';
import { TestOut } from './TestOut';
import './views.css';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; manifest: BuildManifest; stale: boolean }
  | { status: 'error'; reason: 'offline' | 'missing' | 'malformed' };

export function useManifest(): Load & { retry: () => void } {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoad({ status: 'loading' });
    loadManifest()
      .then((r) => live && setLoad({ status: 'ready', manifest: r.data, stale: r.stale }))
      .catch((error: unknown) => {
        if (!live) return;
        setLoad({
          status: 'error',
          reason: error instanceof ContentUnavailable ? error.reason : 'offline',
        });
      });
    return () => {
      live = false;
    };
  }, [attempt]);

  return { ...load, retry: () => setAttempt((n) => n + 1) };
}

/**
 * The calm degraded state (#28).
 *
 * BUILD-PLAN, anxiety-safe: a failed load shows last-known-good content and a calm retry,
 * never a bare error. When there is genuinely nothing cached, the next best thing is to say
 * what happened in one sentence, in the learner's terms, with the one button that might
 * help — and to be accurate about which problem it is, because "check your connection" is
 * useless advice when the file simply moved.
 */
export function Degraded({ reason, retry }: { reason: 'offline' | 'missing' | 'malformed'; retry: () => void }) {
  const copy = {
    offline: {
      title: 'No connection right now',
      body: 'Nothing is lost. Anything you have already opened is still here, and this will pick up on its own when you are back.',
    },
    missing: {
      title: 'That lesson has moved',
      body: 'Content is regenerated from the source knowledge base, and this one was renamed or retired. Today still works.',
    },
    malformed: {
      title: 'That content did not load cleanly',
      body: 'The file came back but could not be read. Retrying usually clears it.',
    },
  }[reason];

  return (
    <div class="panel panel--quiet">
      <h2>{copy.title}</h2>
      <p class="muted">{copy.body}</p>
      <button type="button" class="ghost" onClick={retry}>
        Try again
      </button>
    </div>
  );
}

/** Shown above content served from cache, so nobody wonders whether it is current. */
export function StaleNotice() {
  return (
    <p class="stale" role="status">
      Offline — showing your saved copy. It will refresh on its own when you are back.
    </p>
  );
}

const minutes = (m: ModuleReport) => Math.round((m.stats.atoms * 25) / 60);

function ModuleCard({ module }: { module: ModuleReport }) {
  return (
    <article class="mod">
      <h3 class="mod__title">
        <span class="mod__num data">
          T{module.tier} · {module.module}
        </span>{' '}
        {module.title}
      </h3>
      <p class="mod__meta">
        <span class="data">{module.stats.lessons}</span> lessons ·{' '}
        <span class="data">{module.stats.atoms}</span> atoms ·{' '}
        <span class="data">{module.stats.srs_eligible_cards}</span> review cards
      </p>
    </article>
  );
}

export function Today() {
  const load = useManifest();
  const { atomsLeftToday, completedToday, position, startLesson, streakDays, flagCount } = useSession();
  const [testingOut, setTestingOut] = useState(false);

  if (load.status === 'loading') return <p class="muted">Loading…</p>;
  if (load.status === 'error') return <Degraded reason={load.reason} retry={load.retry} />;

  const first = load.manifest.modules[0];

  if (testingOut && first) {
    return (
      <>
        <h1>Today</h1>
        <TestOut module={first} manifest={load.manifest} onClose={() => setTestingOut(false)} />
      </>
    );
  }

  return (
    <>
      {load.stale && <StaleNotice />}
      <h1>Today</h1>
      <p class="lede">
        {completedToday === 0
          ? `${DAILY_TARGET_ATOMS} atoms is today's target — about fifteen minutes. Start anywhere.`
          : `${atomsLeftToday} atoms left today.`}
      </p>

      {first && (
        <section class="panel">
          <p class="panel__kicker">{position ? 'Pick up where you left off' : 'Up next'}</p>
          <ModuleCard module={first} />
          <div class="today__actions">
            <button
              type="button"
              class="cta"
              onClick={() =>
                position
                  ? startLesson(position.lessonId, position.atomIndex)
                  : startLesson(first.lesson_order[0]!)
              }
            >
              {position ? 'Resume' : 'Start'}
            </button>
            {/* Already know this material? A quick check skips it — no penalty either way if
                you don't. */}
            {first.stats.srs_eligible_cards >= MIN_TESTOUT_QUESTIONS && (
              <button type="button" class="ghost" onClick={() => setTestingOut(true)}>
                Test out of {first.title}
              </button>
            )}
          </div>
          {position && (
            <p class="note">
              <code>{position.lessonId}</code>, atom{' '}
              <span class="data">{position.atomIndex + 1}</span> — one click from where you
              stopped, with nothing to re-read.
            </p>
          )}
          {(streakDays > 0 || flagCount > 0) && (
            <p class="note">
              {streakDays > 0 && <>Streak: <span class="data">{streakDays}</span> day{streakDays === 1 ? '' : 's'}. </>}
              {flagCount > 0 && <><span class="data">{flagCount}</span> flagged for later.</>}
            </p>
          )}
        </section>
      )}
    </>
  );
}

export function Tier({ tier }: { tier: 1 | 2 }) {
  const load = useManifest();
  if (load.status === 'loading') return <p class="muted">Loading…</p>;
  if (load.status === 'error') return <Degraded reason={load.reason} retry={load.retry} />;

  const modules = modulesForTier(load.manifest, tier);
  return (
    <>
      {load.stale && <StaleNotice />}
      <h1>Tier {tier}</h1>
      {modules.length === 0 ? (
        <p class="muted">
          No Tier {tier} modules are built yet. Tier 1 completes in Phase 4, Tier 2 in Phase 6.
        </p>
      ) : (
        <>
          <p class="lede">
            {modules.length} module{modules.length === 1 ? '' : 's'} ·{' '}
            {minutes(modules[0]!)} minutes of content built so far.
          </p>
          <div class="mods">
            {modules.map((m) => (
              <ModuleCard key={m.id} module={m} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** Connectivity as a hook. `navigator.onLine` reports a link, not reachability, so this is
 *  a hint used only to choose wording — never to decide whether to attempt a load. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline());
  useEffect(() => watchConnectivity(setOnline), []);
  return online;
}

export function Copilot() {
  const online = useOnline();
  const load = useManifest();
  const sources =
    load.status === 'ready'
      ? [...new Set(Object.keys(load.manifest.sources))].sort()
      : [];

  return (
    <>
      <h1>Copilot</h1>

      {!online && (
        <div class="panel panel--quiet">
          <h2>Offline — here's the source instead</h2>
          <p class="muted">
            The copilot needs a model to talk to. While you are offline, the documents it
            would have been quoting are listed below — they are what it answers from, so
            reading them directly loses nothing but the conversation.
          </p>
          {sources.length > 0 && (
            <ul class="sources">
              {sources.map((path) => (
                <li key={path}>
                  <code>{path}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div class="panel panel--quiet">
        <p>
          The Socratic copilot is <strong>Phase 7</strong>. It is local-first by default — an
          open-weight model served on your own machine, no API key and nothing proprietary in
          the critical path.
        </p>
        <p class="muted">
          When the backend is unreachable the answer is the panel above — the source
          documents — never a spinner that never resolves.
        </p>
      </div>
    </>
  );
}

export { Review } from './Review';

