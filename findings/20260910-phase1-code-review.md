# Phase 1 content pipeline — code review

Scope: `SEIMAcademy/scripts/build-content.mjs`, `validate-content.mjs`, `check-prereqs.mjs`,
`test-pipeline.mjs`, `scripts/lib/{sources,markdown,ps1-labels,tags,atoms}.mjs`,
`app-data-schema.md`, `content/module-manifest.json`, generated samples under `content/lessons/`.

Reviewer: code-reviewer sub-agent. Read-only review; two findings below were confirmed by
actually running the pipeline against `/home/tjlam/projects/SIEM` in scratch output
directories (no files in the working tree or the source repo were modified — sandbox copies
under `/tmp` were used and discarded).

---

## MUST FIX before Phase 2

### 1. Cross-corpus lessons under-report their real dependencies → false "NON-DETERMINISM" / CI failure on legitimate edits
**Files:** `SEIMAcademy/scripts/build-content.mjs:918-953` (`buildCorpusClassifyLessons`, the
`classify-intro`/`classify-instructions`/`classify-drag` atoms), `:1038-1093`
(`buildActionEventLessons`, all four atoms), and the dependency-derivation path
`:376-407` (`finalizeLesson` → `dedupeSources`) feeding `:1134-1151` (`writeOutputs`).

The classify-lesson atoms are stamped with `source: { path: corpora[0].path, ... }` (always
the first corpus doc, e.g. Sigma) regardless of which corpus the selected items actually came
from, and the action-event lesson atoms are stamped with `source: { path: items[0].source.path
}` (always a `Lab/*.ps1` file). Since `finalizeLesson` derives `lesson.sources` — and
`writeOutputs` derives `dependsOn` from it — purely from `dedupeSources(atoms.map(a =>
a.source))`, a lesson whose actual content is computed from all three corpus docs (classify
picks unambiguous events across Sigma **and** Risk **and** Forensics; action-event resolves
`taughtChannel` against tags taught from any corpus doc) ends up with a `dependsOn` list that
is missing the corpus docs it doesn't happen to cite verbatim in an atom.

**Reproduced concretely:** deleted one row (`EventID 1002 | Application Hang`) from
`Logging/Notable-Event-IDs-Risk.md` only, in a throwaway copy, and rebuilt into the *same*
output directory used for the first build (so the self-check ran against the real previous
manifest):
```
$ sha256sum before/after t1-m03-list-membership-p1.json  → hash changed (content legitimately
  changed — a different item was selected)
$ build-manifest.json → artifacts["t1-m03-list-membership-p1"].depends_on ==
  ["Lab/Generate-Suspicious-Activity-Sigma.ps1", "...lolbins.ps1", "...Activity.ps1",
   "Logging/Notable-Event-IDs-Sigma.md"]     ← Risk.md is NOT listed
$ node build-content.mjs ...  → exit code 1, stdout contains:
  "NON-DETERMINISM: these artifacts changed with no source change —
     t1-m03-list-membership-p1"
```
The pipeline's own self-check (§6.9 exit gate) misdiagnoses a fully legitimate, deterministic
content change as a build bug. `t1-m03-action-to-event-p*` has the same defect in the other
direction: its recorded `depends_on` lists **zero** corpus `.md` files even though its content
depends on which corpus docs taught the events a lab pair names.

**Why it matters:** this is exactly the property §6.9/the Phase 1 exit gate exists to police,
and it is currently broken for the two lesson families that aggregate across sources — which
is also the shape most likely to recur as more modules are added in Phase 4/6. Left as-is, real
content edits will intermittently fail CI with a "non-determinism" alarm, teaching
maintainers to distrust or override that gate.

**Blind spot in the existing test:** `test-pipeline.mjs:83-117` (`scoped-regeneration` group)
edits `Notable-Event-IDs-Forensics.md` and explicitly excludes `list-membership` and
`action-to-event` from its "off-target changes" assertion (line 102: `!f.includes('forensics')
&& !f.includes('list-membership') && !f.includes('action-to-event')`) — i.e. it already
tacitly accepts that these two families are not precisely scoped, but it never rebuilds a
second time against the same manifest to check for a false `NON-DETERMINISM` report the way
the `idempotency` group does (line 80). That is why `test-pipeline.mjs` currently passes
(30/30) despite the bug above.

