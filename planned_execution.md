# SEIM-Academy — Planned Execution

Sequenced execution view for the whole project. Derived from `execution.md` (the
task-level source of truth) and `IMPLEMENTATION-PLAN.md` (sequencing and gates) — it
never competes with them for completion state. [`project-board.md`](project-board.md)
re-slices the same data into Kanban form; GitHub epics
[#2](https://github.com/voltron-1/SEIM-Academy/issues/2)–[#11](https://github.com/voltron-1/SEIM-Academy/issues/11)
mirror it one issue per phase, each on a matching `Phase N` milestone.

Status markers: `[ ]` todo · `[~]` in-progress · `[x]` done · `[!]` blocked

---

## NEXT UP

**Phase 2 — App shell** `[~]` **in progress** (opened 2026-09-10) —
[#4](https://github.com/voltron-1/SEIM-Academy/issues/4), milestone *Phase 2 — App shell*
(**4 of 15 closed**). Running in four gated units; Unit 1 landed in PR
[#112](https://github.com/voltron-1/SEIM-Academy/pull/112).

**Next unstarted item:** Unit 2 — shell chrome. Left rail (Today / Tier 1 / Tier 2 /
Copilot / Review) [#24](https://github.com/voltron-1/SEIM-Academy/issues/24), persistent HUD
[#25](https://github.com/voltron-1/SEIM-Academy/issues/25), persistent exit affordances
[#29](https://github.com/voltron-1/SEIM-Academy/issues/29), Focus mode
[#30](https://github.com/voltron-1/SEIM-Academy/issues/30).

**Unit 1 resolved both open Phase 2 decisions:** the view layer is Preact + TypeScript via
Vite, and **Decision 5 is closed — reduced motion is a hard default**, enforced through a
single token so a component cannot hardcode its way back into motion.

**Two constraints Phase 1 hands forward** — cheaper to honour than to retrofit:

- **The renderer must disable raw HTML.** `SEIMAcademy/app-data-schema.md` §7 makes this
  normative. Lesson content is generated from a third-party source repository, and the
  build-time markup check is a backstop, not a substitute for a renderer that cannot be
  made to execute markup. `innerHTML`, `dangerouslySetInnerHTML` and a Markdown parser on
  permissive defaults are out of contract.
- **Decision 5 (reduced-motion as a hard default) is a token-system decision, not a
  retrofit.** It is deferred to Phase 9+, but if it is ever going to be a hard default it
  has to be decided before the Phase 2 token system locks in. Revisit it now, while the
  tokens are being written.

The app reads `SEIMAcademy/content/lessons/*.json`; `build-manifest.json` carries each
module's play order and per-artifact dependencies.

---

## LAST SESSION

**2026-09-10** — **Phase 1 built, reviewed, merged and closed.** The pipeline, schema and
generated pilot module landed in PR
[#110](https://github.com/voltron-1/SEIM-Academy/pull/110), closing
[#3](https://github.com/voltron-1/SEIM-Academy/issues/3). Pilot module t1-m03
(Windows Event ID triage): 449 source rows plus 50 ground-truth `action → event` pairs →
**64 lessons, 707 atoms, 36 SRS cards**. Decisions A and B are built in from schema
version 1.0.0 rather than retrofitted, and Decision B's parse-only constraint is enforced
in code by an import allowlist over the pipeline's own source, not just asserted in a
comment.

**The exit gate was not met on the first build, and that is the session's main finding.**
`security-auditor`, `code-reviewer` and `tester-debugger` ran in parallel on the changeset;
**20 findings were fixed before the PR** ([remediation](findings/20260910-phase1-remediation.md)).
The tester proved "regeneration scoped to changed files only" held only for same-line
substitutions — every atom stored an absolute source line number, so one added row rewrote
22 of 65 artifacts. The original test suite passed because its one scoping case used the
single edit shape that hides the bug. Markdown atoms now anchor on path + heading + Event
ID; measured after the fix, a mid-document blank line regenerates **0** of 65 artifacts and
an added row regenerates **3**.

An independent verifier written in a different language
(`verify-against-source.py`, 896 checks) found a quiz that named the wrong log channel for
its answer — schema-valid, internally consistent, factually wrong. It is kept in the repo
and should be run after any parser change.

**Two source ambiguities were resolved rather than guessed.** The mixed-separator cell
`8 15, 16, 33` is confirmed as four Event IDs and recorded in `module-manifest.json`; an
EventID of `*` turned out to be a directive to collect a channel wholesale, not malformed
data, and is now taught as a channel instead of silently dropping it. The build emits zero
warnings.

**Tracker reconciled on close.** Six task-level issues
([#14](https://github.com/voltron-1/SEIM-Academy/issues/14)–[#19](https://github.com/voltron-1/SEIM-Academy/issues/19))
had been filed against the Phase 1 milestone by a parallel session and were not referenced
by this file. All six are delivered by #110 and were closed with their specific evidence;
the milestone is closed 8/8. A full audit found **no unmilestoned open issues** anywhere in
the tracker — the failure mode called out on 2026-09-06 has not recurred.

**Structure for Phases 4 and 6:** generator profiles live under
`SEIMAcademy/scripts/lib/profiles/`. Adding a module with the same source shape is a
manifest edit; a new source shape is a new profile plus one registry line.

**2026-09-06** — **Phase 0 closed; Phase 1 opened.** Ran the final audit item:
cross-checked all 20 modules against 2026 Tier 1/Tier 2 SOC hiring requirements and
against Security+ SY0-701 and GCIH objectives
([findings](findings/20260906-phase0-external-crosscheck.md), commit `6c4a08d`). Six
findings, four of which changed the plan. **Decisions A–D approved** at the Phase 1 gate
and recorded as resolved — deliberately not filed as issues, since the work folds into the
Phase 1 and Phase 4 epics. Issue [#2](https://github.com/voltron-1/SEIM-Academy/issues/2)
closed.

**Tracker hygiene fixed the same session.** A parallel session had filed epics
[#2](https://github.com/voltron-1/SEIM-Academy/issues/2)–[#11](https://github.com/voltron-1/SEIM-Academy/issues/11)
and added [`project-board.md`](project-board.md) (PRs #1 and #12) but created no
milestones — all ten epics were unmilestoned and therefore invisible to this file.
Milestones `Phase 0`–`Phase 9` created and assigned; the Phase 0 milestone is closed.
`project-board.md` re-derived: Phase 0 → Done, Phase 1 → In Progress, Current Sprint
switched to Phase 1.

**2026-09-04** — Repository created (private, `voltron-1/SEIM-Academy`). Seed Build Plan
converted from `.docx` to `BUILD-PLAN.md`; `IMPLEMENTATION-PLAN.md` and `execution.md`
imported verbatim; README and this execution view written. **Decision 3 resolved:**
GPL-3.0 applied, AGPL-3.0 still reserved for a future hosted-copilot backend only.
**Phase 0 unblocked and largely completed:** source repo identified as `TonyPhipps/SIEM`,
all 177 source files verified, curriculum map committed, content audit recorded.
**Decision 4 resolved:** Windows Event ID triage confirmed as the Phase 1 pilot.
**Module 4 reframed** into 4a/4b; **Modules 4 and 5 swapped.**

---

## Phases

- [x] **Phase 0 — Content audit** — curriculum map finalized, every source path verified,
      modules cross-checked against job postings and Security+/GCIH objectives.
      *Exit met 2026-09-06 — [audit](findings/20260904-phase0-content-audit.md),
      [cross-check](findings/20260906-phase0-external-crosscheck.md).*
      [#2](https://github.com/voltron-1/SEIM-Academy/issues/2) closed.
- [x] **Phase 1 — Schema & pipeline** — `app-data-schema.md`, `build-content` script,
      generated lessons for the pilot module. *Exit met 2026-09-10 — 64 lessons, 707 atoms;
      [remediation](findings/20260910-phase1-remediation.md).*
      [#3](https://github.com/voltron-1/SEIM-Academy/issues/3) closed via PR
      [#110](https://github.com/voltron-1/SEIM-Academy/pull/110); task issues
      [#14](https://github.com/voltron-1/SEIM-Academy/issues/14)–[#19](https://github.com/voltron-1/SEIM-Academy/issues/19)
      closed; milestone closed 8/8.
- [~] **Phase 2 — App shell** — theme tokens, left rail, HUD, atom renderer, local
      persistence, offline/degraded states, PWA shell. *In progress since 2026-09-10;
      Unit 1 of 4 done (4 of 15 issues closed).*
      [#4](https://github.com/voltron-1/SEIM-Academy/issues/4)
- [ ] **Phase 3 — Core components** — Instructions atom, Flashcard+SRS, MC/fill-blank,
      matching/drag with keyboard equivalent, test-out check.
- [ ] **Phase 4 — Tier 1 complete** — pipeline across ten Tier 1 modules; Capstone 1.
- [ ] **Phase 5 — Advanced components** — calculators, SPL sandbox, structured editor,
      scenario + evidence board. *Runs parallel with Phase 4.*
- [ ] **Phase 6 — Tier 2 complete** — pipeline across ten Tier 2 modules; Capstone 2.
- [ ] **Phase 7 — Socratic Copilot** — adapter interface, retrieval index, system
      prompt, behavior contract, chat panel. *Runs partially parallel with 4/6.*
- [ ] **Phase 8 — Validation / CI tie-in** — six content checks plus app-level QA,
      wired as merge gates.
- [ ] **Phase 9 — Usability pass** — standing process, does not close.

Task-level detail for each phase lives in `execution.md`. Update there first; this file
reflects it.

---

## Blocked

_Nothing is currently blocked._

---

## Findings that alter the plan

From [`findings/20260906-phase0-external-crosscheck.md`](findings/20260906-phase0-external-crosscheck.md):

- [x] **`Incident-Response-Policy.md` is 52 KB and Module 8 uses a sliver of it.** The
      full PICERL lifecycle is present and verified (Preparation, Identification,
      Containment, Eradication, Recovery, Lessons Learned). Containment actions are a
      named Tier 2 hiring requirement. Closing this needs no new authoring.
      *Decision A — approved 2026-09-06.*
- [x] **`Lab/Generate-Suspicious-Activity*.ps1` is unmapped and is the missing exercise-data
      source.** Three generators, self-labeled by Event ID, covering exactly what the
      Phase 1 pilot teaches. Parse-only — the pipeline must never execute them.
      *Decision B — approved 2026-09-06.*
- [x] **GCIH is the wrong alignment target.** ~2.5 of 15 official objectives are covered;
      the exam is offense-weighted while this curriculum is detection-weighted. CySA+ is
      the shape-matched substitute and is named as the Tier 2 landing cert.
      *Decision C — approved 2026-09-06.*
- [x] **Security+ coverage is ~35–40%, concentrated in Domain 4.** Domains 1, 3 and 5
      (50% of the exam) are essentially untouched. Positioning must say "Security
      Operations domain, taught deeply," not "Security+ prep."
      *Decision D — approved 2026-09-06.*
- [ ] **Six Tier 1 requirements have no module** — networking fundamentals, EDR/XDR,
      phishing triage, identity, cloud telemetry, scripting. Only identity and cloud are
      buildable from the licensed source; the rest should be disclosed as prerequisites
      or non-goals rather than faked.

From `findings/20260904-phase0-content-audit.md`:

- [x] **Retire top risk in `IMPLEMENTATION-PLAN.md` §8.** "Parsing 58 `Tactics/*.md`
      produces inconsistent atom quality" is false — nine sections appear in all 58
      files, and only 4 files deviate at all, every deviation cosmetic and normalizing
      to the same section vocabulary. Phase 4's time budget can be reduced.
- [ ] **New risk replacing it: content sparsity.** 28 of 58 `Tactics/*.md` files contain
      zero authored content — nine or ten empty section headings and a boilerplate line.
      Median file is 422 bytes; 45% of all body text sits in 2 files.
- [x] **Tier 1 Module 4 reframed.** Approved 2026-09-04. Its specified format
      ("matching: tactic → data source → field") drew on `Log Source Examples`, populated
      in only 21/58 files. Now split into **4a — tactic taxonomy** (all 58 files,
      generated from the uniform heading skeleton) and **4b — worked tactic depth** (the
      16 substantive files only). Applied to `curriculum-map.md` and `execution.md`.
- [x] **Tier 1 Modules 4 and 5 swapped.** Approved 2026-09-04. "Reading an alert: alarm
      algorithm vocabulary" (`Detection-Methods.md`) is now Module 4; the tactic modules
      become 5a/5b. The taxonomy names eight detection methods that `Detection-Methods.md`
      is what actually teaches, so the original order would have put an exercise ahead of
      its prerequisite — the exact failure the anxiety-safe design principle and the
      Phase 8 `requires` ⊆ `teaches` gate exist to prevent.
- [ ] **Tier 2 Module 7 is lopsided.** `Lookups/o365-principalappid.csv` has 306 rows vs.
      9 and 12 in the other two. Treat the large one as a lookup drill, not an SRS deck,
      or it floods the review queue with low-value cards.

---

## Resolved decisions

Decisions A–D came out of the Phase 0 external cross-check and were approved at the
Phase 1 gate on 2026-09-06. They are recorded here and on `project-board.md`'s Decisions
board only — **deliberately not filed as issues**, since each is closed by the same
commits that deliver the Phase 1 and Phase 4 epics, and four issues closed by other work
would be tracker noise rather than signal.

- [x] **Decision A — Tier 1 Module 8 scope.** Approved 2026-09-06. Expands from
      "escalation basics & documentation" to the full PICERL lifecycle — *Incident
      lifecycle: identify → contain → eradicate → recover → learn* — sourced from the
      unused ~90% of `Documentation-Templates/Incident-Response-Policy.md` (headings
      verified in the cross-check). Escalation becomes one beat inside it. **Schema
      impact:** adds a `lifecycle_stage` field to the atom schema. Picks up Security+ 4.8
      and the one GCIH objective genuinely in this curriculum's lane. No new authoring —
      the content is already licensed, in-repo, and verified.
- [x] **Decision B — Lab generators as exercise data.** Approved 2026-09-06.
      `Lab/Generate-Suspicious-Activity*.ps1` is mapped as labeled exercise-data input for
      Tier 1 Module 3 and Capstone 1. Each block is self-labeled with the Event ID it
      emits (`# Create Local User (Security 4720)`, `# Create a Service (Security 4697)`,
      …), giving ground-truth *action → event* pairs — the artifact Module 3's
      drag-to-classify exercises and Capstone 1's three-alert triage sim both need.
      **Schema and pipeline impact:** one parser branch in `build-content`, absorbed while
      that script is being written rather than retrofitted.
      **Hard safety constraint: parse-only.** These are live telemetry generators intended
      for a lab domain. Nothing in SEIM-Academy executes them; `build-content` reads their
      comments as text and must not shell out to PowerShell. This constraint is recorded in
      `app-data-schema.md` and in the script itself, not only here.
- [x] **Decision C — Tier 2 certification alignment.** Approved 2026-09-06. GCIH dropped
      entirely; **CySA+** named as the Tier 2 landing cert. GCIH covers ~2.5 of its 15
      official objectives here, and tests hacker tradecraft while this curriculum teaches
      telemetry and detection — complementary disciplines, not overlapping ones.
      Docs-only: README, `curriculum-map.md`.
- [x] **Decision D — Security+ positioning.** Approved 2026-09-06. Positioning states
      coverage precisely — "teaches the Security Operations domain (28% of SY0-701)
      deeply; a complement to Security+ study, not a substitute" — rather than implying
      whole-exam prep. Weighted coverage is ~35–40%, concentrated in Domain 4; Domains 1,
      3 and 5 (50% of the exam) are essentially untouched. Docs-only. An implied-prep claim
      is the kind of thing learners test and resent.

*Note on C and D:* neither has existing copy to correct — as of 2026-09-06 `README.md`
and `curriculum-map.md` make **no certification claims at all**. The only GCIH/Security+
mentions in the repo are in `IMPLEMENTATION-PLAN.md` and `BUILD-PLAN.md`, and those
describe the Phase 0 *audit task*, which is what actually happened and stays accurate.
So C and D are **constraints on copy not yet written** rather than edits to make now.
They bind whoever writes the README positioning section, the landing copy, and the Tier 2
module intros — enforce them there, not by hunting for text to change today.
- [x] **Decision 4 — Phase 1 pilot module.** Resolved 2026-09-04: confirmed as
      **"Windows Event ID triage"** (`Logging/Notable-Event-IDs-Sigma.md`, `-Risk.md`,
      `-Forensics.md` — 88 KB, 612 table rows, the densest structured source in the repo).
      Validated against the job market 2026-09-06 — Windows Event IDs are named
      explicitly in Tier 1 requirements. Phase 1 is unblocked.
- [x] **Decision 3 — GPL-3.0 vs AGPL-3.0.** Resolved 2026-09-04: GPL-3.0 applied
      (`LICENSE`). AGPL-3.0 reserved for a future managed-copilot backend only — plain
      GPL does not reach software run as a network service.

---

## DEFERRED

Waiting on an external event, not on us:

- **Decision 1 — static hosting target.** Deferred until first deploy (Phase 2+).
  Default: GitHub Pages.
- **Decision 2 — paid tier scope.** Deferred indefinitely; v1 is free/self-hosted only.
  Monetization is additive and blocks nothing in Phases 0–8.
- **Decision 5 — accommodations beyond WCAG 2.1 AA** (TTS, reduced-motion as hard
  default). Deferred to Phase 9+ backlog. *Caveat: if reduced-motion becomes a hard
  default it is a Phase 2 token-system decision, not a retrofit — revisit before Phase 2.*
- **Differentiators 1, 3, 4, 5** — stretch scope layered onto Workstream C components;
  not scheduled, not launch-blocking.
