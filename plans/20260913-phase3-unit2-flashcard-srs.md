# Phase 3 Unit 2 — Flashcard + SRS (implementation plan)

**Date:** 2026-09-13 · **Issue:** [#35](https://github.com/voltron-1/SEIM-Academy/issues/35) ·
**Epic:** [#5](https://github.com/voltron-1/SEIM-Academy/issues/5) · Unit 2 of 4 ·
**Phase plan:** [`plans/20260911-phase3-core-components.md`](20260911-phase3-core-components.md)

**Done when:** SM-2 scheduler unit-tested against known interval sequences; the
topic-diversity window is enforced and tested; the Flashcard component grades by keyboard
alone with no axe violations.

## Why this unit is specified rather than designed

Every other component in Phase 3 is an opinion about interaction. This one has a published
specification — SuperMemo 2 — so the tests assert *the algorithm*, not *our version of it*.
That is the whole reason it goes second: it is the one place in the phase where "did we
build it right" is a question with an answer.

## The algorithm, written down before it is coded

SM-2 as Wozniak published it. `q` is the learner's grade, 0–5; `q < 3` is a lapse.

```
q < 3  ->  interval = 1, repetitions = 0
q >= 3 ->  interval = 1                   (repetitions == 0)
                      6                   (repetitions == 1)
                      round(interval * EF)  (otherwise)
           repetitions += 1

then, always:
EF = max(1.3, EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)))
```

**Order matters and the published order is: interval first, then EF.** The interval uses the
`EF` in effect at review time, so a grade's effect on `EF` lands on the *next* interval, not
this one. Implementations that update `EF` first and then multiply produce a different
schedule — 17 where the specification says 16 — and are a different algorithm wearing the
same name.

EF is updated on every review including lapses. The original does, and variants that skip it
drift from the published tables the tests check against.

**Known sequences the tests pin** (starting EF 2.5, interval 0):

| Grades | Expected | What it catches |
|---|---|---|
| 4,4,4,4,4 | intervals 1, 6, 15, 38, 95 | `q=4` is the exactly-neutral grade — `EF` must still be 2.5 at the end; off-by-one in the repetition count |
| 5,5,5,5 | intervals 1, 6, 16, 45 | the ordering above. Updating `EF` before the multiply gives 17, then 47 |
| 4,4,2,4,4,4 | intervals 1, 6, **1**, 1, 6, **13** | a lapse resets the repetition count but **not** `EF` — it stays 2.18, so the sixth interval is 13 |
| 0,0,0 | `EF` 1.7, 1.3, 1.3 | the 1.3 floor holds under repeated failure instead of going negative |

The third row is the one worth having. An implementation that resets `EF` on a lapse passes
every other row and fails only this one — it would say **15**, because 6 x 2.5 is the answer
to a question the specification does not ask. The fourth interval being 1 rather than 6 is
the other half: after a lapse the count restarts from zero, so the card climbs 1 -> 6 -> 13
again rather than resuming where it fell.

## The topic-diversity window

BUILD-PLAN: *"Never drill one topic ten-in-a-row — mix adjacent-but-different concepts so
recall requires distinguishing which concept applies."* Flashcards carry non-empty
`teaches` (§4.3, §3), so the tags are already there.

`buildReviewQueue(cards, { window: 3 })` reorders the due set so no two cards within
`window` positions share a `teaches` tag.

**The constraint never drops a card.** When no remaining card clears the window, the queue
takes the one whose conflict is furthest back rather than deferring it to tomorrow. A due
card silently leaving the queue is a retention bug that shows up months later as a gap —
the same failure shape as the §6.5 truncated deck. The test asserts the output is a
permutation of the input, every time, including the pathological all-one-topic deck.

Deterministic: no `Math.random`. A queue that reorders itself on re-render is not testable
and would move a card out from under a learner mid-session.

## Files

| File | Change |
|---|---|
| `src/state/srs.ts` | **new** — scheduler + queue builder. Pure, no Preact, no storage. |
| `src/state/srs.test.ts` | **new** — the table above, the window, the permutation property. |
| `src/atoms/Flashcard.tsx` / `.css` | **new** — reveal, then four grade buttons. |
| `src/atoms/flashcard.test.tsx` | **new** — keyboard-only grading, axe, non-punitive copy. |
| `src/atoms/index.tsx` | replace the Phase 2 inline reveal-only flashcard. |
| `src/state/persistence.ts` | add `srsCards` to `PersistedState`. |
| `src/state/persistence.test.ts` | old state without the field keeps its streak. |
| `src/shell/LeftRail.tsx` | Review shows today's due count (BUILD-PLAN's ambient accountability). |

## Two decisions taken here

**`STATE_VERSION` stays 1.** `migrate()` resets to empty on a version mismatch, so bumping
it would wipe every existing learner's streak and position to add a field. The new field
defaults when absent instead, which is what the tolerant-migration design is for.

**Grade buttons read `Again / Hard / Good / Easy`, mapping to q = 1 / 3 / 4 / 5.** Anxiety-safe
principle 3 is neutral, non-punitive copy: "Again" describes what happens next; "Wrong"
grades the person. Four buttons, not six — a 0–5 scale asks a learner to introspect on a
distinction they cannot make reliably, and the two unused grades are reachable only by a
judgement nobody has.

## Out of scope, filed not forgotten

A full Review route that plays the queue as a session is a larger piece than this issue's
three checkboxes. This unit ships the scheduler, the queue builder, the graded component and
the due count. The route gets a follow-up issue **on the Phase 3 milestone at creation** —
an unmilestoned issue is invisible to `planned_execution.md` and rots.

## Verification

`npm run check` (contrast, types, tsc, tests) plus `npm run build`. Per the phase's posture,
each new gate is fired before it is trusted: the window test is run against a deliberately
un-shuffled queue first to confirm it fails, and the keyboard test drives the component with
key events only — no mouse events in the file at all.