**Suggested fix:** stamp every atom in `buildCorpusClassifyLessons` and `buildActionEventLessons`
with the *actual* source(s) it draws from (e.g. the classify atoms should carry — or the lesson
should separately declare — dependencies on all three corpus docs; the action-event atoms
should additionally depend on whichever corpus doc taught `taughtChannel`). Simplest robust
fix: give `finalizeLesson` an explicit `extraDependsOn` parameter for lessons whose true
dependency set is broader than what's on individual atoms, rather than inferring `dependsOn`
solely from `atom.source.path`. Add a `test-pipeline.mjs` case that edits `Risk.md` only and
asserts no `NON-DETERMINISM` line appears on rebuild.

### 2. `chunkEvenly()` ties lesson/atom identity to array position, not source coordinates
**File:** `SEIMAcademy/scripts/build-content.mjs:478-491` (`chunkEvenly`), consumed by
`buildRecallLessons:635`, `buildSmallChannelLessons:790`, `buildCorpusClassifyLessons:912`,
`buildActionEventLessons:1031`.

Chunk boundaries are computed purely from `items.length` (`n = ceil(len/max)`, `size =
floor(len/n)`, remainder distributed to the first `extra` chunks). Individual flashcard atom
ids are correctly source-coordinate-derived (event id + channel, per §6.8) and are immune to
this. But the **lesson id itself** (e.g. `t1-m03-sigma-security-p2`) and the per-chunk
recall-quiz / match-exercise / instructions atom ids are suffixed only with a positional
`p${idx+1}`. Inserting or deleting a single row anywhere in a channel section changes
`items.length`, which can silently shift the size of every chunk (including ones that don't
contain the inserted row), which changes *which rows* end up in the chunk still called `p2`.
The id string for that lesson/quiz/match/instructions atom stays the same, but the content it
names — the quiz question, the match pairs, the `requires` tags — silently changes underneath
it after an edit to a completely different row in the same channel.

**Why it matters:** §2/§6.8's stability guarantee exists specifically so a learner's per-lesson
progress and a card's SRS history survive a source edit. A stable-looking id whose *content*
silently changes on an unrelated insertion is arguably worse than a renumbered id, because
nothing flags it — the id-collision/determinism checks in `validate-content.mjs` have no way
to detect "same id, different meaning across two builds" since they only ever see one build's
output at a time.

**Suggested fix:** anchor chunk boundaries to a stable coordinate instead of a pure position —
e.g. group by a fixed window of source line numbers, or bucket by `Math.floor(eventId /
someStride)`, or (simplest) derive the chunk suffix from the first row's line number in that
chunk rather than the chunk's ordinal index, so a chunk keeps its identity as long as its
starting row doesn't change.

### 3. Ambiguous multi-value EventID cells are guessed at, not flagged for review
**File:** `SEIMAcademy/scripts/lib/markdown.mjs:111-123`, specifically the split regex at
line 118: `rawId.split(/[\s,]+/)`.

Confirmed against the real corpus: `Logging/Notable-Event-IDs-Forensics.md:247` has the cell
`8 15, 16, 33` (WinRM/Operational, "WSMan Session deinitialization") — a mix of a bare space
and commas that most plausibly indicates a missing comma after `8` (i.e. a source typo), but
the parser has no way to distinguish that from an intentional 4-item list and unconditionally
treats space and comma as equivalent separators, emitting flashcards for event IDs `8`, `15`,
`16`, and `33`. This is reported only as an informational **note**
(`build-content.mjs:192`: `"EventID cell \"8 15, 16, 33\" split into separate rows"`), the same
severity used for the unambiguous `8193, 8194` case one table earlier — there is no signal that
distinguishes "clean comma list" from "this shape is ambiguous, a human should confirm it."

**Why it matters:** this directly produces a ground-truth flashcard (`Event ID 8 = WSMan
Session deinitialization`) that may be factually wrong, and nothing in the build output makes
that risk visible above the noise of routine split notices. At 20-module scale this exact
shape (a stray space where a comma belongs) will recur and will keep being silently accepted.

