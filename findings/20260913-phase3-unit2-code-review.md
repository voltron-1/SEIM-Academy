# Code review — Phase 3 Unit 2 (flashcard + SRS)

Branch `claude/phase3-unit2-flashcard-srs` vs `main`. Reviewer: code-reviewer sub-agent.
Scope: SEIMAcademy/app, per plans/20260913-phase3-unit2-flashcard-srs.md.

> **Resolution (2026-09-13, same session):** every Must-Fix, Medium and Low finding below was
> fixed on `claude/phase3-unit2-flashcard-srs` before commit, each with a regression test that
> was watched failing first. Deferred with reasons: the app-wide error boundary and the CSP
> (both pre-existing and larger than this unit), and deck-size/`teaches` caps in `migrate()`
> (the window-bounded scan removes the practical cost, so the caps buy little).



## Must Fix

1. **`SEIMAcademy/app/src/state/session.tsx:104-107,139,142-147` + `SEIMAcademy/app/src/views/Lesson.tsx:91-95,118-121`
   — grading a card silently loses the schedule update on every single grade, in memory
   and on disk.**

   `onGrade` (Lesson.tsx:118-121) does:
   ```
   onGrade={(grade) => {
     session.gradeCard(atom, grade);
     advance();
   }}
   ```
   and `advance` (Lesson.tsx:91-95) does `session.completeAtom(atom.id)` synchronously,
   in the same tick, right after. Both `gradeCard` and `completeAtom` are closures created
   in the same `useMemo` pass in session.tsx and both close over the *same* `persisted`
   `const` (session.tsx:116-169). `commit` (session.tsx:104-107) always does
   `setPersisted(next)` with a literal value, never a functional updater, and unconditionally
   writes `next` to storage:
   ```
   const commit = useCallback((next: PersistedState) => {
     setPersisted(next);
     setStorageWorks(savePersisted(storage(), next));
   }, []);
   ```
   Trace: `gradeCard` computes `next1 = {...persisted, srsCards: {...updated card...}}` and
   calls `commit(next1)` — `setPersisted(next1)` is queued and `savePersisted(storage(), next1)`
   writes `next1` to localStorage immediately. `advance()` then calls `completeAtom`, which
   computes `next2 = completeAtomIn(persisted, atomId, today)` — spread from the *same stale*
   `persisted`, i.e. `next2.srsCards === persisted.srsCards`, the pre-grade value. `commit(next2)`
   then calls `setPersisted(next2)` (the second literal `setState` call wins — Preact/React do
   not merge two same-tick `setState(value)` calls) and `savePersisted(storage(), next2)`, which
   overwrites the localStorage entry written a moment ago. The net effect, reproducible every
   time: **the just-recorded ease/interval/repetitions/dueDay update is discarded**, both from
   the in-memory `persisted` state and from `localStorage`. The SM-2 scheduler this unit exists
   to ship never actually persists a grade through the one UI path that grades cards.

   This is not a pre-existing latent issue being newly exposed — it is new in this diff. Before
   this change, no handler in Lesson.tsx called two `session.*` mutators synchronously in the
   same tick (`grep` for `session\.(completeAtom|setPosition|toggleFlag|startLesson|gradeCard)`
   in `src/views/Lesson.tsx` shows `setPosition` only runs from its own `useEffect`, never
   chained with `completeAtom`). `onGrade` is the first call site that chains two.

   Fix: either have `commit` accept an updater function (`setPersisted(prev => ...)`) and make
   `gradeCard`/`completeAtom`/etc. compute their patch from `prev` instead of the closed-over
   `persisted`, or fold the grade into `completeAtom` itself (single `commit` call) so grading a
   card and completing it write once. Whatever the fix, add a regression test that calls
   `session.gradeCard` followed by `session.completeAtom` in the same synchronous block and
   asserts the resulting persisted state contains *both* updates — this is exactly the class of
   bug the existing per-module unit tests cannot see, since srs.test.ts and persistence.test.ts
   each test their module in isolation and session.tsx has no test file at all.

## Should Fix

