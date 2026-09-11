import { useEffect, useState } from 'preact/hooks';
import { loadManifest, modulesForTier } from '../content';
import type { BuildManifest, ModuleReport } from '../content/types';
import { useSession, DAILY_TARGET_ATOMS } from '../state/session';
import './views.css';

type Load = { status: 'loading' } | { status: 'ready'; manifest: BuildManifest } | { status: 'error'; message: string };

/**
 * Unit 2 keeps this minimal and honest. Unit 4 (#28) replaces the error branch with the
 * real degraded render — last-known-good cached content plus a calm retry, never a bare
 * error — which needs the service worker cache to exist first.
 */
export function useManifest(): Load {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    loadManifest()
      .then((manifest) => live && setLoad({ status: 'ready', manifest }))
      .catch((error: unknown) =>
        live && setLoad({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      );
    return () => {
      live = false;
    };
  }, []);
  return load;
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

  if (load.status === 'loading') return <p class="muted">Loading…</p>;
  if (load.status === 'error') return <LoadError message={load.message} />;

  const first = load.manifest.modules[0];
  return (
    <>
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
  if (load.status === 'error') return <LoadError message={load.message} />;

  const modules = modulesForTier(load.manifest, tier);
  return (
    <>
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

export function Copilot() {
  return (
    <>
      <h1>Copilot</h1>
      <div class="panel panel--quiet">
        <p>
          The Socratic copilot is <strong>Phase 7</strong>. It is local-first by default — an
          open-weight model served on your own machine, no API key and nothing proprietary in
          the critical path.
        </p>
        <p class="muted">
          This panel exists now because Unit 4 (#28) gives it its offline state: when the
          backend is unreachable the answer is "offline — here's the source doc", never a
          spinner that never resolves.
        </p>
      </div>
    </>
  );
}

export function Review() {
  const load = useManifest();
  const cards = load.status === 'ready' ? (load.manifest.modules[0]?.stats.srs_eligible_cards ?? 0) : 0;
  return (
    <>
      <h1>Review</h1>
      <div class="panel panel--quiet">
        <p>
          <span class="data">{cards}</span> cards are eligible for spaced repetition — the
          Event IDs with ground-truth evidence behind them, not every row in the source
          tables.
        </p>
        <p class="muted">
          The SM-2 scheduler and the topic-interleaving window are <strong>Phase 3</strong>.
          Showing a review queue before a scheduler exists would be showing a number with
          nothing behind it.
        </p>
      </div>
    </>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div class="panel panel--quiet">
      <p>Content is not loading right now.</p>
      <p class="muted">
        <code>{message}</code>
      </p>
      <p class="note">
        Unit 4 (#28) replaces this with the real degraded render: last-known-good cached
        content and a calm retry, never a bare error.
      </p>
    </div>
  );
}