**Suggested fix:** treat a cell containing *both* an internal bare-whitespace run *and* a comma
as a distinct case — e.g. `mixed-separator-event-id` — and emit it as a `warning` (not a
`note`), or require an explicit allow-list entry in `module-manifest.json` before accepting it.

### 4. A section that loses all its rows to rejection disappears from every generated artifact with no persisted trace
**File:** `SEIMAcademy/scripts/build-content.mjs:196-199` (`.filter((s) => s.rows.length > 0)`).

Confirmed against the real corpus: `Logging/Notable-Event-IDs-Risk.md:258`,
`## Microsoft-Windows-Security-Mitigations/KernelMode`, has exactly one data row and its
EventID cell is `*` (rejected as `non-numeric-event-id`). After rejection the section has zero
rows and is dropped by the filter above — the channel never appears in any lesson, tag, or
`build-manifest.json` entry. The only trace is a console `WARN` line, which is not written
anywhere the build-manifest or generated content can be checked against later.

**Why it matters:** this is silent data loss of an entire channel, indistinguishable in the
generated artifacts from "this channel doesn't exist in the source." Nothing prevents an
entire module's worth of channels from quietly vanishing this way if a future source document
uses more of these free-text EventID cells.

**Suggested fix:** record dropped-empty sections in `build-manifest.json` (e.g. a
`skipped_sections` array per module) so it's part of the persisted, reviewable build output,
not just stdout.

---

## Worth doing later

### 5. `module-manifest.json`'s `exercise_data[].profile` field is declared but never read
**Files:** `content/module-manifest.json:39-51` (each entry declares
`"profile": "ps1-event-labels"`), `build-content.mjs:122` (`const labPaths =
(module.exercise_data ?? []).map((e) => e.path)` — only `.path` is read). Unlike
`module.profile`, which is validated at `build-content.mjs:90-93`, nothing dispatches on or
validates `exercise_data[].profile`. Harmless today (one profile exists); will silently do
nothing if a second exercise-data profile is added without also adding the dispatch logic.

### 6. No profile registry — adding a second generator profile means editing the entrypoint and duplicating ~500 lines
**File:** `build-content.mjs:89-93` (hardcoded `if (module.profile !== 'event-id-tables')
throw`), and the whole block `105-1124`. Every lesson-builder (`buildRecallLessons`,
`buildReferenceLesson`, `buildSmallChannelLessons`, `makeFlashcards`, `makeRowQuiz`,
`makeMatchExercise`) is hard-wired to the `row.eventId`/`row.provider`/`row.description` shape
that only `parseTables()` produces. There is no seam between "generic lesson assembly" (SRS
budget, chunking, atom sequencing, provenance stamping) and "profile-specific row shape." A
genuinely different source shape for Phase 4/6 cannot reuse any of this without either
duplicating it wholesale or refactoring first. Recommend extracting a `profile` interface
(e.g. `{ parse(sourceRoot, module) → sections[]; buildLessons(sections, ctx) →
lesson[] }`) before the second module with a different source shape lands, not after.

### 7. `validatePrerequisites` assumes `module-manifest.json`'s array order is the intended tier/play order
**File:** `validate-content.mjs:248-268`. The doc (§6.6) defines the prerequisite scope as
"earlier lesson in the same module's play order, or an earlier module in the same tier" — but
the code just flattens `buildManifest.modules` in array order and accumulates a single global
`taught` set, without ever consulting `tier`. With one module this is unverified/dormant. At
20 modules, if `module-manifest.json`'s `modules` array is ever authored out of tier order
(e.g. a tier-2 module listed before a tier-1 module), the check will silently enforce
prerequisites against the wrong ordering. Worth adding an explicit assertion that `modules` is
sorted by `(tier, module)` before Phase 4 adds more entries.

### 8. Duplicated "pick K distinct values as multiple-choice options" logic
Appears independently, with slightly different dedup keys, in `makeRowQuiz`
(`build-content.mjs:568-598`), the classify-lesson quiz's `distinct` loop
(`build-content.mjs:1096-1103`), and inline in the action-event quiz. Worth extracting one
shared helper — Phase 4/6 will need this same pattern for every module's quizzes.

