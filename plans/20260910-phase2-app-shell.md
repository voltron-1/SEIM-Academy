# Phase 2 — App shell (implementation plan)

**Date:** 2026-09-10 · **Epic:** [#4](https://github.com/voltron-1/SEIM-Academy/issues/4) ·
**Milestone:** Phase 2 — App shell · **Task issues:** #20–#33

**Exit check (`execution.md`):** pilot module plays start-to-finish through the shell;
reload resumes exactly where the learner left off; killing network mid-session shows no
error state; Lighthouse PWA installability passes.

## Decisions taken at the phase gate (2026-09-10)

**View layer: Preact + TypeScript, built with Vite.** ~4 KB runtime, MIT, no usage-based
pricing — satisfies the BUILD-PLAN dependency policy for the free/self-hosted critical
path. The atom renderer is type-dispatched view code, which is what a component model is
for, and Phase 3's SRS scheduler and drag-classify-with-keyboard-equivalent are materially
easier with a diffing renderer. Vite emits a static bundle suitable for GitHub Pages
(Decision 1's deferred default). Explicitly **not** Next.js/React, per BUILD-PLAN.

**Decision 5 — RESOLVED: reduced motion is a hard default.** No transitions or animations
ship unless a learner opts in. The audience is explicitly ADHD and anxiety-safe; motion is
a known trigger; and BUILD-PLAN states the anxiety-safe rule wins where principles
conflict. Deciding it now costs one token set. Deciding it in Phase 9 would mean auditing
every animation added across Phases 3–7. This closes Decision 5 rather than carrying it.

## What the shell must actually render

Measured from the Phase 1 output, not assumed:

| Atom type | Count | Phase 2 scope |
|---|--:|---|
| `flashcard` | 449 | Front/back reveal. **SRS scheduling is Phase 3.** |
| `reading` | 67 | Full render — Markdown subset only |
| `quiz` | 64 | Renders question + choices. **Answer handling is Phase 3.** |
| `instructions` | 63 | Full render — fixed Goal / What you'll use / How you'll know anatomy |
| `exercise` | 63 | Renders prompt + payload shape. **Interaction is Phase 3.** |
| `predict` | 1 | Full render — ungraded, reveal on demand |

`scenario` and `capstone-step` are in the schema but unused until Phases 4/6. The renderer
dispatches on all eight so adding content does not mean touching the shell.

64 lessons, 707 atoms, ~300 minutes of content. Play order comes from
`content/build-manifest.json` → `modules[].lesson_order`, not from filename sort.

**Phase 2 builds the shell, Phase 3 builds the interactions.** An atom renderer that
displays an exercise faithfully but does not yet score it is the correct Phase 2 deliverable;
the shell contract must not change when Phase 3 fills the internals in.

## Hard constraint inherited from Phase 1

`app-data-schema.md` §7 is normative: **the renderer MUST parse `body` with raw HTML
disabled and MUST treat every `payload` string as text, not markup.** Content is generated
from a third-party source repository; the build-time markup check is a backstop, not a
substitute. `innerHTML`, `dangerouslySetInnerHTML`, and a Markdown parser left on
permissive defaults are out of contract. The Markdown subset is small enough to render
directly (bold, inline code, fenced code, unordered lists, repo-relative links) — so it is
rendered directly, with no Markdown library in the critical path.

## Units of work, gated

**Unit 1 — project + tokens** (#20, #21, #22, #23)
Vite + TS + Preact scaffold under `SEIMAcademy/app/`. Dark theme token system
(`--bg`, `--surface`, `--text`, `--accent`, `--danger`, `--success`). Type system:
monospace for log/SPL/event data, humanist sans for prose. Reduced motion as a hard
default in the token layer.
*Contrast is verified by a script, not by eye* — the same posture as the Phase 1
validators: every token pairing computed against WCAG 2.1 AA (4.5:1 body, 3:1 large
text/UI), failing the build on a violation.

**Unit 2 — shell chrome** (#24, #25, #29, #30)
Left rail (Today / Tier 1 / Tier 2 / Copilot / Review), persistent HUD (progress, streak,
"N left today"), persistent exit affordances (Skip / Hint / Pause / Exit to Today) rendered
once by the shell and never hidden, Focus mode toggle.

**Unit 3 — atom renderer + persistence** (#26, #27, #31)
One shared renderer per atom type, one atom per screen. Local persistence
(localStorage/IndexedDB) with autosave position per atom and resume-exactly-here. "Flag
this" on every atom.

**Unit 4 — offline/degraded + PWA** (#28, #32)
Degraded render for every async boundary, built alongside the happy path rather than after:
failed content load → last-known-good cached lesson with a calm retry; unreachable copilot
→ "offline — here's the source doc". Service worker, app manifest, offline app-shell
caching.

**Spike (parallel, non-blocking)** (#33)
Throwaway local-model feasibility check (Ollama or WebLLM) to de-risk Phase 7 before its
architecture locks in. Does not gate anything in Phase 2.

## Verification posture

Phase 1's lesson was that a gate you test with only the easy case is not a gate. Each unit
ships with the check that would catch its own failure:

- Unit 1 — contrast computed for every token pairing, not spot-checked.
- Unit 3 — resume tested by killing and restoring state mid-lesson, not by reading code.
- Unit 4 — offline tested by actually cutting the network mid-session.

## Out of scope

SRS scheduling, answer grading, drag interaction and the test-out check are Phase 3.
The copilot itself is Phase 7; Phase 2 builds only the offline-degraded panel it will
occupy.
