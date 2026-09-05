# SEIM-Academy — Planned Execution

Sequenced execution view for the whole project. Derived from `execution.md` (the
task-level source of truth) and `IMPLEMENTATION-PLAN.md` (sequencing and gates) — it
never competes with them for completion state.

Status markers: `[ ]` todo · `[~]` in-progress · `[x]` done · `[!]` blocked

---

## NEXT UP

**Phase 0 — Content audit** (not started; depends on nothing; blocks everything else)

**Next unstarted item:** Enumerate every source path referenced in the Curriculum Map
(both Tier 1 and Tier 2 tables) into a single manifest list.

**Immediate prerequisite that is not yet satisfied:** Phase 0 audits a *source
knowledge-base repo* that this planning repo does not contain and does not name. That
repo has to be identified and available locally before the first item can start. See
Blocked, below.

---

## LAST SESSION

**2026-09-04** — Repository created (private, `voltron-1/SEIM-Academy`). Seed Build Plan
converted from `.docx` to `BUILD-PLAN.md`; `IMPLEMENTATION-PLAN.md` and `execution.md`
imported verbatim; README and this execution view written. **Decision 3 resolved:**
GPL-3.0 applied to the repo, AGPL-3.0 still reserved for a future hosted-copilot backend
only. No implementation work started.

---

## Phases

- [ ] **Phase 0 — Content audit** — finalize curriculum map, verify every source path
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

- [!] **Phase 0, all items** — the source knowledge-base repo that the Curriculum Map
      cites (`Tactics/*.md`, `Notable-Event-IDs-*.md`, `Signatures/Splunk/*.md`,
      `Matrix/*.md`, `Lookups/*.csv`, …) is not identified in any of the three planning
      documents and is not present here. Blocked until that repo is named and cloned
      locally, or its paths are confirmed to live in this repo.
- [!] **Phase 1 start** — Decision 4 (pilot module) unresolved. "Windows Event ID
      triage" is proposed and recommended; needs an explicit confirm.

---

## Resolved decisions

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
- **Project naming** — "SOC Academy" (Build Plan) vs `SEIMAcademy/` (derived plans) vs
  `SEIM-Academy` (this repo). Settle before Phase 1 creates directories.
- **Differentiators 1, 3, 4, 5** — stretch scope layered onto Workstream C components;
  not scheduled, not launch-blocking.
