# Phase 3 Unit 4 — Test-out check + cross-component a11y sweep (implementation plan)

**Date:** 2026-09-21 · **Issues:** [#38](https://github.com/voltron-1/SEIM-Academy/issues/38),
[#39](https://github.com/voltron-1/SEIM-Academy/issues/39) · **Epic:** [#5](https://github.com/voltron-1/SEIM-Academy/issues/5) ·
Unit 4 of 4 · **Phase plan:** [`plans/20260911-phase3-core-components.md`](20260911-phase3-core-components.md)

**Done when:** a learner can test out of a module they already know, on pass their position
skips to the next module, a fail leaves no trace anywhere in persisted state, and all five
core components (Instructions, Flashcard, Quiz, Matching, Test-out) pass one consolidated
keyboard + axe sweep.

## The content gap this unit found before writing any code

`#38`'s checklist says "3–5 generation-format questions... gates correctly on the module's
`teaches` tags." Checked against the actual built content
(`public/content/lessons/t1-m03-*.json`, all 64 lessons): **zero** quiz atoms carry a
`teaches` tag, and zero use `fill-blank` — every one of the 64 is `multiple-choice` with no
tags. Quiz atoms cannot gate on tags they do not have, and multiple-choice is recognition,
not generation.

Flashcards already carry `teaches` (449 of them, all tagged) and are generation-format by
construction — recall the back, not pick from four options. Decision, confirmed with the
user: **test-out questions are drawn from the module's SRS-eligible flashcards**, not from
quiz atoms. No content-pipeline change needed. This is recorded here rather than filed as a
separate issue because it changes nothing outside this unit's own scope.

## Three decisions confirmed with the user before building

1. **Question source:** module flashcards (`atom.type === 'flashcard' && atom.srs.eligible`),
   not quiz atoms.
2. **"Skip ahead" scope:** a pass skips the **whole module** — position moves to the next
   module's first lesson — not just the tested atoms. There is no mechanism today to mark
   individual atoms "known" outside the normal completed/SRS paths, and a fail must leave
   zero record, so per-atom skipping would need new persisted state this unit does not
   otherwise need.
3. **Pass threshold:** every question correct. Skipping an entire module is a large skip;
   anything less costs the learner nothing (fail = silently back to normal queue), so there is
   no reason to soften the bar.

## Design

### Selection — `src/state/testout.ts` (pure, no Preact, same posture as `srs.ts`)

```ts
export const MIN_TESTOUT_QUESTIONS = 3;
export const MAX_TESTOUT_QUESTIONS = 5;

export function selectTestOutQuestions(atoms: Atom[]): Atom[]
```

Greedy set-cover over `teaches` tags: at each step, pick the eligible flashcard that adds the
most not-yet-covered tags (source order breaks ties, so selection is deterministic — no
shuffle, matching `buildReviewQueue`'s own rule). Stops at 5, or earlier once nothing left
adds new coverage **and** the 3-question minimum is already met. Returns `[]` if the module
does not have 3 eligible flashcards — callers gate the "Test out" affordance on
`module.stats.srs_eligible_cards >= MIN_TESTOUT_QUESTIONS`, a synchronous manifest read, so
the button does not have to fetch every lesson just to decide whether to render.

### Component — `src/atoms` gets no new atom type; this is a view, not a renderer

Test-out is not a lesson atom — it runs *before* a lesson, across a whole module, so it does
not fit the one-atom-per-screen `AtomView` contract and should not be forced into it.
`src/views/TestOut.tsx` is a new, self-contained view:

1. On open, `Promise.all`-fetches every lesson in `module.lesson_order` via the existing
   `loadLesson`, pools their flashcard atoms, and runs `selectTestOutQuestions`.
2. Steps through the selection one at a time: front, a reveal ("Show the answer"), then a
   **binary** self-report — "I knew it" / "I didn't" — deliberately not the SRS's four-grade
   scale, so a learner cannot mistake this for a graded review session. Nothing here calls
   `session.gradeCard` or `session.completeAtom`; test-out never touches SRS state or the
   daily-progress counters, on a pass or a fail.
3. On the last question: all correct → a pass screen with one button that sets
   `session.setPosition` to the next module's first lesson and closes the view. Anything
   else → a neutral "back to the normal path, nothing lost" screen with one button that just
   closes the view — no state changes at all, so there is truly nothing to undo.
4. No next module exists yet (the manifest currently ships one module) → the pass screen says
   so plainly instead of presenting a dead button.

No changes to `session.tsx`/`session-core.ts`: opening/closing test-out and computing the
"next module" are view-local concerns, handled with `useState` in `views/index.tsx`, reusing
`session.setPosition` — the one session API call this needs already exists.

**Entry point:** a "Test out" button next to Start/Resume on the `Today` panel, gated on
`module.stats.srs_eligible_cards >= MIN_TESTOUT_QUESTIONS`. The `Tier` view's `ModuleCard`
list has no navigation at all today (not even Start) — wiring that up is a pre-existing gap,
not part of `#38`, and stays out of scope here.

### Cross-component a11y sweep (#39)

One consolidated test file, `src/test/a11y-sweep.test.tsx`: renders representative instances
of all five components — Instructions, Flashcard, Quiz, Matching, TestOut — and asserts (a)
zero axe violations at rest and once answered/settled, and (b) every interactive control is
reachable and operable by keyboard alone (`Tab` order plus the actual key each component
defines — Enter/Space for Quiz and Matching, as established in Unit 3). This is the
**consolidated** gate the plan promises; it does not replace each component's own existing
a11y tests, which stay where they are.

## Files

| File | Change |
|---|---|
| `src/state/testout.ts` / `testout.test.ts` | **new** — pure selection logic |
| `src/views/TestOut.tsx` / `.css` / `test-out.test.tsx` | **new** — the view |
| `src/views/index.tsx` | add the "Test out" entry point to `Today` |
| `src/test/a11y-sweep.test.tsx` | **new** — the #39 consolidated sweep |
| `scripts/run-tests.mjs` | bump `MIN_TEST_FILES` |

## Constraints inherited, not re-decided

- No SRS writes, no `completedAtomIds` writes, no flags — test-out is diagnostic, not review.
- Colour is never the only signal; neutral copy throughout (Unit 3's banned-word list still
  applies: no "Incorrect", "Wrong", "Sorry", "Try again", "Failed", "Oops", no "!").
- Reduced motion is a hard default; any transition routes through `--motion-duration`.
- Raw HTML stays disabled.

## Verification

`npm run verify`. The keyboard drive is asserted with key events only, same posture as Unit 3.
