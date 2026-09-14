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

**Phase 3 — Core components** `[~]` **in progress** (opened 2026-09-11) —
[#5](https://github.com/voltron-1/SEIM-Academy/issues/5), milestone *Phase 3 — Core
components*. Running in four gated units; Units 1 and 2 are done.

**Next unstarted item:** Unit 3 — multiple-choice/fill-in-the-blank
[#36](https://github.com/voltron-1/SEIM-Academy/issues/36) **and** matching/drag-classify
[#37](https://github.com/voltron-1/SEIM-Academy/issues/37), which ship together. Inline
feedback, never a separate results page; neutral, non-punitive wrong-answer copy. The drag
interaction ships its **keyboard-operable equivalent in the same PR** — the accessibility
baseline says day one, not as a later add-on — plus touch support.

Then: the test-out check [#38](https://github.com/voltron-1/SEIM-Academy/issues/38) and the
cross-component accessibility sweep [#39](https://github.com/voltron-1/SEIM-Academy/issues/39).

**Deferred out of Unit 2, not forgotten:** the Review route that actually *plays* the due
queue [#118](https://github.com/voltron-1/SEIM-Academy/issues/118). The scheduler, the queue
builder and the rail's due count all shipped; no view calls them yet.

**Unit 1 settled the thing that would have blocked the exit check.** Phase 3 requires
keyboard/screen-reader verification and nothing in Phases 1–2 could do it. The harness was
built before any component rather than after five of them.

**What Phase 2 hands forward:**

- The shell renders all eight atom types and Phase 3 fills in the interactions. The
  renderer contract — `AtomView({ atom, hint })` — should not need to change.
- `chromeFor()` in `state/session-core.ts` is where the anxiety-safe chrome rules are
  asserted. A new component that needs to hide something belongs in that function, not in
  its own CSS.
- Reduced motion is a hard default. Any component adding animation must route it through
  `--motion-duration`, which the global rule already enforces.
- The renderer must keep raw HTML disabled (`app-data-schema.md` §7). No Markdown library
  entered the critical path in Phase 2; keep it that way.

**From the Phase 7 spike, worth knowing now:** the copilot's grounding failures were
retrieval failures, not model failures, and no amount of prompting produced reliable
abstention — see [findings](findings/20260910-phase2-local-model-spike.md).

---

## LAST SESSION

**2026-09-13** — **Phase 3 Unit 2 closed: Flashcard + SRS**
([#35](https://github.com/voltron-1/SEIM-Academy/issues/35)). SM-2 as a pure module, the
topic-diversity queue builder, the graded component, and the rail's due count. 111 tests
green; contrast, types, build and the 24 PWA checks all pass. Plan:
[`plans/20260913-phase3-unit2-flashcard-srs.md`](plans/20260913-phase3-unit2-flashcard-srs.md).

**The review caught a blocker that 101 passing tests had missed.** `commit()` in
`state/session.tsx` took a value, so grading a card and completing the atom — which the
lesson player does in one tick — both built from the same snapshot and the second silently
discarded the first. **Every grade a learner submitted was being thrown away**, with no
error. Not a race: 100% reproducible. No existing test exercised two writes in one tick,
which is the gap, not the bug. `commit()` now takes an updater.

**Hardening, from the parallel security audit**
([findings](findings/20260913-phase3-unit2-security.md), 0 critical / 0 high / 4 medium /
3 low). `migrate()`'s new deck validation was materially weaker than the `completedByDay`
validation three lines above it in the same function — a `__proto__` key re-pointed the map's
prototype, `dueDay: "zzz"` made a card due forever-never, and `ease: 1e308` produced a
`"NaN-NaN-NaN"` day key that sorts above every real date. All three are the *same silent
disappearance* that `srs.ts` names in its own comment as the thing the queue must never do.
`buildReviewQueue`'s backward scan is now bounded at the window — identical output, O(n·window)
instead of O(n²).

**Two things worth keeping from the verification.** The keyboard test caught a reveal control
downgraded from `<button>` to `<div>`; **axe did not** — which is the argument for running
both rather than treating axe as the accessibility gate. And the SM-2 sequences were
re-derived by hand independently of the test file, because a test that enshrines a wrong
number is worse than no test: the published order is *interval first, then ease*, which the
plan originally had backwards.

Follow-ups filed with milestones at creation:
[#118](https://github.com/voltron-1/SEIM-Academy/issues/118) Review route player (Phase 3),
[#119](https://github.com/voltron-1/SEIM-Academy/issues/119) error boundary and
[#120](https://github.com/voltron-1/SEIM-Academy/issues/120) CSP (both Phase 8).

**2026-09-11** — **Phase 2 closed; Phase 3 opened and Unit 1 landed.**
[#116](https://github.com/voltron-1/SEIM-Academy/pull/116) closed the Phase 2 epic
([#4](https://github.com/voltron-1/SEIM-Academy/issues/4)) and recorded the #33
local-model spike. [#117](https://github.com/voltron-1/SEIM-Academy/pull/117) opened
Phase 3 with Unit 1 of 4: the DOM/a11y test harness and the Instructions atom
([#34](https://github.com/voltron-1/SEIM-Academy/issues/34) closed) — plan at
[`plans/20260911-phase3-core-components.md`](plans/20260911-phase3-core-components.md).

**The harness was built before any component, deliberately.** Phase 3's exit check is
keyboard/screen-reader verification and every test through Phases 1–2 was state-level, with
no browser in the build environment. happy-dom + Testing Library + axe-core, all
devDependencies and outside the free/self-hosted critical path. Querying by role and
accessible name makes the natural test *be* the accessibility assertion. `node --test` still
runs everything; two small ESM hooks cover what Vite does and Node doesn't, so no `.js`
suffixes leaked into production source to satisfy a runner.

**The axe gate was fired at a real violation before being trusted** — it reported
`button-name` and `image-alt` with help URLs. That check exists because this suite already
reported `# pass 0` and exited `0` once, in Phase 2 Unit 3. A gate nobody has watched fire
is not yet a gate.

**Instructions atom first** because §6.4 makes it the schema-enforced prerequisite of every
exercise atom, so its shape had to settle before the four components that follow. Phase 2
had rendered it as a `<p>` inside a `<dl>` — invalid HTML; it is now a real description
list, announced as three navigable terms rather than three unrelated blocks.

**2026-09-10** — **Phases 1 and 2 both built, reviewed, merged and closed.** Six PRs:
[#110](https://github.com/voltron-1/SEIM-Academy/pull/110) and
[#111](https://github.com/voltron-1/SEIM-Academy/pull/111) closed Phase 1;
[#112](https://github.com/voltron-1/SEIM-Academy/pull/112)–[#115](https://github.com/voltron-1/SEIM-Academy/pull/115)
closed Phase 2 in four gated units.

**Phase 1 — schema and content pipeline.** 449 source rows plus 50 ground-truth
`action → event` pairs become 64 lessons / 707 atoms / 36 SRS cards. Decisions A and B
built in from schema 1.0.0 rather than retrofitted; Decision B's parse-only constraint
enforced by an import allowlist over the pipeline's own source. **The exit gate was not met
on the first build** — absolute source line numbers meant one added row rewrote 22 of 65
artifacts, and the original test suite passed only because its single scoping case used the
one edit shape that hides it.

**Phase 2 — app shell.** Preact + TypeScript via Vite; **Decision 5 closed** (reduced
motion is a hard default). The pilot module plays start to finish, resumes exactly where it
was left, and shows no error state with the network cut. Markdown is parsed in-house, so
§7's "raw HTML disabled" is a property of the code rather than a parser setting. Lighthouse
installability is the one exit clause only partially verified — it needs a browser this
environment does not have, and is carried to Phase 8.

**Three failures worth remembering the shape of, not just the fix:**

- An independent verifier written in a different language found a quiz that named the wrong
  log channel for its answer — schema-valid, internally consistent, factually wrong.
- The app's test suite reported `# pass 0` and exited 0 for a while: an inherited tsconfig
  `exclude` meant no tests compiled. There is now a guard that refuses to report success on
  an empty suite.
- A static host answers an unknown path with **200 and `index.html`**, so a deleted lesson
  arrives as HTML rather than a 404. Classifying that as "malformed" told the learner to
  retry something that could never succeed.

**Phase 7 de-risked early.** The #33 spike ran against a real local model: latency is a
non-issue (0.7–3.5 s, ~100 tok/s), **retrieval is the bottleneck rather than the model**,
and reliable abstention could not be achieved by prompting — it needs to be structural.
32B models will not load on ~4 GiB free, which is the honest boundary of the free tier.

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
- [x] **Phase 2 — App shell** — theme tokens, left rail, HUD, atom renderer, local
      persistence, offline/degraded states, PWA shell. *Exit met 2026-09-10; Lighthouse
      installability partially verified, carried to Phase 8.*
      [#4](https://github.com/voltron-1/SEIM-Academy/issues/4) closed, milestone 15/15,
      PRs [#112](https://github.com/voltron-1/SEIM-Academy/pull/112)–[#115](https://github.com/voltron-1/SEIM-Academy/pull/115).
- [~] **Phase 3 — Core components** — Instructions atom, Flashcard+SRS, MC/fill-blank,
      matching/drag with keyboard equivalent, test-out check. *In progress since
      2026-09-11; Units 1 and 2 of 4 done.*
      [#5](https://github.com/voltron-1/SEIM-Academy/issues/5)
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
