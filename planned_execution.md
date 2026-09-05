# SEIM-Academy — Planned Execution

Sequenced execution view for the whole project. Derived from `execution.md` (the
task-level source of truth) and `IMPLEMENTATION-PLAN.md` (sequencing and gates) — it
never competes with them for completion state.

Status markers: `[ ]` todo · `[~]` in-progress · `[x]` done · `[!]` blocked

---

## NEXT UP

**Phase 0 — Content audit** `[~]` in progress (unblocked 2026-09-04)

Source knowledge base identified: [`TonyPhipps/SIEM`](https://github.com/TonyPhipps/SIEM)
@ `4adb971`, GPL-3.0.

**Done this session:** path manifest built and verified (31 specs → 177 files, 0 missing,
0 empty); `Tactics/*.md` structural spot-check completed; curriculum map committed as
[`curriculum-map.md`](curriculum-map.md); audit recorded in
[`findings/20260904-phase0-content-audit.md`](findings/20260904-phase0-content-audit.md).

**Next unstarted item:** Cross-check the module list against 5–10 current Tier 1/Tier 2
SOC analyst job postings, then against Security+ and GCIH exam objectives. Needs external
research rather than repo inspection — the last work before Phase 0's exit check is met.

**Then Phase 1 (unblocked).** Decision 4 is resolved — the pilot is **Windows Event ID
triage**. First task: draft `app-data-schema.md` (lesson/atom/quiz JSON schema with the
`teaches`/`requires`/`source` fields), then scaffold `scripts/build-content.*` to parse
the three `Logging/Notable-Event-IDs-*.md` tables into lesson JSON.

---

## LAST SESSION

**2026-09-04** — Repository created (private, `voltron-1/SEIM-Academy`). Seed Build Plan
converted from `.docx` to `BUILD-PLAN.md`; `IMPLEMENTATION-PLAN.md` and `execution.md`
imported verbatim; README and this execution view written. **Decision 3 resolved:**
GPL-3.0 applied, AGPL-3.0 still reserved for a future hosted-copilot backend only.
**Phase 0 unblocked and largely completed:** source repo identified as `TonyPhipps/SIEM`,
all 177 source files verified, curriculum map committed, content audit recorded. Two
findings changed the plan — see Findings that alter the plan, below. **Decision 4
resolved:** Windows Event ID triage confirmed as the Phase 1 pilot; Phase 1 unblocked.
**Module 4 reframed** into 4a/4b.

---

## Phases

- [~] **Phase 0 — Content audit** — finalize curriculum map, verify every source path
      resolves, cross-check modules against real Tier 1/2 job postings and
      Security+/GCIH objectives. *Exit: curriculum map committed, every source path
      verified.*
- [ ] **Phase 1 — Schema & pipeline** — `app-data-schema.md`, `build-content` script,
      generated lessons for the pilot module. *Gated on Decision 4.*
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
      Phase 1 is unblocked.
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
