# SEIMAcademy — Planned Execution

Task-level tracker companion to `IMPLEMENTATION-PLAN.md`. Check items off as they're completed; update Status/Owner columns as work is assigned. Phase order and dependencies match the source Build Plan (`SEIMAcademyBuildPlan.docx`) and `IMPLEMENTATION-PLAN.md` Section 4 — do not reorder without updating both.

Status legend: `Not started` / `In progress` / `Blocked` / `Done`

---

## Phase 0 — Content audit

**Depends on:** none | **Status:** **Complete 2026-09-06** | **Owner:** _unassigned_ | **Issue:** [#2](https://github.com/voltron-1/SEIM-Academy/issues/2) (closed)

- [x] Enumerate every source path referenced in the Curriculum Map (both Tier 1 and Tier 2 tables) into a single manifest list
- [x] Verify each path resolves in the source repo (script this — don't check by hand across 58+ files)
- [x] Spot-check heading/list structure across a spread of `Tactics/*.md` files (not just the pilot module's docs) to catch parsing-inconsistency risk before Phase 1 design locks in
- [x] Cross-check the module list against 5–10 current real Tier 1/Tier 2 SOC analyst job postings
- [x] Cross-check the module list against Security+ and GCIH exam objectives
- [x] Write up any curriculum gaps found and decide whether to fold them into the map now or backlog them
- [x] Commit the finalized curriculum map (this becomes the input to Phase 1)
- [x] Resolve Open Decision 4 (pilot module) — confirm "Windows Event ID triage" or pick an alternative

**Exit check:** finalized curriculum map is committed and every listed source path has been verified to exist. *Met 2026-09-06 — [content audit](findings/20260904-phase0-content-audit.md), [external cross-check](findings/20260906-phase0-external-crosscheck.md).*

---

## Phase 1 — Schema & pipeline

**Depends on:** Phase 0 | **Status:** **Complete 2026-09-10** — PR [#110](https://github.com/voltron-1/SEIM-Academy/pull/110) merged; [#3](https://github.com/voltron-1/SEIM-Academy/issues/3) and task issues [#14](https://github.com/voltron-1/SEIM-Academy/issues/14)–[#19](https://github.com/voltron-1/SEIM-Academy/issues/19) closed; milestone closed 8/8 | **Owner:** _unassigned_ | **Issue:** [#3](https://github.com/voltron-1/SEIM-Academy/issues/3)

**Decision gate cleared 2026-09-06.** Decisions A and B constrain the first deliverable and
must be written into `app-data-schema.md` as it is drafted, not retrofitted afterwards.
**Decision B carries a hard safety constraint:** the Lab generators are live telemetry
generators for a lab domain. `build-content` parses their comments as text and must never
execute them or shell out to PowerShell.

- [x] Draft `SEIMAcademy/app-data-schema.md` — lesson/atom/quiz JSON schema — [#14](https://github.com/voltron-1/SEIM-Academy/issues/14)
  - [x] Include `teaches` tag field (content/instructions atoms)
  - [x] Include `requires` tag field (exercise atoms)
  - [x] Include `source` field (repo-relative path, optional `#heading`)
  - [x] Define atom types: reading, quiz, flashcard, instructions, exercise, scenario, predict, capstone-step
  - [x] Define body-length cap per atom (per ADHD principle 1)
  - [x] Include `lifecycle_stage` field for PICERL-stage atoms — *Decision A*
- [x] Scaffold `SEIMAcademy/scripts/build-content.*` — [#15](https://github.com/voltron-1/SEIM-Academy/issues/15)
  - [x] Markdown heading/list parser for the pilot module's source doc(s)
  - [x] Atom normalizer → emits `SEIMAcademy/content/lessons/*.json`
  - [x] `teaches`/`requires` tag derivation from parsed headings/terms
  - [x] Idempotency check (re-run without source changes produces identical output)
  - [x] Parser branch for `Lab/Generate-Suspicious-Activity*.ps1` inline Event ID comments → labeled `action → event` exercise data — *Decision B, parse-only, never execute*
- [x] Generate flashcard/quiz content directly from `Notable-Event-IDs-*.md` tables (no hand-copied answer keys) — [#16](https://github.com/voltron-1/SEIM-Academy/issues/16)
- [x] Validate generated pilot-module JSON against the schema — [#17](https://github.com/voltron-1/SEIM-Academy/issues/17)
- [x] Confirm re-running after a deliberate source edit regenerates only the affected lesson — [#18](https://github.com/voltron-1/SEIM-Academy/issues/18). **Not met as first built**; see the exit-check note below.
- [x] (Optional, recommended) stub a lightweight local pre-commit check for `requires`⊆`teaches` ahead of the full Phase 8 CI build, to avoid late rework — [#19](https://github.com/voltron-1/SEIM-Academy/issues/19)

**Exit check:** pipeline runs against the pilot module end-to-end; output validates against the schema; regeneration is correctly scoped to changed files only. *Met 2026-09-10.*

| Clause | Evidence |
|---|---|
| Runs end-to-end | 449 source rows + 50 lab pairs → 64 lessons, 707 atoms, 36/80 SRS cards |
| Validates against schema | `VALIDATION PASSED` — 23 named checks |
| Idempotent | re-run writes 0 files, byte-identical |
| `teaches`/`requires` correct | 575 prerequisite assertions; 3 lab pairs correctly held back |
| Regeneration scoped | mid-document blank line → 0 of 65 artifacts; one added row → 3 |

Verify with `build-content.mjs --prune`, `validate-content.mjs`, `check-prereqs.mjs`,
`test-pipeline.mjs` (129 assertions) and `verify-against-source.py` (896 checks).

**Reviewed** by `security-auditor`, `code-reviewer` and `tester-debugger`; 20 findings fixed
before the PR — [remediation](findings/20260910-phase1-remediation.md),
[security](findings/20260910-phase1-security-audit.md),
[code review](findings/20260910-phase1-code-review.md),
[tests](findings/20260910-phase1-test-report.md). The tester showed the scoping clause was
**not** met as first built; it is met now.

---

## Phase 2 — App shell

**Depends on:** Phase 1 | **Status:** **Complete 2026-09-10** — epic [#4](https://github.com/voltron-1/SEIM-Academy/issues/4) closed; milestone closed 15/15 | **Owner:** _unassigned_ | **Issue:** [#4](https://github.com/voltron-1/SEIM-Academy/issues/4)

**Decisions taken at the phase gate 2026-09-10:** view layer is **Preact + TypeScript via
Vite** (~4 KB, MIT, no usage pricing — satisfies the BUILD-PLAN dependency policy; not
Next.js/React). **Decision 5 resolved: reduced motion is a hard default**, not an
OS-preference opt-out — deciding it in Phase 9 would have meant auditing every animation
added across Phases 3–7. See [plan](plans/20260910-phase2-app-shell.md).

- [x] Initialize SPA project (TypeScript + Preact or vanilla Web Components — no Next.js/React) — [#20](https://github.com/voltron-1/SEIM-Academy/issues/20), PR [#112](https://github.com/voltron-1/SEIM-Academy/pull/112)
- [x] Build dark theme token system: `--bg`, `--surface`, `--text`, `--accent`, `--danger`, `--success` — [#21](https://github.com/voltron-1/SEIM-Academy/issues/21)
  - [x] Verify WCAG 2.1 AA contrast (4.5:1 body, 3:1 large text/UI) for every token pairing including accent-on-background — [#22](https://github.com/voltron-1/SEIM-Academy/issues/22). Computed by `app/scripts/check-contrast.mjs`, 20 pairings; it caught `--border-strong` at 1.93:1 on first run.
  - [x] Monospace type for log/SPL/event data, humanist sans for prose — [#23](https://github.com/voltron-1/SEIM-Academy/issues/23)
- [x] Build left rail: Today / Tier 1 / Tier 2 / Copilot / Review — [#24](https://github.com/voltron-1/SEIM-Academy/issues/24), PR [#113](https://github.com/voltron-1/SEIM-Academy/pull/113)
- [x] Build persistent HUD: session progress bar, streak count, "N left today" — [#25](https://github.com/voltron-1/SEIM-Academy/issues/25). Streak reads 0 until Unit 3 persists day boundaries.
- [x] Build generic atom renderer (one shared renderer per atom type, one atom per screen) — [#26](https://github.com/voltron-1/SEIM-Academy/issues/26), PR [#114](https://github.com/voltron-1/SEIM-Academy/pull/114). Markdown parsed in-house, no `innerHTML` and no Markdown library — §7 as code rather than a parser setting.
- [x] Implement local persistence (localStorage/IndexedDB) — autosave position per atom, resume-exactly-here on load — [#27](https://github.com/voltron-1/SEIM-Academy/issues/27). localStorage; storage that throws resets rather than breaking startup, and a failed write is reported to the learner.
- [x] Implement offline/degraded render for every async boundary — [#28](https://github.com/voltron-1/SEIM-Academy/issues/28), PR [#115](https://github.com/voltron-1/SEIM-Academy/pull/115)
  - [x] Failed content load → last-known-good cached lesson + calm retry (no bare error). Three failure kinds told apart — a static host answers an unknown path with **200 and `index.html`**, so a deleted lesson is not a 404.
  - [x] Unreachable copilot backend → "offline — here's the source doc" panel state
- [x] Implement persistent exit affordances (Skip / Hint / Pause / Exit to Today) rendered once by the app shell, never hidden — [#29](https://github.com/voltron-1/SEIM-Academy/issues/29). Enforced structurally: the exit bar is a shell grid row, and `chromeFor()` asserts it survives Focus mode.
- [x] Implement Focus mode toggle (hides left rail + HUD chrome except progress bar) — [#30](https://github.com/voltron-1/SEIM-Academy/issues/30)
- [x] Implement "flag this" affordance on every atom (one click, optional one-line note, writes to local storage) — [#31](https://github.com/voltron-1/SEIM-Academy/issues/31)
- [x] Wire PWA shell: service worker, app manifest, offline app-shell caching — [#32](https://github.com/voltron-1/SEIM-Academy/issues/32). 24 static installability checks; Lighthouse itself needs a browser and is carried to Phase 8.
- [x] (Parallel spike, not blocking) throwaway local-model feasibility check (Ollama or WebLLM) to de-risk Phase 7 before its architecture locks in — [#33](https://github.com/voltron-1/SEIM-Academy/issues/33), [findings](findings/20260910-phase2-local-model-spike.md). **Local-first is viable; retrieval is the bottleneck, not the model.**

**Exit check:** pilot module plays start-to-finish through the shell; reload resumes exactly where the learner left off; killing network mid-session shows no error state; Lighthouse PWA installability passes. *Met 2026-09-10, with one clause partially verified.*

| Clause | Evidence |
|---|---|
| Pilot plays start to finish | 707 atoms across six types, one per screen |
| Reload resumes exactly | `resume.test.ts` plays real lessons through the player's own transitions and discards in-memory state the way closing a tab does |
| No error state on failure | stale-while-revalidate content cache plus a page-side last-known-good fallback |
| Lighthouse installability | **Partial** — 24 static checks pass; Lighthouse needs a browser the build environment lacks, carried to Phase 8 ([#98](https://github.com/voltron-1/SEIM-Academy/issues/98), [#99](https://github.com/voltron-1/SEIM-Academy/issues/99)) |

Verify with `npm run verify` in `SEIMAcademy/app`: 20 contrast pairings, type-drift check, `tsc`, 46 tests, 24 PWA checks.

---

## Phase 3 — Core components

**Depends on:** Phase 2 | **Status:** **In progress (opened 2026-09-11)** | **Owner:** _unassigned_ | **Issue:** [#5](https://github.com/voltron-1/SEIM-Academy/issues/5)

**Decision taken at the phase gate 2026-09-11:** this phase's exit check needs
keyboard/screen-reader verification, which nothing in Phases 1–2 could do — every test was
state-level and there is no browser in the build environment. **happy-dom + Testing Library
+ axe-core** added as devDependencies, and the harness built *before* any component, so the
phase cannot end with five components and no way to check them. See
[plan](plans/20260911-phase3-core-components.md).

- [x] Instructions atom (fixed anatomy: Goal → What you'll use → How you'll know you're done); schema-enforced to precede every exercise atom — [#34](https://github.com/voltron-1/SEIM-Academy/issues/34)
- [x] Flashcard (SRS) — [#35](https://github.com/voltron-1/SEIM-Academy/issues/35), PR [#121](https://github.com/voltron-1/SEIM-Academy/pull/121)
  - [x] SM-2 scheduler implementation — pure module, `src/state/srs.ts`
  - [x] Unit tests against known SM-2 interval sequences
  - [x] Enforced topic-diversity/interleaving window — never drops a due card
  - Review route that *plays* the queue deliberately scoped out — [#118](https://github.com/voltron-1/SEIM-Academy/issues/118)
- [ ] Multiple choice / fill-in-the-blank
  - [ ] Immediate inline feedback (never a separate results page)
  - [ ] Neutral, non-punitive wrong-answer copy (per anxiety-safe principle 3)
- [ ] Matching / drag-classify
  - [ ] Two-column drag interaction
  - [ ] Keyboard-operable equivalent shipped in the same PR (not later)
  - [ ] Touch support
- [ ] Test-out check
  - [ ] 3–5 generation-format questions per module
  - [ ] Pass → skip ahead; anything else → normal queue, no penalty, no failure record
  - [ ] Gates correctly on the module's `teaches` tags
- [x] Difficulty tag surfaced in Instructions atom for a meaningfully harder exercise — [#34](https://github.com/voltron-1/SEIM-Academy/issues/34). Shape plus text, never colour alone.
- [ ] Keyboard-only and screen-reader smoke test across all five components above

**Exit check:** all core components pass keyboard/screen-reader smoke tests; SRS unit tests pass; test-out correctly gates against tags.

---

## Phase 4 — Tier 1 complete

**Depends on:** Phases 1–3 | **Can run partially parallel with:** Phase 5, early Phase 7 | **Status:** Not started | **Owner:** _unassigned_

- [ ] Run pipeline: SOC orientation & what you're protecting
- [ ] Run pipeline: Logging fundamentals
- [ ] Run pipeline: Windows Event ID triage (pilot — already done in Phase 1, confirm integrated)
- [ ] Run pipeline: Reading an alert / alarm algorithm vocabulary (Module 4)
- [ ] Run pipeline: Tactic taxonomy (Module 5a — all 58 `Tactics/*.md`, generated from the
      uniform heading skeleton: which detection methods apply to which tactic)
- [ ] Run pipeline: Worked tactic depth (Module 5b — the 16 substantive `Tactics/*.md`
      files only; tactic → data source → field matching)
  - Reframed 2026-09-04 per `findings/20260904-phase0-content-audit.md` finding 3:
    28/58 tactic files contain no authored content, so the original single-module
    "tactic → data source → field" format was not generatable at stated scope.
  - Reordered 2026-09-04: the tactic modules moved after "Reading an alert" because the
    taxonomy names eight detection methods (Shannon Entropy, Levenshtein, Rolling
    Whitelist, …) that `Detection-Methods.md` is what teaches. In the original order the
    tactic module would have required vocabulary no preceding atom taught — a
    prerequisite-completeness violation the Phase 8 CI gate is built to reject.
- [ ] Run pipeline: MITRE ATT&CK mapping literacy
- [ ] Run pipeline: Field kit & note-taking discipline
- [ ] Run pipeline: Escalation basics & documentation
- [ ] Run pipeline: Investigating a user profile (walkthrough)
- [ ] Author Capstone 1 (timed-optional full triage simulation, 3 alerts) by chaining existing components
- [ ] Verify source-link citations ("from /path") resolve for every generated atom across all ten modules

**Exit check:** all ten Tier 1 modules playable end-to-end; Capstone 1 completes with timed-mode consent gate functioning correctly.

---

## Phase 5 — Advanced components

**Depends on:** Phase 3 | **Can run parallel with:** Phase 4 | **Status:** Not started | **Owner:** _unassigned_

- [ ] Worked-example calculator: Shannon entropy (live input → outcome)
- [ ] Worked-example calculator: robust z-score / MAD
- [ ] Worked-example calculator: RBA risk score
  - [ ] Each calculator validated against ≥3 hand-computed reference values
- [ ] SPL fill-in-the-blank sandbox
  - [ ] Client-side grader (no live Splunk instance)
  - [ ] Grades correctly against known-good and known-bad sample signatures
- [ ] Structured-editor lesson (signature/playbook authoring)
  - [ ] Form mirrors required layout
  - [ ] Validates required sections present; rejects incomplete submission
- [ ] Scenario + evidence board
  - [ ] Fabricated synthetic data only (never live Lab-script output)
  - [ ] Evidence board persists across navigation within a scenario

**Exit check:** all four advanced component types pass their individual validation checks above.

---

## Phase 6 — Tier 2 complete

**Depends on:** Phases 4–5 | **Status:** Not started | **Owner:** _unassigned_

- [ ] Run pipeline: Detection method deep dive
- [ ] Run pipeline: Reading & writing SPL signatures
- [ ] Run pipeline: Formal signature authoring
- [ ] Run pipeline: Playbook authoring & execution
- [ ] Run pipeline: Sigma → Splunk pipeline literacy
- [ ] Run pipeline: Risk-Based Alerting
- [ ] Run pipeline: Data enrichment & lookups
- [ ] Run pipeline: Threat hunting
- [ ] Run pipeline: Hardening ↔ detection cross-reference
- [ ] Run pipeline: The Detection & Compliance Matrix
- [ ] Author Capstone 2 (alert → investigate → propose an edit) chaining Phase 5 components
- [ ] Wire `interview-questions.md` as a cross-tier recurring SRS deck (not a standalone module)
- [ ] (Stretch, if scoped in) Differentiator 1 — Detection Coverage Sandbox
- [ ] (Stretch, if scoped in) Differentiator 3 — redacted-production-signature reconstruction
- [ ] (Stretch, if scoped in) Differentiator 4 — auto-generated portfolio artifact export from capstones

**Exit check:** all ten Tier 2 modules playable end-to-end; Capstone 2 emits a structured, properly formed signature/playbook artifact.

---

## Phase 7 — Socratic Copilot

**Depends on:** Phase 2 | **Can run partially parallel with:** Phase 4/6 | **Status:** Not started | **Owner:** _unassigned_

- [ ] Build model-agnostic adapter interface: `{systemPrompt, context, message} -> streamed response` (before any provider-specific code)
- [ ] Build local retrieval index (heading-level chunks over curriculum source docs, keyword/heading-match, no embeddings)
- [ ] Draft `copilot/system-prompt.md` (versioned, reviewed like code)
- [ ] Draft `copilot/grounding-index.md` (how retrieval is built/refreshed)
- [ ] Implement behavior contract, in this order:
  - [ ] Socratic default mode (1–2 guiding questions before direct answer, unless learner is clearly stuck)
  - [ ] "Usual help" override (toggle or typed "just tell me")
  - [ ] Concept breakdown mode (triggered by "break this down"/"I don't get it"/"ELI5", or auto-offered after two misses; capped length; analogy → mechanism → cited repo example)
  - [ ] Scope guardrail (refuses live-attack-simulation walkthroughs against non-lab targets; flags "how do I do this against a real system")
  - [ ] Grounded-answer requirement (cites source doc; says so if repo doesn't cover the question)
  - [ ] Graceful offline degradation (local model down / invalid BYO key / hosted service down → same calm offline state, tested by actually killing the backend)
  - [ ] BYO-key rate limit + visible "N calls this session" counter
- [ ] Wire local-first backend adapter (Ollama / llama.cpp / WebLLM) as default
- [ ] Wire BYO-API-key adapter (Claude or OpenAI-compatible endpoint) as second free option
- [ ] Build chat panel UI (integrates with app shell's offline-degraded state from Phase 2)
- [ ] (Stretch) Differentiator 2 — adaptive weak-spot engine (mines miss patterns, auto-authors micro-lesson)
- [ ] (Stretch) elaborative "why does that work" post-answer prompt (low-probability trigger)

**Exit check:** all seven behavior-contract items have a passing scripted test, including the offline path exercised by an actual backend kill; rate limiter demonstrably caps calls and the on-screen counter is accurate.

---

## Phase 8 — Validation / CI tie-in

**Depends on:** Phases 1, 4, 6 | **Status:** Not started | **Owner:** _unassigned_

- [ ] Content freshness check — regenerate `SEIMAcademy/content/` and diff against committed output; fail on drift
- [ ] Source-link integrity check — every lesson's source path resolves (reuse existing Markdown link-check logic)
- [ ] Schema validation check — every lesson JSON matches `app-data-schema.md`
- [ ] Curriculum coverage check — every source file in the curriculum map has a generated lesson
- [ ] Prerequisite-completeness check
  - [ ] Every exercise atom's `requires` tags covered by `teaches` tags on a preceding atom
  - [ ] Every exercise atom immediately preceded by an instructions atom
  - [ ] Verified against a deliberately broken test case before being trusted as a merge gate
- [ ] App-level QA
  - [ ] Unit tests: SRS scheduler
  - [ ] Unit tests: component-selection logic (MC for first exposure, generation formats for later SRS passes)
  - [ ] Automated accessibility check (axe-core) wired as a per-PR gate
  - [ ] One e2e smoke test per atom type
- [ ] Wire all six checks into the repo's existing validation gate (or a sibling script it invokes)

**Exit check:** all six checks run in CI and fail the build on violation; prerequisite-completeness check confirmed to actually catch a broken test case.

---

## Phase 9 — Usability pass, ongoing

**Depends on:** Phase 7 | **Status:** Not started | **Owner:** _unassigned_ | **Note:** this phase does not close — it becomes the standing post-launch process

- [ ] Measure re-entry cost (open app → back in lesson) — target ≈0
- [ ] Measure session completion rate
- [ ] Walk prerequisite-completeness *in practice* with someone other than the builder (not just CI-clean)
- [ ] Draft and merge `CONTRIBUTING.md`
  - [ ] Scenario/worked-example content submission process
  - [ ] Review bar: 1 maintainer approval + clean CI (especially prerequisite-completeness)
  - [ ] Discussion venue: GitHub Issues/Discussions on the repo (no separate platform)
- [ ] Stand up "flag this" review as a recurring process (recommended cadence: weekly during initial launch)
- [ ] Build local "Stats" view surfacing all Success Metrics to the learner (re-entry cost, completion rate, SRS retention trend, copilot escalation rate, curriculum coverage drift, prerequisite violations [must be zero], abort/skip usage, flag-this volume/clustering)
- [ ] Confirm nothing in the free/self-hosted build transmits telemetry anywhere (privacy/telemetry stance check)

**Exit check (for initial launch milestone):** usability pass completed on pilot + one full tier; `CONTRIBUTING.md` merged; Stats view live and accurate; recurring flag-this review cadence established.

---

## Open decisions to resolve (not phase-blocking except where noted)

- [x] **Decision 4 (blocked Phase 1 start):** RESOLVED 2026-09-04 — pilot module confirmed as
      **"Windows Event ID triage"** (`Logging/Notable-Event-IDs-Sigma.md`, `-Risk.md`,
      `-Forensics.md`; 88 KB, 612 table rows). Phase 1 is unblocked.
- [ ] Decision 1: static hosting target (default: GitHub Pages)
- [ ] Decision 2: paid tier scope, if any (default: none for v1; free/self-hosted only)
- [x] Decision 3: RESOLVED 2026-09-04 — GPL-3.0 applied to the repo (`LICENSE`); AGPL-3.0
      reserved for a future managed-copilot backend only
- [ ] Decision 5: accommodation scope beyond WCAG 2.1 AA baseline — TTS, reduced-motion-as-default (default: backlog to Phase 9+, not launch-blocking)

Decisions raised by the Phase 0 external cross-check and resolved at the Phase 1 gate.
Recorded here only — deliberately not filed as issues, since the work folds into the
Phase 1 and Phase 4 epics:

- [x] **Decision A:** RESOLVED 2026-09-06 (approved) — Tier 1 Module 8 expands from
      "escalation basics & documentation" to the full PICERL lifecycle
      (*Incident lifecycle: identify → contain → eradicate → recover → learn*), sourced
      from the unused ~90% of `Documentation-Templates/Incident-Response-Policy.md`.
      Escalation becomes one beat inside it. Adds a `lifecycle_stage` field to the atom
      schema. No new authoring required — the content is already licensed and verified.
- [x] **Decision B:** RESOLVED 2026-09-06 (approved) — `Lab/Generate-Suspicious-Activity*.ps1`
      is mapped as labeled exercise data for Tier 1 Module 3 and Capstone 1. The blocks
      are self-labeling by Event ID, giving ground-truth *action → event* pairs.
      **Parse-only: the pipeline must never execute them or shell out to PowerShell.**
- [x] **Decision C:** RESOLVED 2026-09-06 (approved) — GCIH dropped as the Tier 2
      certification alignment target (~2.5 of 15 objectives covered; the exam is
      offense-weighted while this curriculum is detection-weighted). **CySA+** replaces it.
      Docs-only change.
- [x] **Decision D:** RESOLVED 2026-09-06 (approved) — Security+ positioning stated
      precisely: "teaches the Security Operations domain (28% of SY0-701) deeply; a
      complement to Security+ study, not a substitute." Weighted coverage is ~35–40%,
      concentrated in Domain 4. Docs-only change.

---

## Change log

| Date | Change |
|---|---|
| 2026-09-04 | Initial execution plan generated from `SEIMAcademyBuildPlan.docx` and `IMPLEMENTATION-PLAN.md` |
| 2026-09-04 | Tier 1 Modules 4 and 5 swapped: alarm-algorithm vocabulary now precedes the tactic modules, which depend on it. |
| 2026-09-06 | Phase 0 closed — external cross-check against Tier 1/2 hiring requirements and Security+/GCIH objectives ([findings](findings/20260906-phase0-external-crosscheck.md)). Decisions A–D resolved at the Phase 1 gate; Phase 1 opened. Milestones created for Phases 0–9 and assigned to epics [#2](https://github.com/voltron-1/SEIM-Academy/issues/2)–[#11](https://github.com/voltron-1/SEIM-Academy/issues/11). |
| 2026-09-04 | Phase 0 audit: source repo identified (`TonyPhipps/SIEM` @ `4adb971`), 177 files verified, curriculum map committed. Decisions 3 and 4 resolved. Module 4 split into 4a/4b. Top risk in `IMPLEMENTATION-PLAN.md` §8 retired; content sparsity logged in its place. |
