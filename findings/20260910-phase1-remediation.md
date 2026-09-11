# Phase 1 — remediation of review findings

**Date:** 2026-09-10 · Follows the three Phase 1 reviews:
[security audit](20260910-phase1-security-audit.md),
[code review](20260910-phase1-code-review.md),
[test report](20260910-phase1-test-report.md).

## Gate status after remediation

```
build-content.mjs --prune     exit 0  · 64 lessons, 707 atoms, 36/80 SRS cards, 0 warnings
validate-content.mjs          exit 0  · VALIDATION PASSED — 23 named checks
check-prereqs.mjs             exit 0  · 63 exercises, 531 teaches tags
test-pipeline.mjs             exit 0  · 129 assertions, 12 groups
verify-against-source.py      exit 0  · 896 content checks, 0 mismatches
```

| Exit-gate clause | Before review | Now |
|---|---|---|
| Runs end-to-end | PASS | PASS |
| Validates against schema | PARTIAL — validator had blind spots | PASS |
| Idempotent | PASS | PASS |
| `teaches`/`requires` correct | PARTIAL — 1 of 3 spot-checks done | PASS — all 896 checked independently |
| Scoped regeneration | **FAIL** for realistic edits | PASS |

## The gate failure and its fix

The tester proved "regeneration scoped to changed files only" held **only** for same-line
substitutions. Every atom stored an absolute `source.lines`, so any line-count-changing
edit shifted every downstream lesson's bytes: one added row rewrote 22 of 65 artifacts, a
mid-document blank line rewrote 20. The original `test-pipeline.mjs` passed because its one
scoping case used a same-line substitution — the single edit shape that hides the bug.

**Fix:** Markdown-derived atoms anchor on `path` + `heading` + Event ID and record no line
numbers; only `.ps1` sources keep them, where the line *is* the Decision B audit trail.

**Measured after:** blank line → **0** of 65 artifacts. One added row → **3** (that
channel's two lessons, plus the orientation lesson, which cites the corpus-wide Event ID
count). No unrelated channel touched.

## A real content bug, found by independent verification

`verify-against-source.py` re-parses the source in a different language and checks every
generated claim against the row it cites. It found one factually wrong quiz among 896
checks — schema-valid and internally consistent, so no existing check could have caught it:

> *In the **Microsoft-Windows-AppLocker/EXE and DLL** channel, which Event ID records:
> "NTLM server blocked in the domain audit…"* → answer `8003`

The description belongs to the NTLM channel. The "smaller channels" lessons sweep rows from
several channels into one sitting and labelled the quiz with the lesson's first heading
rather than the answer row's own. `makeRowQuiz` now takes a `headingOf` resolver and always
names the answer row's channel. The verifier is kept in `SEIMAcademy/scripts/` and should be
run after any change to the parser or the lesson builders.

## Fixed — correctness