### 9. `makeRowQuiz`'s "unique description" guard has a silent fallback
**File:** `build-content.mjs:568-571`. `answerRow = rows.find(r => counts.get(desc) === 1) ??
rows[0]`. The `counts`-based filter correctly avoids picking an ambiguous-description row as
the quiz answer when at least one row in the chunk has a unique description (verified this
works correctly against real duplicate-description rows, e.g. Event IDs 1116/1117 in
Sigma's Windows Defender channel — the quiz picks 1006 instead). But if *every* row in a
chunk happens to share a duplicated description with another row in the same chunk, the code
silently falls back to `rows[0]`, which could produce a quiz with more than one factually
correct answer. Not observed in the current corpus; worth a hard error instead of a silent
fallback, per the pipeline's own stated philosophy of "reported, not guessed at."

### 10. Weak `no-timestamps` detection
**File:** `validate-content.mjs:27-28, 214-220`. `ISO_DATETIME` only matches
`YYYY-MM-DDTHH:MM` strings; a numeric epoch timestamp or a non-ISO date string in some future
atom payload would not be caught. Not a current bug (no such field is emitted), but a check
that is easy to satisfy for the current generator and easy to defeat for a future one.

### 11. Minor naming/readability nit
**File:** `scripts/lib/sources.mjs:92-97` (`checkPinnedCommit`). When `matches` is `null`
(git HEAD unreadable), the function returns `actual: pinned` — i.e. the field named `actual`
holds the *expected* value, not an observed one, in that branch. Harmless but confusing on a
future read.

---

## Not reviewed / lower confidence

- Did not exhaustively diff `schema/app-data-schema.json` (the JSON Schema mirror) against
  `app-data-schema.md`; the review focused on the `.md` doc per the task's own framing of it
  as normative.
- Did not review all 64 generated lesson files individually — spot-checked
  `t1-m03-orientation.json`, the Windows-Defender recall lessons (Sigma + Risk), the
  list-membership lessons, and the action-to-event lessons, all via the live rebuild
  experiments above.
- Did not attempt to construct a hostile/malformed PS1 fixture beyond what
  `test-pipeline.mjs`'s own fixture already covers for `ps1-labels.mjs`; that module's
  regexes look sound on inspection but were not fuzzed.
- Did not evaluate performance/scaling behavior at 20-module volume beyond static reasoning
  (no profiling run).

---

## Looks good — worth reinforcing

- `parseTables()` is genuinely header-driven (via `COLUMN_ALIASES`), not positional — verified
  against all five real header-row shapes present in the three source docs (`EventID |
  Description`, `+Filter`, `+Recommended Filter`, `+Provider Name+Filter`,
  `+ProviderName`), including the column-order variant. Repeated header rows mid-table and the
  `*` wildcard cell are both handled exactly as the code comments claim, confirmed against
  real rows in the source repo.
- `ps1-labels.mjs` is a genuinely pure string function (no `child_process`/`eval`/`vm`), with
  a belt-and-braces `EXECUTABLE_HINT_RE` check independent of the main label regex — confirmed
  by `test-pipeline.mjs`'s parse-only group and by direct reading.
- `deterministicId`, `duplicateKeys`, `disambiguator`, `normalizeTags`, and `matchEvidence`/
  `resolveTaughtEvent` are all careful about Set/Map iteration order — every place that
  matters explicitly re-sorts before use rather than relying on insertion order. No bugs found
  in this part of the determinism story.
- `generatorHash()` correctly folds in every file under `scripts/lib/` (sorted), so editing the
  generator itself is distinguished from a source-content change rather than silently causing
  bogus non-determinism reports.
- The §6.5 SRS budget is enforced as a hard build error (`build-content.mjs:265-270`), matching
  the doc's explicit "never a silent truncation" requirement.
- `test-pipeline.mjs` is a real, working exit-gate test (idempotency, scoped regeneration,
  orphan detection, parse-only, lab-label extraction all pass) — the gap identified in Must-Fix
  #1 is a blind spot in what it asserts, not evidence the suite is decorative.