2. **`SEIMAcademy/app/src/state/persistence.ts:99` — `typeof candidate.srsCards === 'object'` does not exclude arrays.**
   `typeof [] === 'object'` is `true`, so a malformed/hand-edited `srsCards` that is an array
   would pass the container check and be iterated with `Object.entries`, producing numeric
   string keys (`"0"`, `"1"`, ...) rather than the card's own `atomId`. If the array's elements
   happen to pass the per-card shape check (lines 102-113), they'd be stored under the wrong
   key, so `srsCardFor(state, atomId)` (persistence.ts:205-206) would never find them — an
   orphaned, unreachable card rather than a rejected one. Low severity (only reachable via
   hand-edited storage, not from anything a real prior build ever wrote — the "old build" safety
   claim in the plan holds for genuine legacy data), but it undercuts the file's own stated
   intent ("a card is kept only if every field it schedules on is the right shape" — the
   container's own shape isn't checked). Suggest `Array.isArray(candidate.srsCards) ? {} : ...`
   guard, or `!Array.isArray(v) && typeof v === 'object'`.

## Consider

3. **`SEIMAcademy/app/src/state/srs.ts:168-203` `buildReviewQueue` — O(n²)–O(n³) in the worst
   case.** `conflictDistance` (line 174) scans back over the entire built `queue` for every
   candidate in `remaining`, and the outer loop does this for every position — fine at the
   scale of a lesson's review deck (tens of cards), but worth a comment or a window-bounded
   scan (`back <= Math.min(queue.length, someBound)`) if decks ever grow into the hundreds.
   Not a correctness issue: termination, permutation-preservation, and determinism all hold
   for every case checked by hand (single card, all-same-tag, all-empty-tags, duplicate atom
   ids) — see "Looks Good" below.

4. **`SEIMAcademy/app/src/atoms/Flashcard.tsx:38-39` vs `SEIMAcademy/app/src/atoms/index.tsx`
   — the `str()` payload accessor is duplicated** rather than shared from one place. Minor
   DRY nit, not a bug (both copies are identical and read-only).

## SM-2 verification (independent of srs.test.ts)

Hand-computed all four pinned sequences against `nextInterval`/`review`
(`SEIMAcademy/app/src/state/srs.ts:94-131`) and confirmed the order is correct — `nextInterval`
is computed from `card.ease`/`card.repetitions` *before* `nextEase` runs (review():118-131), so
a grade's ease effect lands on the next interval, not this one, matching the published spec.

- `4,4,4,4,4` -> intervals **1, 6, 15, 38, 95**, ease stays 2.5 throughout. Confirmed by hand
  (repetitions climb 0→1→2→3→4→5; `nextEase(*, 4)` is a zero-delta at every step; `round(15*2.5)
  = 38` [not 37 — `Math.round(37.5)` rounds half-up], `round(38*2.5)=95`). Matches
  `srs.test.ts:45-48`.
- `5,5,5,5` -> intervals **1, 6, 16, 45**. Ease climbs 2.5→2.6→2.7→2.8. `round(6*2.7)=16`,
  `round(16*2.8)=44.8→45`. An ease-first implementation would give 17 then 47, as the plan
  states. Matches `srs.test.ts:58`.
- `4,4,2,4,4,4` -> intervals **1, 6, 1, 1, 6, 13**. The `2` (a lapse, `q<3`) forces
  `nextInterval` to return `FIRST_INTERVAL_DAYS` unconditionally (srs.ts:96) regardless of the
  card's current `repetitions`, and `review()` resets `repetitions` to 0 (not the ease) on a
  lapse (srs.ts:126). Ease after the lapse: `nextEase(2.5, 2) = 2.5 + (0.1 - 3*(0.08+3*0.02)) =
  2.18`, which is *not* reset, so the climb restarts 1→6→`round(6*2.18)=13.08→13`. Matches
  `srs.test.ts:64`.
- `0,0,0` -> ease **1.7, 1.3, 1.3**. `nextEase(2.5,0)=1.7`; `nextEase(1.7,0)=0.9→` floored to
  `MIN_EASE=1.3`; `nextEase(1.3,0)=0.6→` floored to `1.3`. Matches `srs.test.ts:68`.

