# SOC Academy — Build Plan

> **Provenance.** Converted verbatim from `docs/source/SEIMAcademyBuildPlan.docx`
> (the seed Build Plan). The text below is the source of truth for *what* to build;
> `IMPLEMENTATION-PLAN.md` sequences it and `execution.md` tracks it task by task.
> The original `.docx` is retained under `docs/source/` — edit that and re-convert,
> or promote this Markdown to canonical, but do not let the two drift silently.

An interactive, dark-cyber-themed learning module that turns this repo's knowledge base into a Tier 1 / Tier 2 SOC analyst training track, with an embedded Socratic copilot agent. This is the seed plan for a proposed Academy subtree — nothing here is implemented yet.

## Goals & Non-Goals

#### Goals

- **Learner outcome.** Take a learner with no SOC background to “can competently triage and escalate” (Tier 1) and then to “can write/tune detections and run playbooks” (Tier 2), using the source repo's own content as the source of truth.
- **ADHD-usable and anxiety-safe.** Usable by someone with severe ADHD without executive-function tax, and never induces anxiety or overwhelm — ease of use, unambiguous instructions, and a learner who is always fully prepared for what's in front of them are non-negotiable. See Design Principles.
- **Socratic copilot.** Ship a copilot that defaults to guiding questions but never refuses to just answer when asked, and can decompose hard concepts (entropy, MAD/robust z-score, Kerberoasting, RBA scoring) into smaller steps.
- **Fully open source, optional freemium.** The self-hosted path runs end-to-end at zero recurring cost and zero proprietary dependency — no core learning content is ever paywalled. See Tech Stack, Licensing & Monetization.

#### Non-Goals

- **Not a replacement for the reference docs.** The Academy teaches from Tactics/, Signatures/, Detection-Methods.md, etc.; it never forks or duplicates their content by hand.
- **Not a general LMS/SCORM product.** No user-management backend, no multi-tenant auth unless a real second user shows up.
- **Not a place to run live attack-simulation scripts.** Those stay lab-only per existing repo policy (see Safety Guardrails).

## Design Principles

Three overlapping sets of principles drive every build decision below, each flagged inline as [Build: …]: what makes the app usable with severe ADHD, what keeps it from ever triggering anxiety or a meltdown, and what actually makes the content stick. Where they conflict, the anxiety-safe rule wins.

### ADHD-Friendly Interaction

