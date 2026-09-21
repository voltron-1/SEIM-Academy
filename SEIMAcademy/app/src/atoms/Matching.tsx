import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Atom } from '../content/types';
import { str, list } from './payload';
import {
  createPlacementState,
  pickUp,
  place,
  returnItem,
  isComplete,
  checkPlacements,
  type PlacementItem,
  type PlacementResult,
} from '../state/placement';
import { Feedback } from './Feedback';
import './Matching.css';

/**
 * Matching and drag-classify (#37) — one state machine, three ways to drive it.
 *
 * The decision this component turns on: **select-then-place is the primary interaction,
 * drag is layered on top of it.** `pickUp`/`place` in `state/placement.ts` know nothing
 * about pointers. `Enter`/`Space` on a focused item calls `pickUp`; the same key on a
 * focused bucket calls `place`. Pointer drag calls the identical two operations —
 * `pointerdown` on an item is `pickUp`, `pointerup` over a bucket is `place`.
 *
 * **Neither path uses the native `click` event.** A full mouse click fires `pointerdown`,
 * then `pointerup`, then `click`, on the same element — wiring both `pointerdown` and
 * `click` to `pickUp` would fire it twice and the toggle-cancel in `pickUp` would undo
 * itself on every ordinary click. Routing pick-up through `pointerdown`/`keydown` only,
 * never `click`, is what keeps "click an item" and "press Enter on an item" from being two
 * competing implementations of the same thing.
 *
 * There is still no browser in this environment. happy-dom dispatches the pointer events
 * and the resulting state is asserted, but drag ergonomics — hit targets, drop tolerance,
 * whether a real finger can hold and move an item — are not verified here (see the Unit 3
 * plan's honest-limit note).
 */

/** Builds the item/bucket shape both payload formats reduce to. */
function fromPayload(atom: Atom): { items: PlacementItem[]; buckets: string[] } {
  const format = str(atom.payload, 'format');

  if (format === 'match') {
    const pairs = list(atom.payload, 'pairs') as { left?: unknown; right?: unknown }[];
    const items = pairs.map((pair, i) => ({
      id: `${atom.id}-item-${i}`,
      label: String(pair.left ?? ''),
      bucket: String(pair.right ?? ''),
    }));
    // Buckets are the right-hand values, de-duplicated but kept in first-seen order so the
    // layout does not reshuffle itself relative to how the source listed the pairs.
    const buckets = [...new Set(items.map((item) => item.bucket))];
    return { items, buckets };
  }

  const rawItems = list(atom.payload, 'items') as { label?: unknown; bucket?: unknown }[];
  const items = rawItems.map((it, i) => ({
    id: `${atom.id}-item-${i}`,
    label: String(it.label ?? ''),
    bucket: String(it.bucket ?? ''),
  }));
  const rawBuckets = list(atom.payload, 'buckets').filter((b): b is string => typeof b === 'string');
  // De-duplicated for the same reason as the match branch above — a duplicate bucket name
  // would otherwise render as two indistinguishable drop targets sharing one item count.
  const buckets = [...new Set(rawBuckets)];
  return { items, buckets };
}

/** Enter and Space are what `<button>` treats as activation; this is the keyboard path. */
const isActivationKey = (key: string): boolean => key === 'Enter' || key === ' ' || key === 'Spacebar';

export interface MatchingProps {
  atom: Atom;
  /** Set by the shell's Hint button — reveals correct placements without recording one. */
  hint?: boolean;
}