1. **Line-number cascade** — see above. *(test report, most serious)*
2. **Cross-corpus lessons under-reported dependencies.** `list-membership` and
   `action-to-event` draw on all three corpus docs while citing one, so a legitimate
   `Risk.md` edit was reported as `NON-DETERMINISM` and exited 1. They now declare the
   broader set. *(code review #1)*
3. **Lesson ids were positional.** `…-p2` kept its name while its contents changed on an
   unrelated insertion. Now content-derived (`…-application-e1034`), so a boundary shift
   renames visibly and the old lesson appears in the orphan report. *(code review #2)*
4. **Ambiguous `8 15, 16, 33` cell** — resolved. **Confirmed 2026-09-10: the source is
   missing a comma between 8 and 15; these are four distinct Event IDs.** The parser's
   split was already correct, so no generated content changed. The ruling is recorded in
   `module-manifest.json` under `confirmed_cells`, keyed by path + heading + cell text
   (never a line number), which downgrades the warning to a note. An unconfirmed ambiguous
   cell still warns; a recorded ruling that *contradicts* the parse is a hard build error,
   since one of the two must be wrong. *(code review #3)*
5. **Sections dropped to zero rows** now recorded in `build-manifest.json`
   (`skipped_sections`), not just printed once. *(code review #4)*
6. **The one section that was being dropped is no longer dropped.**
   `Microsoft-Windows-Security-Mitigations/KernelMode` in `Notable-Event-IDs-Risk.md` has a
   single row whose EventID cell is `*` — which is not a malformed ID but a collection
   directive meaning *collect this whole channel*. Rejecting it removed an entire channel
   from the curriculum in exchange for a console warning. Wildcard rows are now parsed
   separately and taught as a `reading` atom inside the corpus's smaller-channels lesson
   ("some channels you turn on entirely" is a real collection decision), with no fabricated
   Event ID card. `skipped_sections` is now empty and the build emits **no warnings**.
7. **`makeRowQuiz` silent fallback** to an ambiguous answer row is now a hard error.
   *(code review #9)*

## Fixed — safety

7. **No content-safety enforcement.** §7 asserted a Markdown subset that nothing enforced,
   and §6.10 described a `source_quote` mechanism that did not exist. Now a two-tier rule:
   a targeted markup denylist plus narrow command syntax on **every** string, and the
   strict `EXECUTABLE_HINT_RE` on `.ps1`-derived strings. Calibrated against all 3,948
   generated strings — zero false positives; benign placeholders like `<X>` and
   `<SessionEnv>` still pass, `<script>` fails the build. §7 now states the renderer's
   raw-HTML obligation normatively. *(security #1, #2)*
8. **`readGitHead()` path traversal** — a crafted `.git/HEAD` ref in the untrusted source
   repo read an arbitrary file and leaked its first 7 bytes into committed provenance.
   Ref names validated and containment-checked. *(security #4)*
9. **`safeJoin()` was lexical only** — symlinks in a forked source repo defeated it. Now
   realpath-verified, symlinks rejected, 8 MB file cap, 4096-char line cap. *(security #5)*
10. **Three drifting copies of the executable-syntax regex**, the validator's being the
    weakest. One exported definition, imported by the validator. *(security #9)*
11. **`no-executable-content` only scanned `.ps1` payloads** — all Markdown-derived content
    was unchecked, as were `title` and `body`. Now scans everything. *(security #10)*
12. **SRS budget was self-certifying** — the validator read its threshold from the artifact
    under test. Ceiling hardcoded at 80; the manifest may lower it, never raise it.
    *(security #11)*
13. **Validator could not detect a fabricated `srs.eligible`.** It checked only internal
    consistency. It now rebuilds the evidence set from exercise data and re-derives every
    claim. *(test report, most serious validator gap)*
14. **Closed-schema enforcement.** A bare `2026-09-10` under a `reviewed` key and a numeric
    epoch under `seq` both passed validation. Unknown keys are now rejected outright —
    the class, not the instances. *(test report 5b/5c)*
15. Also: output-path containment, manifest validation (ids, ranges, play order, unknown
    options), ReDoS-prone regexes rewritten with unambiguous quantifiers, duplicate
    artifact paths, `--out=`/`--source=` empty-value rejection, `check-prereqs` id grammar,
    payload cap, `generatorHash()` via `fileURLToPath`, pruned artifacts recorded in the
    build manifest. *(security #3, #6–8, #12–14, #16–19)*

## Fixed — maintainability

16. **Profile registry.** `build-content.mjs` was 1,394 lines with no seam between generic
    lesson assembly and the Event-ID-table row shape, so a second source shape in Phase 4/6
    meant duplicating it. Now:
    - `scripts/lib/profiles/event-id-tables.mjs` — this source shape only
    - `scripts/lib/profiles/index.mjs` — the registry; a profile declares its own accepted
      `exercise_data` profiles and option ranges
    - `scripts/lib/lesson-kit.mjs` — time budget, chunking, instructions anatomy,
      multiple-choice construction, provenance
    - `scripts/build-content.mjs` — CLI, manifest validation, write scoping, reporting

    Adding a profile is a new file plus one registry line; `build-content.mjs` is not
    edited. **Verified content-neutral: all 65 artifacts byte-identical after the
    refactor.** *(code review #6)*
17. **Multiple-choice option construction** was duplicated three ways with different dedupe
    keys. One `pickDistinctChoices` helper. *(code review #8)*
18. **Test coverage.** 30 → 129 assertions. New groups: `realistic-edits` (blank line, row
    insert), `cross-corpus-deps` (no false non-determinism), `hostile-content`
    (`<script>` heading fails the build), `schema-mirror` (JSON Schema drift),
    `manifest-validation` (registry-driven rejection), `confirmed-cells`, `wildcard-channels`. `parse-only` replaced its
    comment-stripped substring grep with an import allowlist that recurses into
    `lib/profiles/` and no longer exempts itself. *(code review #1 blind spot,
    security #20)*

## Not fixed — deliberate

- **Pinned-commit mismatch stays a warning, not an error.** Contributors legitimately build
  against a branch. The pin format is now validated and provenance records the commit
  actually built from, never a commit the artifact was not built from. *(security #15)*
- **Module 3 is 64 lessons (~6 hours).** Faithful to 449 source rows. Whether to scope it
  down is a Phase 4 curriculum decision, not a pipeline change.
