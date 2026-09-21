/**
 * The pick-up/place state machine behind matching and drag-classify (#37).
 *
 * Pure logic, no Preact and no DOM, same posture as `srs.ts`. The accessibility baseline
 * says the keyboard path ships from day one, not bolted on after drag — the only way to
 * guarantee that is to give click, keyboard and pointer drag no state of their own. All
 * three call `pickUp` and `place`; the module has no idea which one called it.
 *
 * A placement is never final until the learner asks to check (`checkPlacements`) — an item
 * already in a bucket can be picked up again and moved, which is why `place` only ever
 * writes to `placements`, never to a separate "locked" flag.
 */

export interface PlacementItem {
  id: string;
  label: string;
  /** The bucket this item actually belongs in — never shown until `checkPlacements`. */
  bucket: string;
}

export interface PlacementState {
  items: PlacementItem[];
  buckets: string[];
  /** `null` means unplaced. Every item starts here, never absent from the map. */
  placements: Record<string, string | null>;
  /** The item currently picked up, or `null` if nothing is held. */
  held: string | null;
}

export interface PlacementResult {
  itemId: string;
  correct: boolean;
  placedBucket: string | null;
  correctBucket: string;
}

export const createPlacementState = (items: PlacementItem[], buckets: string[]): PlacementState => ({
  items: [...items],
  buckets: [...buckets],
  placements: Object.fromEntries(items.map((item) => [item.id, null])),
  held: null,
});

/**
 * Pick up an item, or put down whatever is already held.
 *
 * Calling it again on the item already held is how a cancel is expressed — a second click
 * on the same item, or `Escape`, both just call this with the held id. That is also what
 * makes `Escape` safe on an already-placed item: nothing here touches `placements`, so
 * cancelling a move never un-places the item it started from.
 */
export function pickUp(state: PlacementState, itemId: string): PlacementState {
  return { ...state, held: state.held === itemId ? null : itemId };
}

/**
 * Commit the held item to a bucket. A no-op with nothing held — a stray `place` call (a
 * pointerup with no prior pointerdown, say) must not silently place something the learner
 * never picked up.
 */
export function place(state: PlacementState, bucketId: string): PlacementState {
  if (state.held === null) return state;
  return {
    ...state,
    placements: { ...state.placements, [state.held]: bucketId },
    held: null,
  };
}

/**
 * Send an item back to unplaced without choosing a new bucket for it — a pointer drag
 * released outside every bucket, or an explicit "remove" affordance on a placed item.
 */
export function returnItem(state: PlacementState, itemId: string): PlacementState {
  return {
    ...state,
    placements: { ...state.placements, [itemId]: null },
    held: state.held === itemId ? null : state.held,
  };
}

/** True once every item has a bucket, whatever that bucket turns out to be. */
export const isComplete = (state: PlacementState): boolean =>
  state.items.every((item) => state.placements[item.id] != null);

/**
 * Per-item results against the answer key. Called only once the learner asks to check —
 * this module never grades on its own, the same way `Flashcard` never schedules on its own.
 */
export function checkPlacements(state: PlacementState): PlacementResult[] {
  return state.items.map((item) => {
    const placedBucket = state.placements[item.id] ?? null;
    return {
      itemId: item.id,
      correct: placedBucket === item.bucket,
      placedBucket,
      correctBucket: item.bucket,
    };
  });
}
