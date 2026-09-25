# Phase 3 closeout + Phase 4 Unit 1 (issue #40) — action plan

Source repo for all Phase 4 content: **`TonyPhipps/SIEM` @ `4adb971`** (GPL-3.0), vendored
at `/Source_Repos/SIEM`, confirmed correct per Phase 0 Decision 4 — re-confirmed this
session after a scope question (Suburban-SOC is a separate, unrelated project; nothing in
SEIM-Academy was ever built from it).

Two independent gated phases. Each executes only after explicit go-ahead.

---

## Phase 1 — Phase 3 tracking closeout (housekeeping, no app code)

**Why:** Phase 3 work is done (all 6 native sub-issues of epic #5 closed; #118 Review route
merged via PR #124, already on `main`), but the tracking layer never caught up: epic #5 is
still open with its markdown Tasks checklist 100% unchecked, milestone #4 is still open,
and `planned_execution.md` still describes #118 as pending. This blocks a clean read of
"what's actually next" for anyone (including future sessions) reading the tracker.

**Steps:**
1. `execution.md` — tick Phase 3's checklist items to `[x]` (Instructions atom, Flashcard/SRS
   + sub-items, MC/fill-blank + sub-items, Matching/drag-classify + sub-items, Test-out +
   sub-items, keyboard/screen-reader smoke test). Cross-check against what actually shipped
   per PRs #110, #122, #123, #124 before ticking each one — don't rubber-stamp.
2. Issue #5 — tick the same items in the issue body, then close the issue with a comment
   linking PR #124 as the closing evidence for the Review-route item and noting all 6
   sub-issues + #118 as done.
