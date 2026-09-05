# SEIM-Academy

Planning repository for **SOC Academy** — an interactive, dark-cyber-themed learning
module that turns a SOC knowledge-base repo into a Tier 1 / Tier 2 analyst training
track, with an embedded Socratic copilot agent.

**Status: planning only. Nothing is implemented yet.** This repo currently holds the
three planning documents and no application code. Phase 0 (content audit) has not
started — see `planned_execution.md`.

## What's here

| Document | Role | Use it for |
|---|---|---|
| [`BUILD-PLAN.md`](BUILD-PLAN.md) | **What** to build — the seed plan | Goals, design principles, curriculum map, UI/UX spec, copilot behavior contract, tech stack, phases 0–9, success metrics, open decisions |
| [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) | **How and in what order** | Workstreams, per-phase technical approach + definition of done, staffing, timeline, risks, decision gates |
| [`execution.md`](execution.md) | **Task-level tracker** | Day-to-day checklist per phase, with exit checks |
| [`planned_execution.md`](planned_execution.md) | **Sequenced execution view** | Current phase, next unstarted item, what closed last session |
| [`docs/source/`](docs/source/) | Provenance | The original `.docx` that `BUILD-PLAN.md` was converted from |
| [`LICENSE`](LICENSE) | Terms | GPL-3.0 (Open Decision 3, resolved) |

`planned_execution.md` never competes with `execution.md` for completion state — it
derives from it and stays a sequenced view.

## The shape of the build

Ten phases, roughly 14–15 engineer-weeks to a launchable v1 under a single-builder
assumption (see `IMPLEMENTATION-PLAN.md` §6):

```text
0 Content audit ─> 1 Schema & pipeline ─> 2 App shell ─┬─> 3 Core components ─> 4 Tier 1 ─┐
                                                        │                      5 Advanced ─┼─> 6 Tier 2 ─> 8 CI gate ─> 9 Usability
                                                        └─> 7 Socratic Copilot ────────────┘
```

Phase 1 is a deliberate de-risking pilot (one module end-to-end) before committing to
all 58 `Tactics/*.md` files.

## Non-negotiables carried from the Build Plan

These are design constraints, not preferences — they exist because the target learner
has severe ADHD and the plan treats anxiety-safety as the tiebreaker rule:

- **No exercise may require knowledge that wasn't explicitly taught first.** Enforced
  structurally via `requires`/`teaches` tags and a CI gate, not by careful authoring.
- **Every exercise is preceded by a dedicated Instructions atom** with fixed anatomy.
- **Content is generated, never hand-duplicated** — the Academy cannot drift from the
  reference docs it teaches from.
- **Nothing phones home.** All metrics are computed and shown locally to the learner.
- **Core learning content is never paywalled.**
- **Scenario data is fabricated** — never live output from attack-simulation scripts.

## Open decisions

Five carried forward from the Build Plan (see `IMPLEMENTATION-PLAN.md` §7).
**Decision 3 (licensing) is resolved** — GPL-3.0, applied. Of the remaining four, one
blocks work: **Decision 4 — confirm the Phase 1 pilot module** ("Windows Event ID
triage" is proposed). The rest have working defaults and can be resolved opportunistically.

## A note on naming

The seed Build Plan calls the project *SOC Academy* and its subtree `Academy/`; the
derived plans call it `SEIMAcademy/`; this repo is `SEIM-Academy`. Three names for one
thing. Worth settling before Phase 1 creates directories under any of them — tracked as
an open item in `planned_execution.md`.

## License

**GPL-3.0** — see [`LICENSE`](LICENSE). This matches the source knowledge-base repo, from
which generated Academy content inherits GPL-3.0 regardless, so one license covers the
whole tree rather than two.

**AGPL-3.0 remains reserved** for a future managed-copilot backend specifically. Plain
GPL-3.0 requires source release on *distribution*; running modified software as a network
service is not distribution, so a hosted copilot could otherwise be operated as SaaS with
no changes contributed back. AGPL-3.0 closes that. This is the Build Plan's own split and
applies only to that one component if it is ever built.

Resolves Open Decision 3.
