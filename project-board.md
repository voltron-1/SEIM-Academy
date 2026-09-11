# SEIM-Academy — Project Board

Kanban companion to `execution.md` and `planned_execution.md`. Those two remain the
source of truth for completion state — this file never competes with them for it. It
re-slices the same data into agile board form: columns by status, one card per phase
(epic-level) plus a Current Sprint lane with task-level cards for whatever phase is
actively in progress. Update `execution.md` first when a task's state changes; re-derive
this file from it.

Board granularity is deliberately epic-level (one card per phase) for the main board,
because the single-builder staffing assumption (`IMPLEMENTATION-PLAN.md` §2) means only
one phase is normally in progress at a time — a 150-card task-level board would be noise,
not signal. Task-level detail lives in the Current Sprint lane instead, and in
`execution.md` itself.

**WIP limit: 1 phase In Progress at a time**, except where `IMPLEMENTATION-PLAN.md` §4
explicitly marks phases as parallelizable (Phase 5 with Phase 4; early Phase 7 with
Phase 4/6). This isn't a scheduling nicety — it's the staffing assumption the whole
timeline in §6 rests on.

Status markers match `planned_execution.md`: `[ ]` todo · `[~]` in-progress · `[x]` done ·
`[!]` blocked.

---

## Board

### 🔒 Blocked

_Empty — nothing is currently blocked (`planned_execution.md` § Blocked)._

### 📋 Backlog

Not started, not next in line. Ordered by phase sequence, not priority — dependencies fix
the order (see the phase graph in `README.md`).

