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

| Phase | Epic | Workstream | Depends on |
|---|---|---|---|
| 2 | App shell | B | Phase 1 |
| 3 | Core components | C | Phase 2 |
| 4 | Tier 1 complete | A + C | Phases 1–3 |
| 5 | Advanced components | C | Phase 3 (parallel w/ Phase 4) |
| 6 | Tier 2 complete | A + C | Phases 4–5 |
| 7 | Socratic Copilot | D | Phase 2 (parallel w/ Phase 4/6) |
| 8 | Validation / CI tie-in | E | Phases 1, 4, 6 |
| 9 | Usability pass (standing, does not close) | F | Phase 7 |

### ✅ Ready

Unblocked, queued to start next.

| Phase | Epic | Workstream | Note |
|---|---|---|---|
| 1 | Schema & pipeline | A | Decision 4 resolved 2026-09-04 (pilot = Windows Event ID triage) — unblocked |

### 🔧 In Progress

| Phase | Epic | Workstream | Owner |
|---|---|---|---|
| 0 | Content audit | F | _unassigned_ |

### 🏁 Done

_Empty — no phase has reached its exit check yet. Phase 0 is close (see Current Sprint)._

---

## Current Sprint — Phase 0 (Content audit)

Task-level cards for the one phase actively in progress, pulled directly from
`execution.md`.

**Done this session/prior:**
- [x] Enumerate every source path in the Curriculum Map into a manifest
- [x] Verify each path resolves in the source repo
- [x] Spot-check heading/list structure across a spread of `Tactics/*.md` files
- [x] Write up curriculum gaps found
- [x] Commit the finalized curriculum map
- [x] Resolve Open Decision 4 (pilot module → Windows Event ID triage)

**To Do (blocks Phase 0 exit check):**
- [ ] Cross-check the module list against 5–10 current real Tier 1/Tier 2 SOC analyst job postings
- [ ] Cross-check the module list against Security+ and GCIH exam objectives

**Exit check:** finalized curriculum map is committed and every listed source path has
been verified to exist. *(Map + path verification: done. Cross-checks: outstanding — the
only thing keeping this card out of Done.)*

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

This file is the git-tracked source; nothing here requires GitHub Issues to work. If
you'd rather have an interactive drag-and-drop board:

1. Repo → **Projects** tab → **New project** → **Board** layout. This gives you a
   built-in `Status` field (Todo / In Progress / Done) for free — no custom field setup
   needed for a first pass.
2. File one GitHub Issue per epic-level card above (title `Phase N — <name>`, body =
   that phase's checklist from `execution.md`), and add each to the project. Issue
   checkboxes render as sub-tasks GitHub tracks automatically.
3. Optionally add a single-select `Workstream` field (A–F, matching
   `IMPLEMENTATION-PLAN.md` §3) if you want to filter/group the board by workstream
   instead of just phase.

Ask if you want these issues filed — that's a repo-visible action (creates 10 public
issues) so it's worth an explicit go-ahead rather than doing it silently alongside a doc
commit.
