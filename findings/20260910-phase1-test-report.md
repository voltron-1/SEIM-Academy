# Phase 1 content pipeline — independent test report
Date: 2026-09-10
Scope: SEIMAcademy/scripts/{build-content,validate-content,check-prereqs,test-pipeline}.mjs against pilot module `t1-m03` (Windows Event ID triage). Source KB read-only at /home/tjlam/projects/SIEM (never modified; all edits made to throwaway copies under /tmp/claude-1000/.../scratchpad).

## Exit gate under test
- execution.md: "pipeline runs against the pilot module end-to-end; output validates against the schema; regeneration is correctly scoped to changed files only."
- IMPLEMENTATION-PLAN.md: "pipeline script runs idempotently; generated lesson JSON validates against the schema; every atom carries correct teaches/requires tags; re-running the script after a source edit regenerates only the affected lesson."

## Verdict per clause
| Clause | Verdict | Basis |
|---|---|---|
| Runs against pilot module end-to-end | ✅ PASS | `--dry-run` and real `--out=` runs both exit 0, produce 64 lessons/706 atoms, output byte-identical to committed production content |
| Output validates against schema | ⚠️ PARTIAL | validate-content.mjs itself reports PASS (43,252 assertions, 0 failures) on real content, but the validator has confirmed blind spots (see Validator Gaps) — "validates" is only as strong as what it checks |
| Idempotent | ✅ PASS | Repeated no-op rebuilds into the same `--out` dir report `written: 0` every time, no NON-DETERMINISM warning, across 6 independent build invocations |
| teaches/requires tags correct | ⚠️ PARTIAL | Fully spot-checked on 1 of 3 planned lessons (t1-m03-sigma-application-p1) — exact match to source. The other 2 spot-checks were not reached (see Not Tested). |
| Regeneration scoped to changed files only | ❌ FAIL for realistic edits | Cell-value edits and lab-comment edits are correctly scoped (1 file). Row insertion, row deletion, whole-section deletion, and even a single mid-document **blank line** cascade into rewriting every downstream lesson in that source file — up to 22 of 65 artifacts from one added row. Root cause below. |

## Commands run (all against pilot module `t1-m03`)