All four expected sequences in both the plan and `srs.test.ts` are correct — no wrong numbers
enshrined. `roundEase` (srs.ts:75) correctly avoids the binary-float drift the comment
describes (`2.5 + (0.1 - 3*(0.08+3*0.02))` really is `2.1799999999999997` before rounding).

## `buildReviewQueue` correctness

Verified by tracing the algorithm (srs.ts:168-203), not just running the tests:
- **Termination**: the `while (remaining.length > 0)` loop always removes exactly one element
  via `remaining.splice(bestIndex, 1)`, so it terminates in exactly `cards.length` iterations —
  no path re-adds to `remaining`.
- **Permutation, always**: every element that leaves `remaining` is pushed to `queue` and
  nothing is ever dropped or duplicated, for any input shape — single card, all-same-tag,
  all-empty-tags, and duplicate atom ids all hold, because the algorithm operates on array
  elements/positions, not on `atomId` identity, so duplicate ids can't collide.
- **Determinism**: no `Math.random`; tie-breaking is deterministic (`distance > bestDistance`
  is strict, so the first-seen candidate wins ties), so the same input array always produces
  the same output.
- **All-empty-tags**: `shareTopic` (srs.ts:153) uses `.some(...)` over an empty `teaches` array,
  which is always `false`, so `conflictDistance` is always `Infinity` and the original order is
  preserved untouched — correctly matches the "an untagged card never blocks another card" test.

## `STATE_VERSION` decision

Confirmed safe for any state a genuinely older (pre-#35) build could have written: `migrate()`
(persistence.ts:77-150) only touches `candidate.srsCards` inside
`if (candidate.srsCards && typeof candidate.srsCards === 'object')` (line 99); a pre-#35 payload
never has that key at all, so the branch is skipped and `srsCards` is left at the `{}` declared
on line 98 — every other field (`streakDays`, `position`, `flags`, etc.) is migrated exactly as
before this diff, untouched by the new code. The only shape that migrates to something other
than empty-and-correct is the adversarial array-typed `srsCards` in Should-Fix #2 above, which
is not something any real build ever wrote — only hand-edited storage could produce it.

## Comment-vs-code check

No disagreements found. Spot-checked the highest-risk comments against behavior:
- srs.ts:105-108 ("order is interval first, then ease... 17 where the specification says 16")
  — verified true by hand above.
- srs.ts:158-163 ("the window never drops a card") — true; the loop structurally cannot drop
  an element (see permutation analysis above).
- persistence.ts:72-75 ("Unreadable state resets to empty rather than throwing") — true,
  `migrate`/`load` wrap in try/catch and fall back to `emptyState()` (persistence.ts:78,
  236-241), unaffected by this diff.
- session.tsx has **no** comment anywhere claiming `commit` calls are safe to sequence
  synchronously — the Must-Fix bug above is a missing safeguard, not a comment that
  overclaims correctness it doesn't have.

## Looks Good

- SM-2 order of operations (interval before ease) is implemented exactly as specified, and
  `nextInterval`/`review` share logic cleanly with no duplication (srs.ts:94-131).
- `roundEase` correctly guards against float drift, with a comment that shows its own math.
- `buildReviewQueue`'s permutation guarantee is structural (can't drop a card) rather than
  tested-in-only, and the "unshuffled order would fail" test (srs.test.ts:160-168) is a real
  negative-control, not a tautology.
- `persistence.ts`'s per-card shape validation on migration (lines 100-125) is genuinely
  defensive — one corrupt card is dropped without taking the whole deck down, and this is
  tested (persistence.test.ts, "a card of the wrong shape is dropped...").
- Flashcard.tsx's grade-preview (`nextInterval` called for display, srs.ts:94, Flashcard.tsx:98)
  correctly keeps "what will this button do" separate from "do it" — no risk of a render
  accidentally scheduling a card.
- flashcard.test.tsx's keyboard section (lines 98-153) genuinely contains zero mouse events,
  and the axe checks run both before and after reveal — matches the plan's verification
  posture.

## Verdict

Request changes — the Must-Fix item is a full regression of the feature's core purpose (grades
are computed correctly by `srs.ts` but never durably persisted through the shipped UI path) and
should block merge until `session.tsx`'s `commit`/closure pattern is fixed and covered by a
session-level regression test.
