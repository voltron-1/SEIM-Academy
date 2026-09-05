# Curriculum Map — verified

**Phase 0 deliverable.** *(Tier 1 Module 4 reframed per audit finding 3, approved 2026-09-04. Modules 4 and 5
swapped the same day — the tactic taxonomy names eight detection methods that
`Detection-Methods.md` is what actually teaches, so alarm-algorithm vocabulary must come
first or the `requires` ⊆ `teaches` gate rejects it.)* Every source path in the Build Plan's Curriculum Map, resolved
against the source knowledge base and verified to exist and be non-empty.

- **Source repo:** [`TonyPhipps/SIEM`](https://github.com/TonyPhipps/SIEM) — GPL-3.0,
  verified at commit `4adb971`. All paths below are relative to that repo's root.
- **Audited:** 2026-09-04 · 31 path specs · **177 files** · 0 missing · 0 empty
- **Audit detail:** [`findings/20260904-phase0-content-audit.md`](findings/20260904-phase0-content-audit.md)

Viability column: **Ready** = source is dense and structured enough to generate atoms
from · **Partial** = generatable but under-supplied · **Reframe** = cannot be generated
at the format the Build Plan specifies, see findings.

## Tier 1 — Analyst I: Triage & Escalation

| # | Module | Verified source path(s) | Files | Interactive format | Viability |
|---|---|---|---|---|---|
| 1 | SOC orientation & what you're protecting | `Orientation/crown-jewels.md`, `README.md` | 2 | reading atom + quiz | Ready |
| 2 | Logging fundamentals | `Logging/Logging.md`, `Logging/Logging-Windows.md` | 2 | flashcards | Ready |
| 3 | **Windows Event ID triage** — ✅ **CONFIRMED Phase 1 pilot** | `Logging/Notable-Event-IDs-Sigma.md`, `Logging/Notable-Event-IDs-Risk.md`, `Logging/Notable-Event-IDs-Forensics.md` | 3 | SRS flashcards, drag-to-classify | **Ready** — 88 KB, 612 table rows |
| 4 | Reading an alert: alarm algorithm vocabulary | `Detection-Methods.md` | 1 | fill-in-blank + spot the algorithm | Ready |
| 5a | Tactic taxonomy — how tactics are analyzed | `Tactics/*.md` (heading skeleton) | 58 | classify: tactic → applicable detection methods | Ready — structure carries the lesson |
| 5b | Worked tactic depth | `Tactics/*.md` (16 substantive files) | 16 | matching: tactic → data source → field | Ready — scoped to files with content |
| 6 | MITRE ATT&CK mapping literacy | `Detection-Tactics.md` | 1 | drag tactic-row → ATT&CK column | Ready |
| 7 | Field kit & note-taking discipline | `field-kit.md` | 1 | checklist atom | Ready |
| 8 | Escalation basics & documentation | `Documentation-Templates/Incident-Response-Policy.md`, `Metrics.md` | 2 | scenario: triage, escalate/close | Ready |
| 9 | Investigating a user profile | `Investigating/WindowsUserProfile.md` | 1 | guided scenario, evidence board | Ready |
| 10 | Capstone 1 | mixed | — | timed-optional triage sim, 3 alerts | hand-authored |

## Tier 2 — Analyst II: Investigation & Detection Engineering

| # | Module | Verified source path(s) | Files | Interactive format | Viability |
|---|---|---|---|---|---|
| 1 | Detection method deep dive | `Detection-Methods.md` | 1 | worked-example calculators | Ready |
| 2 | Reading & writing SPL signatures | `Signatures/Splunk/*.md` (MAD pattern in `Signatures/Splunk/panorama.md`) | 10 | SPL fill-in-blank sandbox | Ready |
| 3 | Formal signature authoring | `Matrix/Signature-Structure.md` | 1 | structured-editor lesson | Ready |
| 4 | Playbook authoring & execution | `Matrix/Playbook-Structure.md`, `Playbooks/Detect-Password-Spraying-via-Windows-Events.md` | 2 | scenario: execute a playbook | Ready |
| 5 | Sigma → Splunk pipeline literacy | `sigma/adoption.md`, `sigma/pipelines/*.yml` | 7 | trace-a-rule diagram | Ready |
| 6 | Risk-Based Alerting | `Risk-Based-Alerting/Overview.md`, `Risk-Based-Alerting/Risk-Rules.md` | 2 | risk-score calculator | Ready |
| 7 | Data enrichment & lookups | `Lookups/*.csv` | 3 | lookup-table drill | **Partial** — see findings |
| 8 | Threat hunting | `Threat-Hunting.md`, `osintel.md` | 2 | hypothesis-driven scenario | Ready |
| 9 | Hardening ↔ detection cross-reference | `hardening/*.md` vs `Tactics/*.md` | 17 + 58 | matching: control → threat | Partial — inherits Tactics sparsity |
| 10 | The Detection & Compliance Matrix | `Matrix/Detection-and-Compliance-Matrix.md` | 1 | schema-literacy quiz | Ready |
| — | Interview readiness *(cross-tier SRS deck, not a module)* | `interview-questions.md` | 1 | recurring SRS deck | Ready |

## Path corrections applied

Seven paths in the Build Plan's Curriculum Map are written without a directory prefix or
as an informal description. They all resolve, but not where written — the pipeline must
use the resolved column, not the Build Plan text.

| As written in Build Plan | Actual path |
|---|---|
| `Notable-Event-IDs-Sigma.md` | `Logging/Notable-Event-IDs-Sigma.md` |
| `Notable-Event-IDs-Risk.md` | `Logging/Notable-Event-IDs-Risk.md` |
| `Notable-Event-IDs-Forensics.md` | `Logging/Notable-Event-IDs-Forensics.md` |
| `Incident-Response-Policy.md` | `Documentation-Templates/Incident-Response-Policy.md` |
| `Risk-Rules.md` | `Risk-Based-Alerting/Risk-Rules.md` |
| "MAD pattern in panorama.md" | `Signatures/Splunk/panorama.md` |
| "password-spraying playbook" | `Playbooks/Detect-Password-Spraying-via-Windows-Events.md` |
