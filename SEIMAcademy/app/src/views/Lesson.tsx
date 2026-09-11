import { useEffect, useState } from 'preact/hooks';
import { loadLesson, ContentUnavailable } from '../content';
import type { Lesson } from '../content/types';
import { AtomView } from '../atoms';
import { useSession } from '../state/session';
import { Degraded, StaleNotice } from './index';
import './lesson.css';

/**
 * The lesson player — one atom per screen (#26), with the resume point written on every
 * move (#27) and a flag affordance on every atom (#31).
 *
 * "Zero-cost re-entry: closing the tab mid-lesson costs nothing." So the position is
 * committed when the atom changes, not when the lesson ends — the tab closing is not an
 * event this code gets to see.
 */
export function LessonPlayer({ lessonId }: { lessonId: string }) {
  const session = useSession();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState<'offline' | 'missing' | 'malformed' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [index, setIndex] = useState(
    session.position?.lessonId === lessonId ? session.position.atomIndex : 0
  );
  const [hintAt, setHintAt] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLesson(null);
    setError(null);
    loadLesson(lessonId)
      .then((r) => {
        if (!live) return;
        setLesson(r.data);
        setStale(r.stale);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setError(e instanceof ContentUnavailable ? e.reason : 'offline');
      });
    return () => {
      live = false;
    };
  }, [lessonId, attempt]);

  const atoms = lesson?.atoms ?? [];
  const atom = atoms[Math.min(index, Math.max(0, atoms.length - 1))];

  // Resume point and active atom follow the cursor, so the shell's Skip and Hint know what
  // they are acting on and a reload lands on this screen.
  useEffect(() => {
    if (!atom) return;
    session.setActiveAtom(atom.id);
    session.setPosition({ lessonId, atomIndex: index });
    setHintAt(null);
    setNoteFor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atom?.id]);

  // Skip advances without completing: BUILD-PLAN is explicit that skipping is never
  // penalised and never recorded as a failure.
  useEffect(() => {
    if (session.skipSignal > 0) setIndex((i) => Math.min(i + 1, atoms.length - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.skipSignal]);

  useEffect(() => {
    if (session.hintSignal > 0) setHintAt(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.hintSignal]);

  if (error) {
    return (
      <>
        <Degraded reason={error} retry={() => setAttempt((n) => n + 1)} />
        <p class="note">
          <button type="button" class="linkish" onClick={() => session.exitLesson()}>
            Back to Today
          </button>{' '}
          — your place in this lesson is saved either way.
        </p>
      </>
    );
  }
  if (!lesson || !atom) return <p class="muted">Loading…</p>;

  const last = index >= atoms.length - 1;
  const advance = () => {
    session.completeAtom(atom.id);
    if (last) session.exitLesson();
    else setIndex(index + 1);
  };

  return (
    <div class="lesson">
      {stale && <StaleNotice />}
      <p class="lesson__crumb">
        <button type="button" class="linkish" onClick={() => session.exitLesson()}>
          {lesson.title}
        </button>
        <span class="muted">
          {' '}· atom <span class="data">{index + 1}</span> of{' '}
          <span class="data">{atoms.length}</span>
        </span>
      </p>

      <AtomView atom={atom} hint={hintAt === index} />

      <div class="lesson__controls">
        <button type="button" class="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Back
        </button>
        <button type="button" class="cta" onClick={advance}>
          {last ? 'Finish' : 'Next'}
        </button>
        <span class="lesson__spacer" />
        <button
          type="button"
          class={`ghost${session.isFlagged(atom.id) ? ' ghost--on' : ''}`}
          aria-pressed={session.isFlagged(atom.id)}
          title="Flag this atom — one click, optional note, stays on this device"
          onClick={() => (session.isFlagged(atom.id) ? session.toggleFlag(atom.id) : setNoteFor(atom.id))}
        >
          {session.isFlagged(atom.id) ? 'Flagged' : 'Flag this'}
        </button>
      </div>

      {noteFor === atom.id && (
        <form
          class="lesson__note"
          onSubmit={(event) => {
            event.preventDefault();
            const field = (event.currentTarget as HTMLFormElement).elements.namedItem('note');
            const value = field instanceof HTMLInputElement ? field.value.trim() : '';
            session.toggleFlag(atom.id, value || undefined);
            setNoteFor(null);
          }}
        >
          <label class="muted" for="flag-note">
            Anything to say about it? Optional.
          </label>
          <input id="flag-note" name="note" type="text" autocomplete="off" maxLength={140} autofocus />
          <button type="submit" class="ghost">Save flag</button>
          <button type="button" class="ghost" onClick={() => { session.toggleFlag(atom.id); setNoteFor(null); }}>
            Just flag it
          </button>
        </form>
      )}

      {!session.storageWorks && (
        <p class="lesson__warn">
          This browser is refusing to save progress, so this session will not resume. Everything
          still works — it just will not remember.
        </p>
      )}
    </div>
  );
}