3. Close milestone #4 ("Phase 3 — Core components") via `gh api -X PATCH
   repos/voltron-1/SEIM-Academy/milestones/4 -f state=closed`.
4. `planned_execution.md` — move NEXT UP to Phase 4 / issue #40, add a LAST SESSION entry
   dated 2026-09-25 recording the Phase 3 closeout + tracking-discrepancy catch.
5. Commit (`execution.md`, `planned_execution.md`) and push. Issue/milestone edits are
   separate `gh` calls, not part of the commit.

**Exit check:** `gh issue view 5 --json state` → closed; milestone 4 → closed;
`planned_execution.md` NEXT UP names #40.

---

## Phase 2 — Issue #40: "Run pipeline: SOC orientation & what you're protecting"

**Why:** First item of Phase 4 (Tier 1 complete). Content-generation task, not app code —
extends the pipeline built in Phase 1 (PR #110) to a new source shape.

**Sources** (verified, read via `cat` — `/Source_Repos/SIEM` is outside allowed Read-tool
paths but not outside the repo the pipeline is *documented* to pull from):
- `README.md` (79 lines) — intro bullets + curated link list (Preparation, Hardening,
  Detection/Compliance Matrix, Data Enrichment, Lab, TODO sections)
- `Orientation/crown-jewels.md` (9 lines) — 1 heading, 1 intro sentence, 7 open-ended
  orientation questions ("What is the most sensitive data and where is it stored?", etc.)

Per `curriculum-map.md` line 22: format "reading atom + quiz", viability "Ready".

**Design decision — new profile, not an extension of `event-id-tables`.**
`lesson-kit.mjs`'s own header comment anticipates this: *"a module whose source is not a
table of Event IDs needs its own parsing and its own atom shapes... Everything
profile-agnostic lives here so the next profile inherits it instead of copying it."*
`markdown.mjs`'s parser is explicitly scoped to the Notable-Event-IDs table corpus
(5 known column layouts) — not reusable for prose. Only `parseSections` (heading-split,
works generically) carries over from it.

**New profile: `SEIMAcademy/scripts/lib/profiles/prose-orientation.mjs`**
(name chosen narrow, not generic "prose" — Phase 6 modules have different enough shapes
that a shared generic profile is a premature abstraction; revisit if a second prose-shaped
module in Phase 4/6 turns out to need the exact same logic).

Reuses: `parseSections` (`markdown.mjs`), `SCHEMA_VERSION`/`SECONDS`/`makeAtom`/
`deterministicId`/`contentHash`/`truncateTitle` (`atoms.mjs`), `normalizeTags`/`slug`/
`conceptTag` (`tags.mjs`), `finalizeLesson`/`pickDistinctChoices` (`lesson-kit.mjs`).

Content plan, honest to the ~88 lines of source (no invented content, no padded atom count):

- **Lesson `t1-m01-orientation`** (crown-jewels-driven):
  - 1 `reading` atom: README's intro bullets (lines 1–5) — what a SIEM team's resources are
    for. `teaches: ["concept:soc-purpose"]`.
  - 7 `predict` atoms: crown-jewels.md's 7 questions verbatim as `prompt`. These are
    genuinely open-ended with no single right answer — §4.1 fits exactly (`predict` is the
    *ungraded retrieval-first* type, `graded: false`, no `requires`). `reveal` states the
    honest framing: there's no canonical answer, the question is meant to be worked out
    against your own environment — not a fabricated "correct" answer, which would misrepresent
    source material that is intentionally open-ended.
  - Time budget: 45 (reading) + 7×30 (predict) = 255s — inside 180–420s, no split needed.
- **Lesson `t1-m01-resource-map`** (README-link-list-driven):
  - 1–2 `reading` atoms covering the section groupings (Hardening topics; Detection &
    Compliance Matrix / Data Enrichment / Lab) — `teaches: ["concept:soc-resource-map"]`.
  - 3–4 `quiz` (multiple-choice) atoms of the form "Where would you find X?" with distractors
    drawn from *other real README links* (same honest-distractor principle as
    `event-id-tables`: a wrong choice is a real sibling link, not fabricated). `rationale`
    cites the README line/section it came from.
  - Time budget: ~90 (2 reading) + 4×35 (quiz) = 230s — inside budget.

No `flashcard`, `exercise`, `scenario`, or `instructions` atoms — nothing in this source is
graded/recall-drill shaped, and no `exercise` atom means no `instructions-precede-exercise`
obligation. `dependsOn` empty (Module 1 is the entry point, nothing precedes it).

**New `module-manifest.json` entry** (append to `modules[]`, modeled on `t1-m03`):
```jsonc
{
  "id": "t1-m01",
  "tier": 1,
  "module": "1",
  "title": "SOC orientation & what you're protecting",
  "profile": "prose-orientation",
  "concepts": ["concept:soc-purpose", "concept:soc-resource-map"],
  "options": {},
  "sources": [
    { "path": "README.md", "corpus": "readme" },
    { "path": "Orientation/crown-jewels.md", "corpus": "crown-jewels" }
  ]
}
```

**Register the profile:** add one line to `SEIMAcademy/scripts/lib/profiles/index.mjs`
(`import * as proseOrientation from './prose-orientation.mjs';` +
`[proseOrientation.name, proseOrientation]` in the `PROFILES` map) — per the file's own
"adding a profile is a new file here plus one line below" contract.

**Commands, in order:**
```
node SEIMAcademy/scripts/build-content.mjs --dry-run --verbose
node SEIMAcademy/scripts/build-content.mjs
node SEIMAcademy/scripts/validate-content.mjs
node SEIMAcademy/scripts/check-prereqs.mjs
node SEIMAcademy/scripts/test-pipeline.mjs
python3 SEIMAcademy/scripts/verify-against-source.py
cd SEIMAcademy/app && npm test && npm run build   # confirm app still renders/builds clean
```

**Evidence trail for the PR:** this is a ~2-lesson, ~11-atom module against 88 lines of
source — not PR #110's 64-file scale. No dedicated findings doc needed unless
validate/check-prereqs/verify-against-source surfaces something non-obvious; if clean, the
PR body itself records: dry-run + real build output, validator/prereq/pipeline-test/
verify-against-source pass counts, and app test/build status. Still worth a quick parallel
security-auditor + code-reviewer pass on the new profile file before merge, matching the
pattern from PRs #110/#122/#123/#124 (each caught real bugs pre-merge).

**Exit check:** `t1-m01-orientation` and `t1-m01-resource-map` lessons generated, all
validators/tests green, `check-prereqs.mjs` passes (no `exercise` atoms to gate, but the
check must still run clean against the new `requires`/`teaches` tags), app builds and the
two new lessons are reachable/playable by module id.

---

## Open judgment calls flagged for review before execution

1. **Profile granularity** — one narrow `prose-orientation` profile vs. anticipating Phase 6
   reuse with a more generic name/shape now. Recommendation above: narrow now, generalize
   later only if a second module proves the shape actually repeats — avoids building an
   abstraction against a sample size of one.
2. **`predict` atoms for crown-jewels' 7 questions vs. forcing them into `quiz`.** Forcing
   open-ended questions into multiple-choice would require fabricating a "correct" answer
   the source doesn't provide — a schema-fit call, not a stylistic one. Recommendation:
   `predict`, per §4.1's literal purpose.
3. **Two lessons vs. one.** Splitting keeps each lesson coherent by source file rather than
   packing crown-jewels' predicts and README's quiz into one lesson that mixes two very
   different atom rhythms. Either fits the 180–420s budget; recommendation is the split for
   thematic coherence.