- **Atomic sessions, not chapters.** Every lesson fits in 3–7 minutes; a “module” is a queue of atoms, not a wall of scroll.  [Build: schema caps atom body length; UI shows one atom at a time]
- **Zero-cost re-entry.** Closing the tab mid-lesson costs nothing — no lost progress, no re-reading.  [Build: autosave position per atom, resume-exactly-here on load]
- **Progress is visible, not implied.** A completion bar, streak counter, and “N atoms left” are always on screen — ambient reward, not end-of-course reward.  [Build: persistent progress HUD]
- **Low-friction start.** No “are you ready?” screens; one click from landing to learning.  [Build: instant “Continue”/“Start” on the home screen, defaults chosen not asked]
- **Interrupt-tolerant interaction.** No auto-advancing timers or punishing pauses — timers create anxiety and abandonment. An optional self-paced “sprint mode” exists, off by default.  [Build: no default countdowns; opt-in sprint-mode toggle]
- **External working memory.** The UI keeps state visible instead of asking the learner to hold it — e.g. a scenario's evidence board persists rather than requiring recall.  [Build: persistent evidence-board panel on scenario lessons]
- **High signal-to-noise visual design.** Dark theme cuts glare; one accent color marks every interactive element, everything else desaturated.  [Build: strict token system, see UI/UX Spec]
- **Novelty in modality, not just content.** Flashcards, drag-to-map, fill-in-the-SPL-blank, scenario triage — repeated format is as fatiguing as repeated content.  [Build: component inventory below, rotate format within a module]
- **Spaced repetition instead of cramming.** Facts that must be memorized go into an SRS queue at expanding intervals instead of a static syllabus the learner must hold in mind.  [Build: SM-2-style scheduler]
- **Body doubling / low-stakes accountability, optional.** A daily streak and a single “today's queue” remove planning overhead — often the real ADHD blocker, not content difficulty.  [Build: “Today” is the default landing tab]
- **A “test out” option on every module.** Someone who already knows a module's material shouldn't have to sit through it — a short, optional check (3–5 generation-format questions covering that module's “teaches” tags) skips the atom queue if passed. Forcing a known-material learner through the full sequence is its own frustration source.  [Build: a test-out component per module; declining or failing it just drops back into the normal queue — never penalized, never remembered as a “fail”]

### Ease-of-Use & Anxiety-Safe Design

- **Every exercise is preceded by a dedicated Instructions atom** — never blended into the exercise. Fixed anatomy every time: Goal → What you'll use (linked back to where it was taught) → How you'll know you're done.  [Build: schema requires an “instructions” atom immediately before every “exercise” atom]
- **No exercise may require knowledge that wasn't explicitly taught first** — the single biggest anxiety source in training software. Exercise atoms declare “requires” tags; content/instructions atoms declare “teaches” tags; the build fails if a “requires” tag isn't covered by a preceding atom. Enforced structurally, not left to careful authoring.  [Build: requires/teaches tags in app-data-schema.md; CI check, see Validation & CI Tie-in]
- **Mistakes are informational, never punitive.** Wrong-answer feedback states what's true and why in neutral language — no shame-adjacent copy, no harsh red flash, no penalty beyond the SRS interval reset that already exists for spacing.  [Build: danger token is muted, not alarming; a documented feedback-copy pattern]
- **Every screen has a visible, always-available way out.** “Skip,” “hint,” “pause,” and “exit to Today” are never hidden behind a menu and never require finishing first.  [Build: persistent exit affordance rendered once by the app shell]
- **Predictable structure everywhere.** Every lesson and exercise type uses the same fixed template, so no attention is spent parsing a new layout on top of new content.  [Build: one shared renderer per atom type]
- **Any timed or high-pressure mode requires explicit, separate opt-in** with a plain-language warning and a one-click, zero-penalty abort. Governs the Alert Fatigue mode in Differentiators: opt-in per session, never default, and quitting mid-session counts the same as finishing.  [Build: consent screen gates entry to any timed mode]
- **Difficulty ramps are visible and gradual, never a cliff.** A meaningfully harder exercise is signaled up front (“this one's a step up”), not discovered mid-struggle.  [Build: a difficulty tag per exercise, surfaced in its Instructions atom]
- **Failure degrades gracefully — the app never shows a bare error.** A failed content load falls back to the last-known-good cached lesson with a calm retry affordance; an unreachable copilot backend degrades the panel to “offline — here's the source doc” with a direct link, never an error dialog or a stuck spinner. A broken-feeling app is itself an anxiety trigger.  [Build: every async boundary defines an explicit offline/degraded render, built alongside the happy path in Phase 2, not after]

### Retention & Recall Design

- **Interleaved retrieval, not blocked practice.** Never drill one topic ten-in-a-row — mix adjacent-but-different concepts so recall requires distinguishing which concept applies, not just recalling one in isolation.  [Build: SRS scheduler enforces a minimum topic-diversity window]
- **Retrieval-first, not review-first.** A low-stakes “what do you think this means?” guess before new content improves retention of what follows (the pretesting effect), even when wrong.  [Build: every module's opening atom is a “predict” atom, never graded]
- **Generation over recognition.** Multiple choice is the weakest recall format. Bias toward production formats — type the Event ID, type the SPL clause — on second/third SRS passes; reserve MC for first exposure.  [Build: component-selection logic keys off SRS pass count]
- **Elaborative “why” prompts from the copilot.** After a correct answer, an occasional skippable “why does that work, though?” drives self-explanation, one of the more reliable retention boosters.  [Build: low-probability trigger in the copilot's post-answer turn]
- **Real-world “callback” injection.** A later scenario quietly depends on an earlier-tier fact (a Tier 2 Sigma scenario needing a Tier 1 Event ID), testing transfer instead of isolated recall.  [Build: scenarios tag a “callback” concept; pipeline verifies it was actually taught]

## Curriculum Map (Sourced From This Repo)

Every lesson cites its source doc(s) by path so content never drifts from the reference material. Tier 1 = detect/triage/escalate; Tier 2 = investigate/tune/engineer.

### Tier 1 Track — “Analyst I: Triage & Escalation”

| Module | Source material | Interactive formats |
|---|---|---|
| SOC orientation & what you're protecting | Orientation/crown-jewels.md, README.md | reading atom + quiz |
| Logging fundamentals: what gets collected and why | Logging/Logging.md, Logging/Logging-Windows.md | flashcards |
| Windows Event ID triage | Notable-Event-IDs-Sigma.md, -Risk.md, -Forensics.md | SRS flashcards, drag-to-classify |
| Detection tactic categories (what/why, not rules) | Tactics/*.md (58 files) | matching game: tactic → data source → field |
| Reading an alert: alarm algorithm vocabulary | Detection-Methods.md (Threshold/Blacklist/Whitelist/Rolling) | fill-in-the-blank + “spot the algorithm” |
| MITRE ATT&CK mapping literacy | Detection-Tactics.md | drag tactic-row → ATT&CK column |
| Field kit & note-taking discipline | field-kit.md | checklist atom |
| Escalation basics & documentation | Incident-Response-Policy.md, Metrics.md | scenario: triage, decide escalate/close |
| Investigating a user profile (walkthrough) | Investigating/WindowsUserProfile.md | guided scenario, evidence board |
| Capstone 1 | mixed | timed-optional full triage simulation, 3 alerts |

### Tier 2 Track — “Analyst II: Investigation & Detection Engineering”

| Module | Source material | Interactive formats |
|---|---|---|
| Detection method deep dive | Detection-Methods.md (Deviation, Levenshtein, Shannon Entropy) | worked-example calculator widgets |
| Reading & writing SPL signatures | Signatures/Splunk/*.md, MAD pattern in panorama.md | SPL fill-in-the-blank sandbox |
| Formal signature authoring | Matrix/Signature-Structure.md | structured-editor lesson |
| Playbook authoring & execution | Matrix/Playbook-Structure.md, password-spraying playbook | scenario: execute a playbook step-by-step |
| Sigma → Splunk pipeline literacy | sigma/adoption.md, sigma/pipelines/*.yml | “trace a rule through the pipeline” diagram |
| Risk-Based Alerting | Risk-Based-Alerting/Overview.md, Risk-Rules.md | risk-score calculator widget |
| Data enrichment & lookups | Lookups/*.csv | lookup-table drill |
| Threat hunting | Threat-Hunting.md, osintel.md | hypothesis-driven scenario |
| Hardening ↔ detection cross-reference | hardening/*.md vs Tactics/*.md | matching game: control → threat prevented |
| The Detection & Compliance Matrix | Matrix/Detection-and-Compliance-Matrix.md | schema-literacy quiz |
| Capstone 2 | mixed | end-to-end: alert → investigate → propose an edit |

Interview readiness (interview-questions.md) is a recurring SRS deck across both tiers rather than its own module — it's review material, not new content.

## Information Architecture

```text
Academy/
  BUILD-PLAN.md              <- this document
  CONTRIBUTING.md            <- scenario/content contribution + review process
  content/                   <- generated, not hand-authored (see pipeline below)
    manifest.json            <- module/lesson graph, tier tags, source doc refs
    lessons/*.json
  src/                       <- the app (see tech stack)
  app-data-schema.md         <- lesson/atom/quiz JSON schema reference
  copilot/
    system-prompt.md         <- Socratic Copilot system prompt (versioned, in PRs)
    grounding-index.md       <- how the copilot's retrieval is built/refreshed
```

Content lives under Academy/content/ but is generated from the canonical docs elsewhere in the repo by a build script — never hand-duplicated, so the Academy can't drift out of sync with the reference material it teaches from.

## Content Pipeline (Repo Docs → Lessons)

- A script (Academy/scripts/build-content.*) walks the source directories in the curriculum map, parses each Markdown file's headings/lists, and emits normalized lesson atoms into Academy/content/lessons/*.json.
- Each generated atom carries a “source” field (repo-relative path, optionally #heading) so the UI can always show “from /Tactics/DNS-Request.md” and deep-link back to the reference doc.
- Quizzes/flashcards for factual recall are generated directly from Lookups/*.csv and the Notable-Event-IDs tables — no hand-copied answer keys that can go stale.
- Hand-authored content is limited to scenario narratives, worked-example widgets (entropy/MAD calculators), and the copilot's system prompt — the things that genuinely don't exist in the reference docs yet.
- Every generated atom carries “teaches” tags (content/instructions) or “requires” tags (exercises), per the anxiety-safe design principles — the pipeline derives these from the source doc's headings/terms it just parsed.
- Re-running the script after an edit regenerates the affected lesson automatically, and feeds the repo's validation gate so stale content — or an exercise whose “requires” tags outrun what's been taught — fails CI.

## UI/UX Spec — Dark Cyber Theme

#### Palette (tokens, not literals — dark-first, single accent)

- **--bg:** near-black, slightly blue/green cast (#0a0e12–#0d1117), never pure black.
- **--surface:** one step up for cards/panels.
- **--text:** high-contrast off-white for body; dimmer secondary for metadata/source citations.
- **--accent:** one saturated color (terminal-green or cyan), reserved exclusively for interactive affordances — never decorative, so it always means “you can act here.”
- **--danger / --success:** distinct from accent, used only for quiz feedback.
- **Typography:** monospace for anything that's literally log/SPL/event data; humanist sans for prose — the distinction signals “fact to read” vs. “system string to recognize.”

#### Layout Rules

- One atom per screen. No infinite-scroll lesson pages.
- Persistent top HUD: session progress bar, streak count, “N left today.”
- Persistent left rail: Today / Tier 1 / Tier 2 / Copilot / Review — always one click away.
- Motion is minimal and purposeful — no ambient animation competing for attention.
- A “Focus mode” toggle hides the left rail and HUD chrome except the progress bar.
- A persistent, unobtrusive “flag this” affordance on every atom — one click, optional one-line note — writes to local storage as the ongoing feedback signal past the one-time usability pass.

#### Accessibility Baseline

Beyond ADHD/anxiety-safety, which the palette/layout above already serve: WCAG 2.1 AA contrast minimums (4.5:1 body text, 3:1 large text/UI elements) apply to every token pairing, including accent on background. --danger/--success are never color-only signals — each is paired with an icon/shape so colorblind learners get the same information. Every drag-classify interaction ships a keyboard/click-to-select equivalent from day one, not as a later add-on.

## Interactive Component Inventory

| Component | Used for | Notes |
|---|---|---|
| Instructions atom | Precedes every exercise | Fixed anatomy (Goal / What you'll use / How you'll know you're done) |
| Flashcard (SRS) | Event IDs, MITRE IDs, logon/status codes, terminology | SM-2 scheduling with an enforced topic-diversity window |
| Multiple choice / fill-in-blank | Concept checks | Immediate inline feedback, never a separate results page |
| Matching / drag-classify | tactic↔ATT&CK, control↔threat, EventID↔bucket | Two-column drag, keyboard-operable, works on touch |
| Worked-example calculator | Shannon entropy, robust z-score/MAD, RBA risk score | Learner adjusts inputs, sees the alarm/no-alarm outcome live |
| SPL fill-in-the-blank sandbox | Signature authoring | Client-side grader, no live Splunk instance required |
| Structured-editor lesson | Signature/Playbook authoring | Form mirrors the required layout; validates required sections present |
| Scenario + evidence board | Triage, investigation, threat hunting | Fabricated synthetic data; evidence board persists so nothing must be held in memory |
| Diagram trace | Sigma→Splunk pipeline | Click each pipeline stage, see what changed in the query |
| Test-out check | Skipping a module's atom queue | 3–5 generation-format questions; pass skips ahead, anything else drops into the normal queue, no penalty |
| Capstone simulation | End-of-tier | Chains 3–5 of the above back to back, no scaffolding |

Spaced repetition scheduler: standard SM-2, per-learner state stored locally. “Review” in the left rail always shows today's due count — the ambient-accountability mechanism instead of a calendar/syllabus.

## Differentiators

Five things that set the Academy apart from generic SOC-training platforms — each earns its place because it's only possible because this repo has real, structured detection content behind it.

- **Detection Coverage Sandbox.** Run a written rule live against a synthetic corpus of attack-variant logs (same technique, different LOLBins/paths/casing/encoding); return an ATT&CK sub-technique coverage score and false-positive rate, then diff against the real reference signature. Teaches that a detection is a coverage/noise trade-off, not a single right answer.
- **Adaptive Socratic “weak-spot” engine.** The copilot mines miss patterns across sessions — not just that an answer was wrong but which wrong answer — and auto-authors a short personalized micro-lesson with a fresh analogy. A real step beyond static SRS.
- **Redacted-production-signature reconstruction.** Blank out key clauses of a real detection already in this repo, have the learner reconstruct it, and grade by diffing against the actual production-grade query.
- **Auto-generated hiring-ready portfolio artifacts.** Every capstone emits a real, properly structured signature or playbook authored by the learner — study exhaust becomes something to show a hiring manager, not just a completion badge.
- **Stress-inoculation “Alert Fatigue” mode + in-flow brain-dump capture.** An opt-in mode that floods the queue with a realistic true/false-positive ratio under a soft SLA clock — the one deliberate exception to “no punishing timers,” because the pressure is the skill. Paired with a zero-friction “brain dump” capture so a stray thought doesn't derail the queue. Explicit consent before entry, one-click abort, quitting counts the same as finishing.

## Socratic Copilot Agent

#### Behavior Contract

- **Default mode — Socratic.** Respond with 1–2 guiding questions or a nudge toward the relevant source doc before giving the answer outright, unless the learner is clearly stuck — then answer directly. Mirrors how a good Tier 3/lead mentors a new analyst: make them reason first, but don't withhold help as a gate.
- **“Usual help” mode.** A visible toggle or a typed override (“just tell me”) switches to direct answers for the rest of the session — the Socratic default must never feel like a locked door.
- **Concept breakdown mode.** Triggered by “break this down” / “I don't get it” / “ELI5,” or auto-offered after two misses on one concept. A short staircase: plain-language analogy → the actual mechanism → how it shows up in this repo's detections (cited). Capped length, exempt from Socratic question-first behavior — a confused learner needs traction, not more questions.
- **Always grounded in this repo.** Answers use this org's terminology and detection methods, citing the source doc. If the repo doesn't cover something, the copilot says so rather than inventing an answer.
- **Scope guardrail.** The copilot teaches; it does not execute anything. It refuses to walk a learner through running attack-simulation scripts against a non-lab target, and flags a question trending toward “how do I do this against a real system.”
- **Degrades gracefully when unreachable.** Local model not running, invalid BYO key, or hosted service down all resolve to the same calm state: the panel says it's offline and links straight to the relevant source doc instead of erroring.
- **BYO-key usage is rate-limited and visible.** When running against a learner's own API key, a client-side rate limit caps calls per minute and a small “N calls this session” counter stays on screen — nothing in the app should be able to silently burn through someone's own API spend.

#### Grounding & Retrieval

A lightweight local index over the curriculum's source docs (heading-level chunks, repo-relative paths as IDs); keyword/heading-match retrieval to start (a few hundred KB of Markdown doesn't need embeddings). Every turn retrieves top-N chunks for the learner's current lesson context plus their question, injects them, and generates against the versioned system prompt — reviewed like code, not hardcoded in the app, so tone/behavior changes are auditable in git history.

#### Model-Agnostic by Design

The copilot talks to an LLM through one small adapter interface ({systemPrompt, context, message} -> streamed response), never a provider-specific SDK call scattered through the app — this is what makes the OSS/freemium split possible: the same prompt and retrieval logic runs against a free local model or a paid hosted one, only the adapter changes. Socratic question-asking should work fine on a small open-weight model; Concept Breakdown (the one mode requiring real synthesis) is the mode most likely to benefit from a larger model — the natural place, not an arbitrary one, for a free/premium quality difference if one turns out to exist.

## Tech Stack, Licensing & Monetization

### Stack Recommendation

The rest of this repo deliberately has no build system — correct for a docs knowledge base — but the Academy is a genuinely interactive app and needs one.

- **Static-first SPA:** plain TypeScript + a lightweight view layer (Preact or vanilla Web Components) rather than a full Next.js/React framework — nothing here needs SSR or a routing framework.
- **All content client-side.** Lesson JSON + SRS state via localStorage/IndexedDB — a single-learner tool, no account system needed initially.
- **Copilot backend, local-first by default.** The self-hosted/OSS build defaults to an open-weight model served locally (Ollama, llama.cpp, or a browser-only WebGPU model via WebLLM) — no API key, no recurring cost, nothing proprietary in the critical path. A “bring your own API key” adapter (Claude, or any OpenAI-compatible endpoint) is a second free option, with the rate-limit/spend-visibility guardrail described under Socratic Copilot Agent. A managed hosted-copilot adapter (frontier model, subscription/usage-gated) is the one place a paid tier plugs in.
- **Installable and offline-capable (PWA).** A service worker caches the app shell and lesson content so the SPA keeps working with no connection once loaded — the natural conclusion of a local-first copilot story.
- **Hosting:** static site hosting (e.g. GitHub Pages) for the SPA — free either way. The only infrastructure with recurring cost is the optional managed copilot service.
- **Dependency policy:** every dependency in the free/self-hosted critical path must be permissively-licensed OSS with no usage-based pricing baked in.
- **Deferred until needed:** user accounts, multi-device sync, analytics backend — if built, these are the natural home for the paid tier.

### Licensing & Monetization Model

License: the source repo is GPL-3.0. Academy content is derived from GPL-3.0-licensed docs, so generated content inherits GPL-3.0. For the app code: GPL-3.0, matching the repo, is the simplest choice — with AGPL-3.0 reserved specifically for a future managed-copilot backend, since AGPL closes the “run it as SaaS without contributing changes back” loophole plain GPL leaves open.

Always free (self-hosted, OSS build): 100% of Tier 1/2 curriculum content, all interactive components, SRS, capstones, portfolio-artifact generation, and the Socratic Copilot running against a local model or the learner's own API key. Response quality may trail a hosted frontier model, but the behavior contract is unchanged — the free tier is a real product, not a crippled demo.

A paid tier could reasonably add (never gates learning, only convenience/quality): a managed hosted copilot on a frontier model, cross-device progress/SRS sync, and higher-fidelity Concept Breakdown responses if testing shows a meaningful local-model quality gap there specifically.

Ethical constraint: the audience is a learner with severe ADHD trying to break into a SOC career — gating core learning content behind a paywall works directly against the mission. Any paywall belongs on hosting convenience, never content.

Privacy/telemetry stance — local-only by default: every success metric (completion rate, SRS retention, abort rate, feedback-flag count) is computed and shown to the learner in a personal “Stats” view and never transmitted anywhere. Nothing phones home in the free/self-hosted build. If a hosted paid tier ever needs aggregate usage data, that's a separate, explicit opt-in with a one-line explanation of what's sent — never a default.

### Contribution & Governance

“Fully open source” implies outside contributors eventually, and the one hand-authored content category (scenario narratives) is exactly the kind of thing people will want to add to. Minimum viable governance: a CONTRIBUTING.md covering how to submit new scenario/worked-example content, the review bar (at least one maintainer approval plus a clean run of the CI gates — especially the prerequisite-completeness check, so community-submitted exercises are held to the same “never test what wasn't taught” rule as generated content), and where discussion happens (GitHub Issues/Discussions on the repo, no separate platform to stand up). Intentionally light — revisit only if contribution volume ever makes it a bottleneck.

## Safety Guardrails (Lab Content)

This repo already flags its attack-simulation scripts as generating real, destructive AD changes intended for an isolated lab only. The Academy must not blur that line:

- Scenario/simulation content uses fabricated synthetic log data baked into the lesson JSON, never live output from the Lab scripts.
- A lesson that references the Lab scripts links to them as reference material and repeats the isolated-lab-only warning; it never embeds a “run this” affordance.
- The Socratic Copilot's scope guardrail enforces the same boundary conversationally.

## Validation & CI Tie-In

Extend the repo's existing validation gate (or add a sibling script invoked by it) with:

- Content freshness — regenerate Academy/content/ and diff against committed output; fail if stale.
- Source-link integrity — every lesson's source path resolves, reusing the existing Markdown link-check logic.
- Schema validation — every lesson JSON matches app-data-schema.md.
- Curriculum coverage — every source file claimed by the curriculum map actually has a generated lesson.
- Prerequisite completeness — every exercise atom's “requires” tags are covered by “teaches” tags on a preceding atom, and every exercise has an instructions atom immediately before it. A learner should never hit an exercise the app didn't actually prepare them for.
- App-level QA — unit tests for the SRS scheduler and component-selection logic, an automated accessibility check (e.g. axe-core), and an e2e smoke test per atom type. Cross-browser/mobile passes stay manual, folded into the usability pass.

## Build Phases

| Phase | Deliverable | Depends on |
|---|---|---|
| 0 — Content audit | Finalize curriculum map; tag source docs; cross-check the module list against real Tier 1/2 job postings and Security+/GCIH objectives | none |
| 1 — Schema & pipeline | app-data-schema.md, build-content script, generated lessons for one pilot module | Phase 0 |
| 2 — App shell | Dark theme tokens, left rail, HUD, atom renderer, local persistence, offline/degraded states, PWA shell | Phase 1 |
| 3 — Core components | Flashcard+SRS, MC/fill-blank, matching/drag (keyboard equivalent), test-out check | Phase 2 |
| 4 — Tier 1 complete | Full pipeline run across Tier 1 modules; Capstone 1 | Phases 1–3 |
| 5 — Advanced components | Calculators, SPL sandbox, structured-editor lesson, scenario+evidence board | Phase 3 |
| 6 — Tier 2 complete | Full pipeline run across Tier 2 modules; Capstone 2 | Phases 4–5 |
| 7 — Socratic Copilot | System prompt, retrieval index, adapter interface, chat panel UI, rate limit/spend counter | Phase 2 |
| 8 — Validation/CI tie-in | Extend validation gate, including app-level QA | Phases 1, 4, 6 |
| 9 — Usability pass, ongoing | Session length, re-entry cost, prerequisite-completeness in practice; standing review of “flag this” feedback | Phase 7 |

Phases 4 and 6 can run partially in parallel with 5/7 once the pipeline and app shell are proven on the Phase 1 pilot — the pilot exists specifically to de-risk both before committing to all 58 tactic files.

## Success Metrics

- **Re-entry cost:** time from opening the app to being back in a lesson ≈ 0.
- **Session completion rate:** % of started sessions that finish the current atom queue.
- **SRS retention:** recall accuracy on due-for-review items trending up, not flat.
- **Copilot escalation rate:** how often learners need “just tell me” vs. staying Socratic.
- **Curriculum coverage drift:** CI gate at zero failures.
- **Prerequisite-completeness violations:** zero, always — the measurable proxy for “the learner is never thrown into something they weren't prepared for.”
- **Abort/skip usage in timed modes:** a healthy signal, not a failure metric.
- **“Flag this” volume and clustering:** the ongoing, post-launch version of the usability pass.

All of the above are computed and shown locally to the learner only — see the privacy/telemetry stance under Tech Stack, Licensing & Monetization.

## Open Decisions

Genuine calls for you to make, not blockers to drafting this plan:

- Hosting target for the static SPA (GitHub Pages, or another static host) — low-stakes, free either way.
- Whether a paid tier exists at all, and if so: pricing model, payment processor, and how much of the “what a paid tier could add” list you actually want to build versus leaving as local-model/BYO-key only indefinitely.
- GPL-3.0 vs. AGPL-3.0 for the app code and any future hosted-copilot backend — AGPL-3.0 recommended for the backend specifically; confirm or override.
- Pilot module confirmation: “Windows Event ID triage” is proposed for Phase 1 — confirm or pick a different first slice.
- Scope of accommodations beyond the above — e.g. a read-aloud (TTS) option, or reduced-motion as a hard default rather than a toggle.

## Gap Analysis

Gaps identified during planning, and where each was resolved. Kept as a record rather than deleted — useful for anyone later wondering “was accessibility considered?”

| Gap | Resolution |
|---|---|
| Accessibility beyond ADHD/anxiety | WCAG 2.1 AA contrast, color-plus-icon feedback, keyboard-equivalent drag — UI/UX Spec |
| No placement/diagnostic path | Test-out check per module — ADHD-friendly principle 11 |
| Error/degradation resilience undefined | Graceful degradation as a first-class UI state — anxiety-safe principle 8, Copilot behavior 6 |
| BYO-API-key cost/rate-limit guardrail missing | Client-side rate limit + spend counter — Copilot behavior 7 |
| Privacy/telemetry stance not stated | Local-only-by-default, explicit — Licensing & Monetization, Success Metrics |
| App-level QA plan absent | Unit/e2e/a11y checks added as CI check 6 — Validation & CI Tie-in |
| OSS contribution/governance workflow undefined | CONTRIBUTING.md + review bar — Contribution & Governance |
| No outcome validation against real hiring signals | Job-posting/cert cross-check added to Phase 0 — Build Phases |
| Offline/reliability posture unstated | PWA/service-worker shell — Stack Recommendation |
| No post-launch feedback loop | Persistent “flag this” affordance + standing review — UI/UX Spec, Build Phases |

None of these were structural surprises — each slots into a section that already existed, which is itself a signal the overall shape of the plan was sound going in.
