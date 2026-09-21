import { useEffect, useState } from 'preact/hooks';
import { loadLesson, ContentUnavailable } from '../content';
import type { Atom, ModuleReport, BuildManifest } from '../content/types';
import { selectTestOutQuestions } from '../state/testout';
import { useSession } from '../state/session';
import { Degraded, StaleNotice } from './index';
import './lesson.css';
import './test-out.css';

/**
 * The test-out check (#38) — a short diagnostic before a module, not a lesson atom.
 *
 * BUILD-PLAN: "Someone who already knows a module's material shouldn't have to sit through
 * it... declining or failing it just drops back into the normal queue — never penalized,
 * never remembered as a fail." So a fail here writes **nothing** — no SRS review, no
 * `completedAtomIds`, no flag. A pass writes exactly one thing: the resume position, moved
 * to the next module.
 *
 * This does not go through `AtomView`. Test-out runs across a whole module before any lesson
 * starts, which does not fit the one-atom-per-screen renderer contract, and forcing it in
 * would mean inventing a ninth atom type for something that is not content at all.
 *
 * Self-report is binary — "I knew it" / "I didn't" — deliberately not the SRS's four-grade
 * scale (`Again`/`Hard`/`Good`/`Easy`), so nothing here reads as a graded review session that
 * happens to skip the scheduling step.
 */

export interface TestOutProps {
  module: ModuleReport;
  manifest: BuildManifest;
  onClose: () => void;
}

type Load =
  | { status: 'loading' }
  | { status: 'ready'; questions: Atom[]; stale: boolean }
  | { status: 'too-few' }
  | { status: 'error'; reason: 'offline' | 'missing' | 'malformed' };

function useQuestions(module: ModuleReport): Load & { retry: () => void } {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setLoad({ status: 'loading' });

    Promise.all(module.lesson_order.map((id) => loadLesson(id)))
      .then((results) => {
        if (!live) return;
        const atoms = results.flatMap((r) => r.data.atoms);
        const questions = selectTestOutQuestions(atoms);
        // If even one lesson came from the cache instead of the network, the check as a
        // whole is running on a possibly-outdated copy — worth saying, the same way the
        // rest of the app never lets stale content pass as current without a notice.
        const stale = results.some((r) => r.stale);
        setLoad(questions.length > 0 ? { status: 'ready', questions, stale } : { status: 'too-few' });
      })
      .catch((e: unknown) => {
        if (!live) return;
        setLoad({ status: 'error', reason: e instanceof ContentUnavailable ? e.reason : 'offline' });
      });

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module.id, attempt]);

  return { ...load, retry: () => setAttempt((n) => n + 1) };
}

/** The module immediately after this one in the manifest, if any. */
function nextModule(manifest: BuildManifest, module: ModuleReport): ModuleReport | undefined {
  const i = manifest.modules.findIndex((m) => m.id === module.id);
  return i === -1 ? undefined : manifest.modules[i + 1];
}

export function TestOut({ module, manifest, onClose }: TestOutProps) {
  const session = useSession();
  const load = useQuestions(module);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);
  const [misses, setMisses] = useState(0);
  const [done, setDone] = useState(false);

  if (load.status === 'loading') return <p class="muted">Checking what you already know…</p>;
  if (load.status === 'error') return <Degraded reason={load.reason} retry={load.retry} />;
  if (load.status === 'too-few') {
    return (
      <div class="panel panel--quiet">
        <p>Not enough review material in this module yet to offer a test-out check.</p>
        <button type="button" class="ghost" onClick={onClose}>
          Back
        </button>
      </div>
    );
  }

  const { questions, stale } = load;

  if (done) {
    const passed = misses === 0;
    const next = nextModule(manifest, module);
    // A module with no lessons of its own has nowhere to send a skip; treated the same as
    // no next module existing, rather than writing a position that points at nothing.
    const nextLessonId = next?.lesson_order[0];
    return (
      <div class="panel testout__result">
        <h2>{passed ? 'You know this module.' : "That's the normal path, then — nothing lost."}</h2>
        {passed ? (
          next && nextLessonId ? (
            <>
              <p class="muted">Skipping ahead to {next.title}.</p>
              <button
                type="button"
                class="cta"
                onClick={() => {
                  session.setPosition({ lessonId: nextLessonId, atomIndex: 0 });
                  onClose();
                }}
              >
                Go to {next.title}
              </button>
            </>
          ) : (
            <p class="muted">
              There is no later module built yet to skip ahead to — this is everything so far.
            </p>
          )
        ) : (
          <p class="muted">One or more came back unfamiliar, which is exactly what the normal
            queue is for. Nothing about this was recorded.</p>
        )}
        <button type="button" class="ghost" onClick={onClose}>
          Back to Today
        </button>
      </div>
    );
  }

  const atom = questions[index]!;
  const isLast = index === questions.length - 1;

  const answer = (knew: boolean) => {
    if (!knew) setMisses((m) => m + 1);
    if (isLast) setDone(true);
    else {
      setIndex((i) => i + 1);
      setShown(false);
    }
  };

  return (
    <div class="panel testout">
      {stale && <StaleNotice />}
      <p class="panel__kicker">
        Test out of {module.title} · question <span class="data">{index + 1}</span> of{' '}
        <span class="data">{questions.length}</span>
      </p>
      <p class="testout__front data">{String(atom.payload.front ?? '')}</p>

      {!shown ? (
        <button type="button" class="ghost" onClick={() => setShown(true)}>
          Show the answer
        </button>
      ) : (
        <>
          <p class="testout__back">{String(atom.payload.back ?? '')}</p>
          <div class="testout__answer">
            <button type="button" class="ghost" onClick={() => answer(true)}>
              I knew it
            </button>
            <button type="button" class="ghost" onClick={() => answer(false)}>
              I didn't
            </button>
          </div>
        </>
      )}

      <p class="note">
        <button type="button" class="linkish" onClick={onClose}>
          Cancel
        </button>{' '}
        — nothing here is saved until you finish.
      </p>
    </div>
  );
}