export function Matching({ atom, hint }: MatchingProps) {
  const { items, buckets } = useMemo(() => fromPayload(atom), [atom]);
  const [state, setState] = useState(() => createPlacementState(items, buckets));
  const [results, setResults] = useState<PlacementResult[] | null>(null);

  // Hint reveals correct placements without recording one — it grades whatever is on the
  // board right now (unplaced items resolve to `correct: false`, which is meaningful here)
  // rather than requiring the learner to finish placing everything first.
  const effectiveResults = results ?? (hint === true ? checkPlacements(state) : null);
  const settled = effectiveResults !== null;
  const held = state.held;

  // Escape cancels a pick-up regardless of which element has focus — the same toggle-off
  // `pickUp` already does for a second activation of the held item, just not scoped to one
  // element's keydown handler.
  useEffect(() => {
    if (!held || settled) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState((s) => pickUp(s, held));
    };
    document.addEventListener('keydown', onEscape);
    return () => document.removeEventListener('keydown', onEscape);
  }, [held, settled]);

  const heldLabel = held ? items.find((item) => item.id === held)?.label : undefined;
  const resultFor = (itemId: string): PlacementResult | undefined =>
    effectiveResults?.find((r) => r.itemId === itemId);
  const bucketCount = (bucketId: string): number =>
    items.filter((item) => state.placements[item.id] === bucketId).length;

  const pickUpItem = (itemId: string) => {
    if (settled) return;
    setState((s) => pickUp(s, itemId));
  };

  const placeInBucket = (bucketId: string) => {
    if (settled) return;
    setState((s) => (s.held ? place(s, bucketId) : s));
  };

  const onCheck = () => {
    if (!isComplete(state)) return;
    setResults(checkPlacements(state));
  };

  return (
    <div class="matching">
      {/* The held item is the only thing a screen-reader user cannot otherwise perceive —
          sighted learners see it lift off the tray, so this is where that goes instead. */}
      <p class="matching__status" aria-live="polite">
        {heldLabel ? `Holding “${heldLabel}”. Choose where it goes.` : ''}
      </p>

      <ul class="matching__tray" aria-label="Items to place">
        {items.map((item) => {
          const placedBucket = state.placements[item.id];
          if (placedBucket != null && !settled) return null;
          const result = resultFor(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                class={`matching__item data${held === item.id ? ' matching__item--held' : ''}`}
                aria-pressed={held === item.id}
                disabled={settled}
                onPointerDown={() => pickUpItem(item.id)}
                onKeyDown={(e) => {
                  if (isActivationKey(e.key)) {
                    e.preventDefault();
                    pickUpItem(item.id);
                  }
                }}
              >
                {item.label}
              </button>
              {result && (
                <span class={`matching__mark ${result.correct ? 'matching__mark--right' : 'matching__mark--wrong'}`}>
                  <span aria-hidden="true">{result.correct ? '✓' : '→'}</span>
                  {!result.correct && <span> belongs in {result.correctBucket}</span>}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <ul class="matching__buckets">
        {buckets.map((bucketId) => (
          <li key={bucketId}>
            <button
              type="button"
              class="matching__bucket"
              disabled={settled || !held}
              onPointerUp={() => placeInBucket(bucketId)}
              onKeyDown={(e) => {
                if (isActivationKey(e.key)) {
                  e.preventDefault();
                  placeInBucket(bucketId);
                }
              }}
            >
              <span class="matching__bucketLabel data">{bucketId}</span>
              <span class="matching__bucketCount">
                {bucketCount(bucketId)} {bucketCount(bucketId) === 1 ? 'item' : 'items'}
              </span>
            </button>
            {!settled && (
              <ul class="matching__bucketItems">
                {items
                  .filter((item) => state.placements[item.id] === bucketId)
                  .map((item) => (
                    <li key={item.id}>
                      <span class="data">{item.label}</span>
                      <button
                        type="button"
                        class="matching__remove"
                        aria-label={`Take “${item.label}” back out`}
                        onClick={() => setState((s) => returnItem(s, item.id))}
                      >
                        ×
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      {!settled && (
        <button type="button" class="matching__check" disabled={!isComplete(state)} onClick={onCheck}>
          Check placements
        </button>
      )}

      {settled && effectiveResults && (
        <Feedback
          correct={results !== null && effectiveResults.every((r) => r.correct)}
          headline={
            results === null
              ? 'Here is where everything belongs.'
              : effectiveResults.every((r) => r.correct)
                ? 'All in the right place.'
                : 'A few landed in the wrong bucket.'
          }
        />
      )}
    </div>
  );
}
