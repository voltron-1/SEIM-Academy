# Phase 3 — Core components (implementation plan)

**Date:** 2026-09-11 · **Epic:** [#5](https://github.com/voltron-1/SEIM-Academy/issues/5) ·
**Task issues:** #34–#39

**Exit check:** all core components pass keyboard/screen-reader smoke tests; SRS unit tests
pass; test-out correctly gates against tags.

## The decision taken at the phase gate

**Phase 3's exit check was not verifiable with what existed.** Every test through Phases 1
and 2 was state-level; there was no DOM harness, and no browser in the build environment.
Building five components and *then* discovering they could not be verified would repeat the
Phase 1 mistake — a gate tested only with the shape that passes.

So **Unit 1 is the harness**, and it comes before any component.

**happy-dom + Testing Library + axe-core**, all devDependencies, outside the
free/self-hosted critical path the BUILD-PLAN dependency policy governs. Testing Library
makes you query by role and accessible name, so *the natural way to write the test is the
accessibility assertion* rather than a separate pass. axe-core pulls Phase 8's #98 gate
forward to where an inaccessible interaction is still a fix rather than a rewrite.

No new test runner: `node --test` still runs everything, with two small ESM hooks
(`src/test/resolve-hook.mjs`) doing the two things Vite does that Node does not —
extensionless relative imports, and treating a component's own stylesheet import as inert.
Adding `.js` to every import across the app to satisfy a runner would have made the
production source worse in order to serve the tests.

## Units, gated

**Unit 1 — harness + Instructions atom** (#34)
The harness, then the Instructions atom, because it is the schema-enforced prerequisite of
every exercise atom (§6.4) and every other component in this phase depends on its shape.
Includes the difficulty tag surfaced up front, per *difficulty ramps are visible and
gradual, never a cliff*.

**Unit 2 — Flashcard + SRS** (#35)
SM-2 scheduler as a pure module, unit-tested against known interval sequences, plus the
enforced topic-diversity/interleaving window. The scheduler is the one piece in this phase
with a correct answer that can be checked against a specification rather than an opinion.

**Unit 3 — Multiple choice / fill-in-the-blank** (#36) **and Matching / drag-classify** (#37)
Inline feedback, never a separate results page. Neutral, non-punitive wrong-answer copy.
The drag interaction ships its **keyboard-operable equivalent in the same PR** — the
accessibility baseline says day one, not as a later add-on — plus touch support.

**Unit 4 — Test-out check** (#38) **and the cross-component a11y sweep** (#39)
3–5 generation-format questions per module, gating on the module's `teaches` tags. Passing
skips ahead; anything else drops into the normal queue with no penalty and **no record of
failure**. Then the keyboard-only and screen-reader sweep across all five components.

## Constraints inherited from Phase 2

These are constraints, not tasks. They bind every unit:

- **The renderer contract `AtomView({ atom, hint, nextDifficulty })` should not need to
  change.** Phase 2 built the shell around it deliberately.
- **`chromeFor()` is where anxiety-safe chrome rules are asserted and tested.** A component
  that needs to hide something belongs there, not in its own CSS.
- **Reduced motion is a hard default** (Decision 5, closed). Route any animation through
  `--motion-duration`; the global rule already enforces it.
- **Raw HTML stays disabled in the renderer** (`app-data-schema.md` §7). No Markdown library
  entered the critical path in Phase 2.
- **Colour is never the only signal.** Every state a component expresses with `--danger` or
  `--success` needs a shape or icon alongside it.

## Verification posture

Each unit ships the check that would catch its own failure, and each new gate is proven to
fire before it is trusted:

- The empty-suite guard was added after the suite reported `# pass 0` and exited 0.
- The axe gate was verified by feeding it a real violation and confirming it reports
  `image-alt` and `button-name` with help URLs.
- Unit 3's keyboard equivalent is asserted by driving it with key events only — no mouse
  events in the test at all.
