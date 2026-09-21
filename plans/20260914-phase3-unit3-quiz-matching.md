# Phase 3 Unit 3 — Quiz + Matching/drag-classify (implementation plan)

**Date:** 2026-09-14 · **Issues:** [#36](https://github.com/voltron-1/SEIM-Academy/issues/36),
[#37](https://github.com/voltron-1/SEIM-Academy/issues/37) ·
**Epic:** [#5](https://github.com/voltron-1/SEIM-Academy/issues/5) · Unit 3 of 4 ·
**Phase plan:** [`plans/20260911-phase3-core-components.md`](20260911-phase3-core-components.md)

**Done when:** both components answer inline with neutral copy and no separate results page;
the matching interaction is fully operable by keyboard *and* by pointer; both pass axe and a
keyboard-only drive.

## The decision this unit turns on

**Select-then-place is the primary interaction. Drag is layered on top of it.**

The accessibility baseline says every drag-classify interaction "ships a keyboard/click-to-select
equivalent from day one, not as a later add-on". The usual reading is *build drag, then add
keyboard*. That produces a second-class keyboard path — it is written last, tested last, and
breaks first, because the real state lives in the drag implementation and the keyboard route
has to reach around it.

So the model is inverted. The component's state machine is **pick up an item → put it in a
bucket**, driven by two operations that know nothing about pointers. A click drives them. So
does `Enter` on a focused item. Pointer drag is a *third* caller of the same two operations,
not a parallel implementation. The keyboard path cannot rot, because it is the only path
there is — everything else is a way of invoking it.

This also means the keyboard test is not a separate suite bolted alongside a drag suite. It is
the primary test, and the drag test asserts that pointer events reach the same reducer.

**Pointer Events, not the HTML5 drag-and-drop API.** HTML5 DnD does not fire on touch at all,
so `#37`'s touch requirement would need a third code path. `pointerdown`/`pointermove`/`pointerup`
covers mouse, touch and pen in one.

## Honest limit, stated up front

**There is still no browser in this environment.** happy-dom will dispatch pointer events and
the state machine can be asserted end to end, but *drag ergonomics* — hit targets, drop
tolerance, momentum, whether a real finger can actually hold and move an item — cannot be
verified here. This unit will claim the state machine is correct and will **not** claim the
drag feels right. That verification is a browser item and belongs with
[#39](https://github.com/voltron-1/SEIM-Academy/issues/39) and Phase 8's #98/#99.

Saying so now is the point. Phase 2 carried an unverified Lighthouse clause forward by naming
it; the same applies here.

## Two components, gated separately

### Step 1 — Quiz (#36): multiple-choice and fill-in-the-blank

`payload` is one of (§4.4):
- `{ format: "multiple-choice", question, choices: string[3..6], answer_index, rationale }`
- `{ format: "fill-blank", question, blank_answer, accepted: string[], rationale }`

**Feedback is inline and immediate, never a separate results page.** One answer, then the
result appears in place below it.

**The rationale is always shown — right or wrong.** It is generated from the source Description
cell and cites the row it came from (§4.4), so it is the teaching content, not a consolation
prize. Showing it only on a wrong answer would mean a learner who guessed correctly learns
nothing.

**Answering is once.** Re-answering after the correct answer is on screen tests nothing, and a
retry loop invites the "get it right before moving on" pressure the anxiety-safe rules exist to
remove. Wrong is informational and the learner moves on.

**Copy pattern, applied in both components.** BUILD-PLAN: *"Wrong-answer feedback states what's
true and why in neutral language — no shame-adjacent copy, no harsh red flash."* So: state the
answer, then the rationale. No "Incorrect", no "Sorry", no "Try again", no exclamation marks.
A test asserts the banned words do not appear, the same way Unit 2's grade-button test does.

**Fill-blank matching** is trimmed and case-insensitive against `blank_answer` plus every entry
in `accepted`. `accepted` exists for genuine alternatives (`4624` / `Logon`), not for casing —
making a learner lose on capitalisation is exactly the punitive-for-no-reason failure the
principles rule out. Internal whitespace is collapsed too, so `Event  ID` matches `Event ID`.

### Step 2 — Matching / drag-classify (#37)

Two formats share one state machine (§4.6):
- `{ format: "drag-classify", items: {label, bucket}[], buckets: string[] }`
- `{ format: "match", pairs: {left, right}[] }` — the right-hand values are the buckets

**The state machine** is a pure module, `src/state/placement.ts`, tested without any DOM:
`pickUp(state, itemId)`, `place(state, bucketId)`, `returnItem(state, itemId)`, plus
`isComplete` and `checkPlacements`. Same posture as `srs.ts` — the logic that can be wrong in a
checkable way lives outside the component.

**Three ways to drive it, one implementation:**

| Input | Operation |
|---|---|
| Click item, click bucket | `pickUp` then `place` |
| `Enter`/`Space` on focused item, then on a bucket | `pickUp` then `place` |
| Pointer drag from item to bucket | `pickUp` on `pointerdown`, `place` on `pointerup` over a bucket |

`Escape` cancels a pick-up from any of the three. An item already placed can be picked up
again and moved — placements are never final until the learner asks to check.

**What is on screen is what is true.** The held item is announced in a live region, buckets say
how many items they hold, and nothing about the arrangement is hidden — BUILD-PLAN's external
working memory rule.

**Feedback is per item, inline, and non-punitive.** Wrong placements say where the item belongs
and why; correct ones are marked. Shape plus text, never colour alone.

## Files

| File | Change |
|---|---|
| `src/atoms/Quiz.tsx` / `.css` / `quiz.test.tsx` | **new** — both quiz formats |
| `src/atoms/Matching.tsx` / `.css` / `matching.test.tsx` | **new** — both exercise formats |
| `src/state/placement.ts` / `placement.test.ts` | **new** — the pure pick-up/place machine |
| `src/atoms/Feedback.tsx` | **new** — the shared inline-feedback block and its live region |
| `src/atoms/index.tsx` | replace the two reveal-only renderers |
| `scripts/run-tests.mjs` | `MIN_TEST_FILES` 10 → 14 |

## Constraints inherited, not re-decided

- `AtomView({ atom, hint, nextDifficulty, srsCard, onGrade })` — additive props only.
- `chromeFor()` owns anxiety-safe chrome; a component hiding something belongs there.
- Animation routes through `--motion-duration`. A drag that ignores reduced motion is the
  obvious way to break Decision 5.
- Raw HTML stays disabled. Payload values read through `atoms/payload.ts`.
- Colour is never the only signal.

## Verification

`npm run verify`. Each new gate fired before it is trusted, per the phase's posture:

- The keyboard drive is run against a mouse-only implementation to watch it fail — Unit 2
  proved axe alone does not catch a non-button control, so this is the gate that matters.
- The banned-copy assertion is run against a component that says "Incorrect" to watch it fail.
- The pointer test asserts `pointerup` reaches the same reducer the keyboard does, by
  asserting on resulting state rather than on a spy.
