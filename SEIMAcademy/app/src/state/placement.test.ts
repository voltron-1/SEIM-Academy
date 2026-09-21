import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlacementState,
  pickUp,
  place,
  returnItem,
  isComplete,
  checkPlacements,
  type PlacementItem,
} from './placement';

const items: PlacementItem[] = [
  { id: 'i-1', label: 'Event 4720', bucket: 'account-management' },
  { id: 'i-2', label: 'Event 4697', bucket: 'system' },
];
const buckets = ['account-management', 'system'];

const fresh = () => createPlacementState(items, buckets);

// ---------------------------------------------------------------------------
// pickUp
// ---------------------------------------------------------------------------

test('pickUp holds the item', () => {
  const s = pickUp(fresh(), 'i-1');
  assert.equal(s.held, 'i-1');
});

test('pickUp on the held item releases it — the cancel path', () => {
  const held = pickUp(fresh(), 'i-1');
  const released = pickUp(held, 'i-1');
  assert.equal(released.held, null);
});

test('picking up a different item while one is held switches, not stacks', () => {
  const s = pickUp(pickUp(fresh(), 'i-1'), 'i-2');
  assert.equal(s.held, 'i-2');
});

test('picking up an already-placed item does not disturb its placement', () => {
  const placed = place(pickUp(fresh(), 'i-1'), 'system');
  const held = pickUp(placed, 'i-1');
  assert.equal(held.placements['i-1'], 'system', 'the placement changed just from picking it up');
  assert.equal(held.held, 'i-1');
});

// ---------------------------------------------------------------------------
// place
// ---------------------------------------------------------------------------

test('place commits the held item to a bucket and releases it', () => {
  const s = place(pickUp(fresh(), 'i-1'), 'system');
  assert.equal(s.placements['i-1'], 'system');
  assert.equal(s.held, null);
});

test('place with nothing held is a no-op', () => {
  const s = place(fresh(), 'system');
  assert.deepEqual(s.placements, fresh().placements);
  assert.equal(s.held, null);
});

test('placing again moves the item rather than stacking a second placement', () => {
  const first = place(pickUp(fresh(), 'i-1'), 'system');
  const moved = place(pickUp(first, 'i-1'), 'account-management');
  assert.equal(moved.placements['i-1'], 'account-management');
});

test('placing one item leaves the other item untouched', () => {
  const s = place(pickUp(fresh(), 'i-1'), 'system');
  assert.equal(s.placements['i-2'], null);
});

// ---------------------------------------------------------------------------
// returnItem — send a placed item back to unplaced
// ---------------------------------------------------------------------------

test('returnItem unplaces an item without choosing a new bucket', () => {
  const placed = place(pickUp(fresh(), 'i-1'), 'system');
  const returned = returnItem(placed, 'i-1');
  assert.equal(returned.placements['i-1'], null);
});

test('returnItem on the held item also releases it', () => {
  const held = pickUp(fresh(), 'i-1');
  const returned = returnItem(held, 'i-1');
  assert.equal(returned.held, null);
});

test('returnItem on an item that is not held leaves the held item alone', () => {
  const held = pickUp(fresh(), 'i-2');
  const returned = returnItem(held, 'i-1');
  assert.equal(returned.held, 'i-2');
});

// ---------------------------------------------------------------------------
// isComplete
// ---------------------------------------------------------------------------

test('a fresh state is not complete', () => {
  assert.equal(isComplete(fresh()), false);
});

test('complete once every item has a bucket, right or wrong', () => {
  const s = place(pickUp(place(pickUp(fresh(), 'i-1'), 'account-management'), 'i-2'), 'account-management');
  assert.equal(isComplete(s), true, 'a wrong placement still counts as placed');
});

test('one unplaced item is enough to keep it incomplete', () => {
  const s = place(pickUp(fresh(), 'i-1'), 'system');
  assert.equal(isComplete(s), false);
});

// ---------------------------------------------------------------------------
// checkPlacements
// ---------------------------------------------------------------------------

test('checkPlacements marks a correct placement correct', () => {
  const s = place(pickUp(fresh(), 'i-1'), 'account-management');
  const [result] = checkPlacements(s);
  assert.equal(result!.correct, true);
  assert.equal(result!.correctBucket, 'account-management');
});

test('checkPlacements marks a wrong placement wrong and still names the right bucket', () => {
  const s = place(pickUp(fresh(), 'i-1'), 'system');
  const [result] = checkPlacements(s);
  assert.equal(result!.correct, false);
  assert.equal(result!.placedBucket, 'system');
  assert.equal(result!.correctBucket, 'account-management');
});

test('checkPlacements reports an unplaced item as incorrect with a null placed bucket', () => {
  const [, second] = checkPlacements(fresh());
  assert.equal(second!.correct, false);
  assert.equal(second!.placedBucket, null);
});

test('checkPlacements covers every item, not only the ones touched', () => {
  const s = place(pickUp(fresh(), 'i-1'), 'account-management');
  assert.equal(checkPlacements(s).length, items.length);
});
