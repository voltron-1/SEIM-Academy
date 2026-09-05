# SEIMAcademy — Implementation Plan

Derived from: `SEIMAcademyBuildPlan.docx` (seed Build Plan, nothing implemented yet)
Prepared: 2026-09-04
Companion document: `execution.md` (task-level tracker — use that day-to-day; use this document for scope, sequencing, staffing, and risk decisions)

## 1. Purpose and how to use this pair of documents

The source Build Plan already defines *what* to build (goals, design principles, curriculum map, UI spec, copilot behavior contract, tech stack, phases 0–9, success metrics, and a set of open decisions). This Implementation Plan turns that into an execution-ready sequence: it groups the work into workstreams, attaches a technical approach and a definition of done to each of the source plan's ten phases, flags dependencies and risks, and states the staffing assumption the timeline rests on. `execution.md` breaks each phase into checklist-level tasks for tracking during the build itself.

Nothing in the source Build Plan is treated as re-litigated here — this plan only sequences and operationalizes it. Where the source plan leaves an "Open Decision," that decision is carried forward as a blocking or non-blocking gate against the relevant phase (Section 7).

## 2. Assumptions

The source Build Plan intentionally leaves five decisions to the requester (Section 7 below) and does not state team size, cadence, or calendar dates. This plan makes the following assumptions explicit so the timeline in Section 6 can be adjusted once they're confirmed:

- **Team size:** sized for a single full-stack builder working solo, with phases sequenced so a second contributor (content/curriculum-focused) could absorb Workstream C in parallel from Phase 4 onward. Adjust Section 6 estimates linearly if actual staffing differs.
- **Cadence:** estimates are given in engineer-weeks of focused work, not calendar weeks, since this is a scoped build rather than a resourced team sprint.
- **Environment:** local development against a clone of the source knowledge-base repo; no hosted infrastructure required until the optional managed-copilot tier is built (explicitly deferred in the source plan).
- **Pilot module:** "Windows Event ID triage" is treated as the Phase 1 pilot per the source plan's suggestion, pending confirmation (Open Decision 4).

## 3. Workstreams

The ten source phases decompose into six workstreams that recur across phases. Grouping by workstream (rather than only by phase) makes it easier to parallelize once the Phase 1 pilot de-risks the approach, and to staff a second contributor if one becomes available.

| Workstream | Covers | Primarily active in |
|---|---|---|
| **A — Content pipeline** | `build-content` script, `app-data-schema.md`, lesson JSON generation, source-doc parsing, teaches/requires tag derivation | Phases 1, 4, 6 |
| **B — App shell & rendering** | Dark theme tokens, left rail, HUD, atom renderer, local persistence, offline/degraded states, PWA shell, Focus mode | Phase 2 |
| **C — Interactive components** | Flashcard/SRS, MC/fill-blank, matching/drag, calculators, SPL sandbox, structured-editor, scenario+evidence board, test-out check, capstone chaining | Phases 3, 5 |
| **D — Socratic Copilot** | System prompt, retrieval index, model-agnostic adapter, chat panel, rate-limit/spend counter, weak-spot engine (Differentiator 2) | Phase 7 |
| **E — Validation & CI** | Content freshness, source-link integrity, schema validation, curriculum coverage, prerequisite-completeness, app-level QA (unit/e2e/a11y) | Phase 8, ongoing |
| **F — Governance, safety, and launch ops** | `CONTRIBUTING.md`, safety guardrails around Lab scripts, licensing (GPL-3.0/AGPL-3.0), privacy/telemetry stance, usability pass, "flag this" feedback loop | Phase 0, 9, ongoing |

Differentiators 1 (Detection Coverage Sandbox), 3 (redacted-signature reconstruction), and 4 (auto-generated portfolio artifacts) are **not** separately scheduled — they layer onto Workstream C's Scenario/SPL/Structured-editor components once those exist, and should be treated as Phase 5+ stretch scope rather than blocking Tier 1/2 completeness (Phases 4/6). Differentiator 5 (Alert Fatigue mode) likewise layers onto the existing timed-mode consent gate from the anxiety-safe design principles and is stretch scope, not required for launch.

## 4. Phase-by-phase implementation approach