1. `node SEIMAcademy/scripts/build-content.mjs --dry-run` (production source/out) — **exit 0**. `written: 0, unchanged: 65` against the already-committed content — confirms current checked-in artifacts are exactly reproducible from current source.
2. `node SEIMAcademy/scripts/build-content.mjs --out=<tmp>` (production source, temp out, never touched production dir) — **exit 0**. 64 lessons, 706 atoms, 449 source rows, 50 lab pairs (0 rejected), 36/80 SRS-eligible. `diff -rq` against production `SEIMAcademy/content/` showed **zero content differences** (only `build-manifest.json`'s `generator_hash` differs — see Observations).
3. `node SEIMAcademy/scripts/validate-content.mjs` — **exit 0**. `lessons: 64, exercise sets: 1, atoms: 706, SRS-eligible: 36`. 43,252 assertions across 19 named checks, 0 failures. VALIDATION PASSED.
4. `node SEIMAcademy/scripts/check-prereqs.mjs` — **exit 0**. `706 atoms, 63 exercises, 531 distinct teaches tags — OK`.
5. `node SEIMAcademy/scripts/test-pipeline.mjs` — **exit 0**. 30/30 assertions passed (idempotency, scoped-regeneration, orphan-detection, parse-only, lab-labels). Per instructions this was **not trusted at face value** — every one of its claims was independently re-derived below with different edits than it uses.

## Independent re-proof (own `--out` temp dirs, edits the author's own test does not try)

All tests: fresh copy of real `Logging/` + `Lab/` into a scratch `src/`, build into a scratch `out/`, snapshot, edit, rebuild into the **same** `out/` dir, diff.

**A. Edit the Sigma doc (not Forensics)** — changed one description cell (EventID 1034, Application section). Result: exactly 1 file changed — `t1-m03-sigma-application-p2.json` (+ build-manifest.json). ✅ Correctly scoped.

**B. Edit a Lab .ps1 comment** — renamed action label `"Create Local User"` → `"Create Local User Account"` in `Generate-Suspicious-Activity.ps1`, same Event ID. Result: exactly 2 files changed — `exercise-data/t1-m03-lab-action-event-pairs.json` and `t1-m03-action-to-event-p1.json`. No Sigma/Risk/Forensics lesson touched, even though every lesson's declared `depends_on` metadata lists the lab paths. ✅ Correctly scoped (confirms the coarse `depends_on` declaration is not what drives actual rewrites — a byte-diff of computed output is).

**C. Add a new row to a table** — appended a synthetic row to the end of the Sigma "Application" table (line 80 of ~1000+ line file, i.e. not the last line of the file). Result: **23 files changed** (22 lessons + manifest) — nearly every Sigma-corpus lesson (security-p1..p5, system-p1/p2, smaller-channels-p1..p4, six microsoft-windows-* lessons, security-domain-controller-specific-p1, both application parts, orientation). Diffing e.g. `t1-m03-sigma-system-p1.json` before/after showed the **only** change was every `source.lines` value shifting by exactly `+1` — no description, tag, or teaches/requires content differed. ❌ **Not scoped** — root cause is that every atom stores literal absolute line numbers from the source file, and any line-count-changing edit anywhere above a section shifts every downstream section's recorded lines, which changes the lesson's serialized bytes and forces a rewrite even though nothing taught actually changed.

**D. Delete a whole section** — deleted the entire "Microsoft-Windows-CodeIntegrity/Operational" section (heading + 10-row table, lines 162-177) from the Sigma doc. Result: exit code **1** (correct — orphan detected), report correctly named `ORPHANED ARTIFACTS: lessons/t1-m03-sigma-microsoft-windows-codeintegrity-operational-p1.json`, file was **not** deleted without `--prune` (confirmed present on disk), and `--prune` rebuild deleted exactly that one file and returned exit 0. ✅ Orphan handling itself is correct and safe. However the same rebuild also rewrote 17 other lessons for the same line-shift reason as (C) — the deletion cascades identically to an insertion.

**E1. Whitespace-only edit, true end-of-file** — appended a trailing blank line after the very last line of the Sigma doc (nothing follows it). Result: `written: 0, unchanged: 65` — **zero** lesson files changed. ✅ Matches the exit-gate expectation exactly.

**E2. Whitespace-only edit, mid-document (outside any table)** — inserted one blank line between two section headings (~100 lines into the file, no table content touched). Result: **20 files changed** (19 lessons + manifest) — same channel set as test C, same root cause (line-number shift). ❌ **This directly falsifies** "nothing regenerates when you touch only whitespace outside a table" for any whitespace edit that isn't literally the last byte of the file.

**Idempotency, independently confirmed**: every baseline build above (A–E2, run twice each = 12 additional invocations) showed `written: 0 / unchanged: 65` on a genuine no-op rebuild, and no `NON-DETERMINISM` warning ever appeared.

### Most serious pipeline gap
Regeneration scoping is byte-diff-based (correct in principle) but every atom's provenance (`source.lines`) is an **absolute line number**, not a heading+row-relative offset. Because of this, the "correctly scoped to changed files only" guarantee only holds for same-line text substitutions or edits appended at the literal end of a file. Any ordinary content-authoring edit — adding a row, deleting a row, deleting a section, or even adding a blank line for readability — anywhere but the last line of a source doc regenerates every lesson sourced from later in that same file. On the Sigma doc (33 sections) a single one-line insertion 100 lines in regenerated 19-22 of the corpus's ~33-40 lessons. This is a real risk to the Phase 4/6 estimate in IMPLEMENTATION-PLAN.md, which explicitly assumes scoped regeneration will keep the 58-tactic-file rollout tractable.

**Reproduction (minimal, E2):**
1. `cp -r <SIEM>/Logging <SIEM>/Lab <scratch>/src/`
2. `node build-content.mjs --source=<scratch>/src --out=<scratch>/out --manifest=<repo>/SEIMAcademy/content/module-manifest.json`
3. `sed -i '100a\ ' <scratch>/src/Logging/Notable-Event-IDs-Sigma.md` (inserts one blank line between two section tables)
4. Re-run the same build command from step 2 into the same `--out`.
5. `written` goes from 0 to 20; diff any changed lesson — only `source.lines` fields differ, by a constant offset.

## Validator gaps found (Step 3) — corrupted copies in a sandboxed `--out`-equivalent

`validate-content.mjs` hardcodes `CONTENT_DIR` (no `--out` flag). To test it against corrupted content without touching production, the whole `SEIMAcademy/scripts/` + `content/` tree was copied into a scratch dir (REPO_ROOT resolves relative to the copied script's own path), never modifying the real repo.

| # | Corruption | Caught? | Check that fired |
|---|---|---|---|
| 1 | Exercise `requires` tag changed to a non-existent event tag (`event:application:99999`) | ✅ Caught | `requires-subset-of-teaches` (validate-content.mjs and check-prereqs.mjs both) |
| 2 | Reading atom body pushed to 1061 chars (cap 900) | ✅ Caught | `atom-body-cap` |
| 3 | Instructions atom removed from directly before an exercise | ✅ Caught | `instructions-precede-exercise` (both validators); lesson also correctly failed `lesson-time-budget` since the atom-seconds sum no longer matches the declared total — this is a correct corroborating side effect of removing an atom, not a separate bug |
| 4a | Flashcard `srs.eligible=true` with reason left as `not-in-evidence-set` (internally inconsistent) | ✅ Caught | `srs-anti-flood` |
| **4b** | Flashcard `srs.eligible=true` with `srs.reason` **falsely relabeled to `evidence-set`** on Event ID `application:1`, which has **zero** lab ground-truth pairs | ❌ **NOT caught** — `VALIDATION PASSED` | none |
| 5 | ISO datetime string (`2026-09-10T12:00:00Z`) appended to an atom body | ✅ Caught | `no-timestamps` |
| **5b** | Bare date string `"2026-09-10"` (no time-of-day) added under an innocuous key (`reviewed`) | ❌ **NOT caught** — `VALIDATION PASSED` | none |
| **5c** | Numeric UNIX epoch (`1757505600`) added under an innocuous key (`seq`) | ❌ **NOT caught** — `VALIDATION PASSED` | none |

### Most serious validator gap: 4b — fabricated SRS ground-truth is undetectable
`validateAtom`'s `srs-anti-flood` check only enforces **internal self-consistency** between `srs.eligible` and `srs.reason` (`!(eligible && reason !== 'evidence-set')`). It never cross-references the claim against the actual `exercise-data/*.json` lab-evidence set the way `build-content.mjs` itself does (`matchEvidence`). A hand-edited (or buggy-generator) lesson file that marks a flashcard eligible **and** labels it `evidence-set` sails through validation with 0 failures, even though the cited Event ID has no lab ground-truth backing it. This is exactly the SRS-anti-flood property the schema is meant to guarantee (only lab-evidenced cards enter spaced repetition) and the validator cannot actually enforce it against a corrupted or malicious file — it can only catch generator bugs that produce an internally-inconsistent (not internally-fabricated) record.

**Reproduction:**
1. Copy `SEIMAcademy/{scripts,content}` to a scratch dir (so `REPO_ROOT` resolves there).
2. In `content/lessons/t1-m03-sigma-application-p1.json`, on atom `t1-m03-sigma-application-fc-1`, set `srs.eligible = true` and `srs.reason = "evidence-set"` (Event ID `application:1` does not appear in any pair in `exercise-data/t1-m03-lab-action-event-pairs.json`).
3. `node <scratch>/SEIMAcademy/scripts/validate-content.mjs` → `VALIDATION PASSED`.

Secondary gap (5b/5c): the `no-timestamps` check's `ISO_DATETIME` regex requires a literal `T` + time-of-day (`/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/`), so a bare date evades it, and `walkStrings` only ever visits `typeof === 'string'` values, so any numeric epoch/timestamp is invisible to the check regardless of key name. Both gaps are instances of a broader pattern: **neither validator rejects unknown/extra fields** on atoms, lessons, or exercise sets (no closed-schema enforcement) — arbitrary new keys of any type are never flagged unless they happen to match one of the specific existing string/key heuristics.

## SRS ground-truth audit (Step 5) — production content, unmodified

Cross-referenced all 36 `srs.eligible: true` flashcards in the real, committed `SEIMAcademy/content/lessons/*.json` against `exercise-data/t1-m03-lab-action-event-pairs.json`, reproducing the pipeline's own `matchEvidence` channel-matching logic independently in Python:

- **36/36** eligible cards have `reason: "evidence-set"` and a genuine matching lab-generator pair for their (channel, Event ID). **0 false positives.**
- Reverse check: 3 taught flashcards share an Event ID with an already-eligible card elsewhere (`security-domain-controller-specific` 4731/4734/4735) and are correctly marked `duplicate-event`, not a second eligible card — matches the documented "one card per evidence key" dedup rule.

✅ **PASS** — on the real, uncorrupted content, the 36 SRS-eligible cards are exactly the ones with lab ground-truth evidence. (This result is validator-independent — it was computed directly from the source data, not from validate-content.mjs, which is precisely what test 4b shows it cannot itself guarantee against a corrupted file.)

## Spot-check vs. source Markdown (Step 4)

Only 1 of the 3 planned lessons was completed before the time budget was spent — see Not Tested.

**t1-m03-sigma-application-p1** vs `Logging/Notable-Event-IDs-Sigma.md`: every flashcard front/back, the quiz question/choices/answer, and all 8 match-exercise pairs were compared against the literal table rows at the recorded `source.lines`. All matched exactly, e.g.:
- `source.lines: [65,65]` → doc line 65: `|    1    | Microsoft-Windows-Audit-CVE | A potential exploit was detected and the process was terminated. |` — flashcard back and match-pair right-hand value both reproduce this description verbatim.
- Quiz: question cites Event ID 1's description, `answer_index: 0` → `choices[0] == "1"`, correct.
- `source.heading: "Application"` matches doc line 56 (`## Application`).

✅ PASS for this lesson.

## Observations (not exit-gate failures)
- The committed `SEIMAcademy/content/build-manifest.json` has `generator_hash: 36c771...` but a fresh build from the current script bytes computes `fa0de78f...`. All actual lesson/exercise-data bytes are still identical (confirmed via full `diff -rq`), so this is stale build-manifest metadata (scripts were edited after the last real production build was committed), not a content defect. A production `build-content.mjs` run (no `--out`) would silently rewrite `build-manifest.json` to fix this.

## Not Tested (and why it matters)
- **2 of 3 planned spot-checks** (a Risk-corpus lesson and a Forensics smaller-channels lesson) against source Markdown were not reached — only the Sigma-application lesson was fully verified. The one lesson checked was clean, but this doesn't confirm the Risk/Forensics code paths (different corpus, and the "smaller channels" cross-heading chunking path) produce equally faithful output.
- The line-number-shift regeneration cascade (findings C/D/E2) was only demonstrated against the Sigma doc. It was not repeated against the Risk doc, Forensics doc, or the three Lab `.ps1` files, though the shared `parseSections`/`readSource` code path makes it highly likely to generalize.
- No additional validator-evasion attempts were made beyond the 8 corruptions above (e.g., a quiz `answer_index` pointing at a schema-valid but semantically wrong choice; a `source.path`/`heading`/`lines` triple that resolves but points at the wrong row) — these are plausible further gaps given the validator's demonstrated inability to check semantic truth, but were not empirically confirmed.
- `test-pipeline.mjs`'s own 30 assertions were read and judged sound as written, but not mutation-tested (e.g., no check for whether its assertions would still pass if a bug were reintroduced into `build-content.mjs`).
