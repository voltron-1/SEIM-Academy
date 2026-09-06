# SEIM-Academy — Planned Execution

Sequenced execution view for the whole project. Derived from `execution.md` (the
task-level source of truth) and `IMPLEMENTATION-PLAN.md` (sequencing and gates) — it
never competes with them for completion state.

Status markers: `[ ]` todo · `[~]` in-progress · `[x]` done · `[!]` blocked

---

## NEXT UP

**Phase 0 — Content audit** `[x]` **complete** (2026-09-06). All four exit criteria met —
see the exit check in
[`findings/20260906-phase0-external-crosscheck.md`](findings/20260906-phase0-external-crosscheck.md).

**Phase 1 — Schema & pipeline** `[ ]` is next and unblocked. First task: draft
`app-data-schema.md` (lesson/atom/quiz JSON schema with the `teaches`/`requires`/`source`
fields), then scaffold `scripts/build-content.*` to parse the three
`Logging/Notable-Event-IDs-*.md` tables into lesson JSON.

**Gate before Phase 1 starts — four curriculum decisions await approval.** Two of them
change what `app-data-schema.md` must represent, so they are cheaper to settle now than
to retrofit:

- **A. Expand Tier 1 Module 8 to the full PICERL lifecycle.** Only ~10% of the 52 KB
  `Incident-Response-Policy.md` is currently mapped. *Affects the schema — containment
  and eradication atoms need a lifecycle-stage field.*
- **B. Map `Lab/Generate-Suspicious-Activity*.ps1` as labeled exercise data** for Module 3
  and Capstone 1. *Affects the schema and adds a parser branch to `build-content`.*
- **C. Replace GCIH with CySA+** as the Tier 2 certification alignment target. Docs only.
- **D. State Security+ coverage precisely** (~35–40%, Security Operations domain) rather
  than implying whole-exam prep. Docs only.

Two further proposals (a new cloud/identity Tier 1 module; README non-goals for
networking, EDR, phishing and scripting) can follow Phase 1 without rework.

---

## LAST SESSION

**2026-09-06** — **Phase 0 closed.** Ran the final audit item: cross-checked all 20
modules against 2026 Tier 1/Tier 2 SOC hiring requirements and against Security+ SY0-701
and GCIH objectives. Recorded in
[`findings/20260906-phase0-external-crosscheck.md`](findings/20260906-phase0-external-crosscheck.md).
Six findings, four of which change the plan (see below); nothing blocked. No source or
curriculum files were modified — all changes are proposals pending the Phase 1 gate.

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
- [ ] **Phase 1 — Schema & pipeline** — `app-data-schema.md`, `build-content` script,
      generated lessons for the pilot module. *Unblocked; gated on decisions A–D above.*
- [ ] **Phase 2 — App shell** — theme tokens, left rail, HUD, atom renderer, local
      persistence, offline/degraded states, PWA shell.
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

- [ ] **`Incident-Response-Policy.md` is 52 KB and Module 8 uses a sliver of it.** The
      full PICERL lifecycle is present and verified (Preparation, Identification,
      Containment, Eradication, Recovery, Lessons Learned). Containment actions are a
      named Tier 2 hiring requirement. Closing this needs no new authoring. *Decision A.*
- [ ] **`Lab/Generate-Suspicious-Activity*.ps1` is unmapped and is the missing exercise-data
      source.** Three generators, self-labeled by Event ID, covering exactly what the
      Phase 1 pilot teaches. Parse-only — the pipeline must never execute them.
      *Decision B.*
- [ ] **GCIH is the wrong alignment target.** ~2.5 of 15 official objectives are covered;
      the exam is offense-weighted while this curriculum is detection-weighted. CySA+ is
      the shape-matched substitute and is named as the Tier 2 landing cert. *Decision C.*
- [ ] **Security+ coverage is ~35–40%, concentrated in Domain 4.** Domains 1, 3 and 5
      (50% of the exam) are essentially untouched. Positioning must say "Security
      Operations domain, taught deeply," not "Security+ prep." *Decision D.*
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