Each entry maps to the source plan's Build Phases table and adds a technical approach and a definition of done. Dependencies match the source plan; nothing has been reordered.

### Phase 0 — Content audit (Workstream F; depends on: none)

**Approach:** Walk every source directory named in the Curriculum Map (`Orientation/`, `Logging/`, `Notable-Event-IDs-*.md`, `Tactics/*.md` [58 files], `Detection-Methods.md`, `Detection-Tactics.md`, `field-kit.md`, `Incident-Response-Policy.md`, `Metrics.md`, `Investigating/*.md`, `Signatures/Splunk/*.md`, `Matrix/*.md`, `sigma/*`, `Risk-Based-Alerting/*.md`, `Lookups/*.csv`, `Threat-Hunting.md`, `osintel.md`, `hardening/*.md`, `interview-questions.md`) and confirm each resolves and is non-empty. Cross-check the resulting module list against current Tier 1/Tier 2 SOC analyst job postings and Security+/GCIH exam objectives, and note any curriculum gap this surfaces.

**Definition of done:** finalized curriculum map committed (module → source doc(s) → interactive format, matching the source plan's two tables); every listed source path verified to exist; a short written note on job-posting/cert alignment, including any additions/removals from the current list.

**Depends on:** none. **Blocks:** everything else.

### Phase 1 — Schema & pipeline (Workstream A; depends on: Phase 0)

**Approach:** Write `app-data-schema.md` first (lesson/atom/quiz JSON schema, including the `teaches`/`requires` tag fields the anxiety-safe design principles require structurally). Build `SEIMAcademy/scripts/build-content.*` to parse one pilot module's source Markdown (Windows Event ID triage, pending Open Decision 4) into normalized atoms under `SEIMAcademy/content/lessons/*.json`, each carrying a `source` field (repo-relative path, optional `#heading`). Generate the module's flashcard/quiz content directly from `Notable-Event-IDs-*.md` tables — no hand-copied answer keys.

**Definition of done:** schema doc committed; pipeline script runs idempotently against the pilot module; generated lesson JSON validates against the schema; every atom carries correct `teaches`/`requires` tags; re-running the script after a source edit regenerates only the affected lesson.

**Depends on:** Phase 0. **Blocks:** Phases 2–9 (this is the de-risking pilot the source plan calls out).

### Phase 2 — App shell (Workstream B; depends on: Phase 1)

**Approach:** Stand up the static-first SPA (plain TypeScript + Preact or vanilla Web Components, per the Tech Stack section — explicitly not Next.js/React). Implement the dark theme token system (`--bg`, `--surface`, `--text`, `--accent`, `--danger`/`--success`) to the WCAG 2.1 AA contrast minimums from day one, not as a retrofit. Build the left rail (Today/Tier 1/Tier 2/Copilot/Review), the persistent HUD (progress bar, streak, "N left today"), the generic atom renderer, local persistence (localStorage/IndexedDB), and — critically, built alongside the happy path rather than after — the offline/degraded render for every async boundary (failed content load → last-known-good cached lesson with calm retry; unreachable copilot → "offline, here's the source doc" state). Wire up the PWA shell (service worker, app manifest) here since it depends on the same asset/caching structure as the offline states.

**Definition of done:** pilot module's atoms render one-at-a-time through the shell; HUD and left rail persist across reload; Focus mode toggle works; killing network mid-session falls back to cached content without an error state anywhere in the app; Lighthouse/PWA installability check passes.

**Depends on:** Phase 1. **Blocks:** Phases 3, 7.

### Phase 3 — Core components (Workstream C; depends on: Phase 2)

**Approach:** Build, in order: the Instructions atom (fixed Goal/What-you'll-use/How-you'll-know-you're-done anatomy — this is a schema-enforced prerequisite of every exercise atom, so build it first), Flashcard+SRS (SM-2 scheduler with the enforced topic-diversity/interleaving window), Multiple-choice/fill-in-the-blank (inline feedback, no separate results page), Matching/drag-classify with a keyboard-operable equivalent shipped in the same PR (not after, per the Accessibility Baseline), and the Test-out check component (3–5 generation-format questions, pass skips ahead, anything else drops back into the normal queue with no penalty and no record of failure).

**Definition of done:** all five components pass keyboard-only and screen-reader smoke tests; SRS scheduler unit-tested against known SM-2 interval sequences; test-out check correctly gates on a module's `teaches` tags.

**Depends on:** Phase 2. **Blocks:** Phase 4.

### Phase 4 — Tier 1 complete (Workstreams A + C; depends on: Phases 1–3)

**Approach:** Run the Phase 1 pipeline across all ten Tier 1 modules (SOC orientation through Investigating a user profile). Author Capstone 1 (timed-optional full triage simulation, 3 alerts) by chaining existing components — no new component type needed. This is where the 58 `Tactics/*.md` files get processed at scale for the "Detection tactic categories" module, so budget the most pipeline-hardening time here.

**Definition of done:** all ten Tier 1 modules render end-to-end through the app shell; Capstone 1 completes with the timed-mode consent gate functioning; source-link "from /path" citations resolve for every generated atom.

**Depends on:** Phases 1–3. **Can start in parallel with:** Phase 5 and the early part of Phase 7, once Phase 1's pilot is proven (per the source plan's note that Phases 4/6 can overlap 5/7).

### Phase 5 — Advanced components (Workstream C; depends on: Phase 3)

**Approach:** Build the worked-example calculator widgets (Shannon entropy, robust z-score/MAD, RBA risk score — live input→outcome), the SPL fill-in-the-blank sandbox (client-side grader, explicitly no live Splunk instance), the structured-editor lesson (form-based signature/playbook authoring with required-section validation), and the Scenario+evidence board (fabricated synthetic data only, per Safety Guardrails — never live Lab-script output).

**Definition of done:** each calculator's live outcome matches a hand-computed reference value for at least 3 test inputs; SPL sandbox grades correctly against known-good and known-bad sample signatures; evidence board state persists across navigation within a scenario; structured-editor rejects a submission missing a required section.

**Depends on:** Phase 3. **Can run in parallel with:** Phase 4 (per source plan).

### Phase 6 — Tier 2 complete (Workstreams A + C; depends on: Phases 4–5)

**Approach:** Run the pipeline across all ten Tier 2 modules. Author Capstone 2 (end-to-end alert → investigate → propose an edit) by chaining Phase 5's components. This phase is where Differentiators 1, 3, and 4 (Detection Coverage Sandbox, redacted-signature reconstruction, portfolio-artifact export) become buildable if scoped in — they depend on the structured-editor and scenario components existing first.

**Definition of done:** all ten Tier 2 modules render end-to-end; Capstone 2 emits a properly structured signature/playbook artifact from the learner's work (satisfying the "hiring-ready portfolio artifact" differentiator if in scope); interview-questions.md SRS deck is wired as a cross-tier recurring deck, not a standalone module.

**Depends on:** Phases 4–5.

### Phase 7 — Socratic Copilot (Workstream D; depends on: Phase 2)

**Approach:** Build the model-agnostic adapter interface (`{systemPrompt, context, message} -> streamed response`) first, before any provider-specific code, since this is what preserves the OSS/freemium split. Implement the lightweight local retrieval index (heading-level chunks over the curriculum's source docs, keyword/heading-match — explicitly no embeddings needed at this corpus size). Version the system prompt in `copilot/system-prompt.md`, reviewed like code. Implement the behavior contract in order of how often each mode fires: Socratic default → "usual help" override → Concept breakdown (triggered by "break this down"/"ELI5"/two misses) → scope guardrail (refuses live-attack-simulation walkthroughs against non-lab targets) → graceful-offline degradation → BYO-key rate limit and spend counter. Wire the local-first backend (Ollama/llama.cpp/WebLLM) as the default adapter target, with the BYO-API-key adapter as the second free option.

**Definition of done:** all seven behavior-contract items have a passing scripted test (including the offline-degradation path, which should be exercised by actually killing the backend, not mocked); rate limiter demonstrably caps calls/minute and the on-screen counter matches actual calls made; system prompt changes flow through normal PR review.

**Depends on:** Phase 2. **Can run partially in parallel with:** Phase 4/6 once the app shell is stable.

### Phase 8 — Validation/CI tie-in (Workstream E; depends on: Phases 1, 4, 6)

**Approach:** Extend the repo's existing validation gate (or add a sibling script it invokes) with the six checks from the source plan, in this order since each depends on the last succeeding: content freshness (regenerate and diff) → source-link integrity (reuse existing Markdown link-check) → schema validation → curriculum coverage (every mapped source file has a generated lesson) → prerequisite completeness (every `requires` tag covered by a preceding `teaches` tag, every exercise preceded by an instructions atom) → app-level QA (SRS/component-selection unit tests, axe-core accessibility check, one e2e smoke test per atom type).

**Definition of done:** all six checks run in CI and fail the build on violation; prerequisite-completeness check specifically verified to catch a deliberately broken test case (an exercise with an uncovered `requires` tag) before being trusted as a merge gate.

**Depends on:** Phases 1, 4, 6 (needs both tiers' content to validate against).

### Phase 9 — Usability pass, ongoing (Workstream F; depends on: Phase 7)

**Approach:** Run a structured usability pass measuring re-entry cost (time from open to back-in-lesson), session completion rate, and prerequisite-completeness *in practice* (not just CI-clean — actual learner confusion reports). Stand up the "flag this" review as a standing process, not a one-time pass, since the source plan defines it as the ongoing post-launch feedback loop. Finalize `CONTRIBUTING.md` (review bar: one maintainer approval + clean CI, especially the prerequisite-completeness check) if outside contribution is expected soon after launch.

**Definition of done:** usability pass completed with at least the pilot module and one full tier walked through by someone other than the builder; `CONTRIBUTING.md` merged; "flag this" data reviewed on a defined cadence (weekly during initial launch, per Section 6).

**Depends on:** Phase 7. This phase does not "complete" — it becomes the standing operating process after launch.

## 5. Staffing and skills needed per workstream

| Workstream | Core skill | Notes |
|---|---|---|
| A — Content pipeline | Scripting/parsing (Node or Python), familiar with the source repo's Markdown conventions | Front-loaded in Phase 1, recurs in Phases 4/6 |
| B — App shell | Frontend (TypeScript, Preact/Web Components, PWA/service workers) | Single largest continuous block of work (Phase 2) |
| C — Interactive components | Frontend + light instructional design (SRS/SM-2 familiarity) | Largest total component count; spans Phases 3 and 5 |
| D — Socratic Copilot | LLM integration (local-model serving, prompt/retrieval design) | Isolated by the adapter interface — can be built by someone without frontend depth |
| E — Validation/CI | Scripting, existing repo's CI tooling | Small in isolation but blocking for merge safety from Phase 8 onward |
| F — Governance/launch ops | Writing, project process | Low effort, high leverage — do not skip Phase 0's job-posting cross-check or Phase 9's standing review |

If only one builder is available, the phase order in Section 4 already sequences correctly for solo execution. If a second contributor joins, the best split is Workstream A+E (content/pipeline/validation) versus B+C+D (product), synchronizing at the end of each phase gate.

## 6. Milestone timeline (engineer-weeks, single-builder assumption)

| Milestone | Phases covered | Estimate | Cumulative |
|---|---|---|---|
| M1 — Curriculum confirmed, pipeline proven | 0–1 | 1.5–2 wk | 2 wk |
| M2 — App shell usable end-to-end (pilot module playable) | 2 | 2–3 wk | 5 wk |
| M3 — Core component set complete | 3 | 1.5–2 wk | 7 wk |
| M4 — Tier 1 launch-ready | 4 (+5 in parallel) | 2–3 wk | 9–10 wk |
| M5 — Advanced components + Tier 2 launch-ready | 5–6 | 2–3 wk | 12–13 wk |
| M6 — Copilot live | 7 (parallel with M4/M5) | 2–3 wk, overlapped | +0–1 wk net |
| M7 — CI gate enforced | 8 | 1 wk | 14 wk |
| M8 — Usability pass, launch | 9 | 1 wk, then ongoing | 15 wk |

**Total: roughly 14–15 engineer-weeks to a launchable v1** (both tiers, copilot, CI gate, one usability pass) under the single-builder assumption, with Phase 9 continuing indefinitely as a standing process rather than a milestone with an end date. This estimate carries the most uncertainty at Phase 4/6 (58 tactic files plus the full Tier 2 content set going through the pipeline for the first time at scale) and at Phase 7 (local-model quality/latency is untested in the source plan). Treat the pilot (M1) as the checkpoint to revisit this whole estimate against real pipeline throughput.

## 7. Open decisions carried forward as phase gates

These are the source plan's five Open Decisions, mapped to what they block. None of them block Phase 0 or Phase 1 startup.

| # | Decision | Blocks | If undecided |
|---|---|---|---|
| 1 | Static hosting target (GitHub Pages vs. alternative) | Nothing before Phase 2 build-out; needed by first deploy | Default to GitHub Pages — free, matches "no recurring cost" goal, revisit only if a reason emerges |
| 2 | Whether a paid tier exists, and its scope (pricing, processor, which convenience features) | Nothing in Phases 0–8; only matters for a monetization workstream not covered by this plan | Build the entire v1 as the free/self-hosted product; monetization is additive, never blocking |
| 3 | GPL-3.0 vs. AGPL-3.0 for app code / future hosted-copilot backend | License headers/CI license-check, if one exists; low technical blocking risk | Default to GPL-3.0 for app code (matches repo), AGPL-3.0 reserved for hosted-copilot backend specifically, per the source plan's own recommendation |
| 4 | Pilot module confirmation ("Windows Event ID triage" proposed) | **Phase 1 start** — this is a real blocker, pipeline work needs a concrete first module | Recommend proceeding with the proposed module unless redirected — it has clean structured source tables (Notable-Event-IDs-*.md) that suit automated generation well |
| 5 | Accommodation scope beyond stated baseline (TTS/read-aloud, reduced-motion as hard default) | Phase 2 (if reduced-motion becomes a hard default, it's a token-system decision made once, not retrofitted) | Ship the stated WCAG 2.1 AA baseline for v1; treat TTS and hard-default reduced-motion as Phase 9+ backlog rather than blocking launch |

Decision 4 is the only one that should be resolved before Phase 1 begins; the rest can be resolved opportunistically without stalling the build.

## 8. Top risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Automated parsing of 58 `Tactics/*.md` files produces inconsistent atom quality (headings/lists don't parse uniformly across all files) | Delays Phase 4, degrades content quality | Phase 0's audit should sample-check heading structure across a spread of tactic files, not just the pilot module's docs, before Phase 1 pipeline design locks in |
| Prerequisite-completeness CI check is built late (Phase 8) after content already violates it | Expensive rework across Phases 4/6 content | Consider a lightweight version of the `requires`/`teaches` check as a local pre-commit script starting in Phase 1, ahead of the full Phase 8 CI build |
| Local-model copilot quality/latency untested until Phase 7 | Could force a late pivot on the "local-first by default" commitment | Do a throwaway spike with the target local-model stack (Ollama or WebLLM) during Phase 2, in parallel, purely to validate feasibility before Phase 7 architecture locks in |
| Accessibility retrofitted instead of built-in (keyboard-drag, contrast) | Rework across Workstream C components, possible Phase 9 findings that require Phase 3/5 rework | Enforce axe-core check (Phase 8 item) as a per-PR gate starting in Phase 2, not deferred to Phase 8 |
| Scope creep from the five Differentiators pulled into required v1 scope | Timeline blows past Section 6 estimate | Treat Differentiators 1/3/4/5 as explicitly stretch/Phase 6+ scope (Section 3) unless the requester states otherwise |

## 9. Definition of done for v1 launch

Both tiers complete (Phases 4 and 6), Socratic Copilot live in local-first mode (Phase 7), full CI gate enforced with zero curriculum-coverage and zero prerequisite-completeness violations (Phase 8), one usability pass completed (Phase 9 start), and the success metrics from the source plan (re-entry cost, session completion rate, SRS retention trend, copilot escalation rate, curriculum coverage drift, prerequisite-completeness violations, abort/skip usage, flag-this volume) computed and visible in a local Stats view — all with the local-only telemetry stance from the source plan honored (nothing transmitted anywhere).

See `execution.md` for the task-level breakdown to track against this plan during the build.