| Phase | Epic | Issue | Workstream | Depends on |
|---|---|---|---|---|
| 3 | Core components | [#5](https://github.com/voltron-1/SEIM-Academy/issues/5) | C | Phase 2 |
| 4 | Tier 1 complete | [#6](https://github.com/voltron-1/SEIM-Academy/issues/6) | A + C | Phases 1–3 |
| 5 | Advanced components | [#7](https://github.com/voltron-1/SEIM-Academy/issues/7) | C | Phase 3 (parallel w/ Phase 4) |
| 6 | Tier 2 complete | [#8](https://github.com/voltron-1/SEIM-Academy/issues/8) | A + C | Phases 4–5 |
| 7 | Socratic Copilot | [#9](https://github.com/voltron-1/SEIM-Academy/issues/9) | D | Phase 2 (parallel w/ Phase 4/6) |
| 8 | Validation / CI tie-in | [#10](https://github.com/voltron-1/SEIM-Academy/issues/10) | E | Phases 1, 4, 6 |
| 9 | Usability pass (standing, does not close) | [#11](https://github.com/voltron-1/SEIM-Academy/issues/11) | F | Phase 7 |

### ✅ Ready

Unblocked, queued to start next.

| Phase | Epic | Issue | Workstream | Unblocked by |
|---|---|---|---|---|
| 2 | App shell | [#4](https://github.com/voltron-1/SEIM-Academy/issues/4) | B | Phase 1 exit gate met 2026-09-10 |

### 🔧 In Progress

_Empty — Phase 1's exit gate is met and its PR is open; Phase 2 opens on merge._

### 🏁 Done

| Phase | Epic | Issue | Milestone | Closed | Evidence |
|---|---|---|---|---|---|
| 0 | Content audit | [#2](https://github.com/voltron-1/SEIM-Academy/issues/2) | Phase 0 — Content audit (closed) | 2026-09-06 | [audit](findings/20260904-phase0-content-audit.md) · [cross-check](findings/20260906-phase0-external-crosscheck.md) |
| 1 | Schema & pipeline | [#3](https://github.com/voltron-1/SEIM-Academy/issues/3) | Phase 1 — Schema & pipeline | 2026-09-10 (PR [#110](https://github.com/voltron-1/SEIM-Academy/pull/110) open) | [remediation](findings/20260910-phase1-remediation.md) · [security](findings/20260910-phase1-security-audit.md) · [code review](findings/20260910-phase1-code-review.md) · [tests](findings/20260910-phase1-test-report.md) |

---

## Next Sprint — Phase 2 (App shell) — [#4](https://github.com/voltron-1/SEIM-Academy/issues/4)

Opens when PR [#110](https://github.com/voltron-1/SEIM-Academy/pull/110) merges. Task-level
cards live in `execution.md` § Phase 2 and are pulled in here when the sprint starts.

**Phase 1 closed 2026-09-10.** All exit-gate clauses met; the scoping clause was
demonstrably *not* met as first built and was fixed before the PR
([remediation](findings/20260910-phase1-remediation.md)). Five commands reproduce the gate:
`build-content.mjs --prune`, `validate-content.mjs`, `check-prereqs.mjs`,
`test-pipeline.mjs`, `verify-against-source.py`.

**Carried into Phase 2 as a constraint, not a task:** `app-data-schema.md` §7 makes the
renderer's raw-HTML obligation normative. Content comes from a third-party source repo;
the build-time markup check is a backstop, not a substitute for a renderer that cannot be
made to execute markup. `innerHTML`, `dangerouslySetInnerHTML` and a permissive Markdown
parser are out of contract.

**Open question for Phase 4, surfaced by Phase 1:** the pilot module generated 64 lessons
(~6 hours) from 449 source rows. Faithful, but whether Module 3 should be scoped down is a
curriculum decision, not a pipeline change.

---

## Decisions board

Open Decisions are tracked separately since they're gates, not build work — mixing them
into the phase board would hide which one is actually blocking something.

| Decision | Status | Column |
|---|---|---|
| 3 — License (GPL-3.0 vs AGPL-3.0) | Resolved 2026-09-04 | Done |
| 4 — Phase 1 pilot module | Resolved 2026-09-04 | Done |
| 1 — Static hosting target | Deferred to first deploy (Phase 2+) | Backlog |
| 2 — Paid tier scope | Deferred indefinitely (v1 free/self-hosted only) | Backlog |
| 5 — Accommodation scope beyond WCAG 2.1 AA | Deferred to Phase 9+ backlog | Backlog |
| A — Tier 1 Module 8 → full PICERL lifecycle | Resolved 2026-09-06 (approved) | Done |
| B — Lab generators as labeled exercise data (parse-only) | Resolved 2026-09-06 (approved) | Done |
| C — Replace GCIH with CySA+ as Tier 2 alignment target | Resolved 2026-09-06 (approved) | Done |
| D — State Security+ coverage precisely (SecOps domain) | Resolved 2026-09-06 (approved) | Done |

---

## Icebox (stretch scope)

Not scheduled, not launch-blocking, layered onto Workstream C components once they exist
(`IMPLEMENTATION-PLAN.md` §3):

- [ ] Differentiator 1 — Detection Coverage Sandbox
- [ ] Differentiator 2 — adaptive weak-spot engine (Phase 7 stretch)
- [ ] Differentiator 3 — redacted-production-signature reconstruction
- [ ] Differentiator 4 — auto-generated portfolio artifact export from capstones
- [ ] Differentiator 5 — Alert Fatigue mode (layers onto timed-mode consent gate)

---

## Wiring this to a live GitHub Projects board (optional)

This file is the git-tracked source; nothing here requires GitHub Issues to work, but the
epic-level issues now exist ([#2](https://github.com/voltron-1/SEIM-Academy/issues/2)–[#11](https://github.com/voltron-1/SEIM-Academy/issues/11), one per phase, title `Phase N — <name>`,
body = that phase's checklist from `execution.md`; checkboxes render as sub-tasks GitHub
tracks automatically).

**Every epic issue carries a matching milestone** (`Phase N — <name>`), assigned
2026-09-06. This is not cosmetic: an unmilestoned open issue is invisible to
`planned_execution.md` and rots until someone audits the tracker by hand. Any follow-up
issue gets its milestone assigned *in the same action that creates it* — never filed
first and milestoned later. The Phase 0 milestone is closed alongside [#2](https://github.com/voltron-1/SEIM-Academy/issues/2).

Note that **Decisions A–D were deliberately not filed as issues.** They are approved
scope changes whose work folds into the Phase 1 and Phase 4 epics; four issues closed by
the same commits would be tracker noise. They are recorded on the Decisions board above
and in `planned_execution.md` § Resolved decisions.

If you'd rather have an interactive drag-and-drop board:

1. Repo → **Projects** tab → **New project** → **Board** layout. This gives you a
   built-in `Status` field (Todo / In Progress / Done) for free — no custom field setup
   needed for a first pass.
2. Add issues [#2](https://github.com/voltron-1/SEIM-Academy/issues/2)–[#11](https://github.com/voltron-1/SEIM-Academy/issues/11) to the project and set each one's `Status` to match its column
   above (#2 → Done/closed, #3 → In Progress, #4–#11 → Backlog/Todo).
3. Optionally add a single-select `Workstream` field (A–F, matching
   `IMPLEMENTATION-PLAN.md` §3) if you want to filter/group the board by workstream
   instead of just phase.

As phase status changes, keep this file, `execution.md`, and each issue's checkboxes in
sync — update `execution.md` first, then re-derive this file and check off the matching
issue items.
