# Phase 1 — Schema & pipeline (implementation plan)

**Date:** 2026-09-10 · **Issue:** [#3](https://github.com/voltron-1/SEIM-Academy/issues/3) ·
**Milestone:** Phase 1 — Schema & pipeline
**Exit gate:** pipeline runs against the pilot module end-to-end; output validates against
the schema; regeneration is correctly scoped to changed files only.

## Inputs (verified 2026-09-10)

- Source repo: `/home/tjlam/projects/SIEM` @ `4adb971` (`TonyPhipps/SIEM`, GPL-3.0).
- Pilot module: Tier 1 Module 3 — Windows Event ID triage.
  - `Logging/Notable-Event-IDs-Sigma.md` — 39 `##` sections, 196 data rows
  - `Logging/Notable-Event-IDs-Risk.md` — 22 sections, 157 rows
  - `Logging/Notable-Event-IDs-Forensics.md` — 25 sections, 90 rows
  - Total 443 rows / 86 channel sections.
- Decision B input: `Lab/Generate-Suspicious-Activity.ps1` (30 labeled blocks),
  `Lab/Generate-Suspicious-Activity-Sigma.ps1` (25), `-lolbins.ps1` (0 Event-ID labels —
  ATT&CK-technique labels only, yields no pairs and that is the correct outcome).

Observed table header variants (parser must be header-driven, not positional):
`EventID | Description` (57), `EventID | Description | Filter` (23),
`EventID | ProviderName | Description` (1), `EventID | Provider Name | Description | Filter` (1),
`EventID | Description | Recommended Filter` (1).

## Runtime decision

**Node 20, plain ESM, zero dependencies.** One toolchain with the Phase 2 TS SPA; no
`node_modules` to vendor or audit in a security repo; hand-rolled validator enforces the
schema doc's invariants and a JSON Schema 2020-12 mirror is emitted for Phase 8 CI (ajv).

## Deliverables

```
SEIMAcademy/
├── app-data-schema.md               normative schema doc
├── schema/app-data-schema.json      machine-readable mirror (JSON Schema 2020-12)
├── content/module-manifest.json     declarative module -> sources -> profile
├── content/lessons/*.json           generated
├── content/exercise-data/*.json     generated (Decision B lab pairs)
├── content/build-manifest.json      per-source sha256 + emitted-file map
└── scripts/
    ├── build-content.mjs            pipeline entry
    ├── validate-content.mjs         schema + invariant validation
    ├── check-prereqs.mjs            requires <= teaches pre-commit stub
    └── lib/{markdown,ps1-labels,tags,atoms,sources}.mjs
```

## Structural constraints the schema must enforce (from BUILD-PLAN Design Principles)

1. Lesson fits 3-7 min -> `estimated_seconds` per atom, lesson total 180-420s (hard max).
2. Module's opening atom is a `predict` atom, never graded.
3. Every `exercise` atom is immediately preceded by an `instructions` atom.
4. Exercise atoms carry a `difficulty` tag surfaced in the instructions atom.
5. `requires` on any atom must be covered by `teaches` on a *preceding* atom (same module).
6. Per-atom body-length cap.
7. `lifecycle_stage` PICERL field (Decision A).
8. SRS anti-flood: a table over `srs_table_max_rows` (25) emits `reference` atoms plus a
   lookup drill, never SRS cards; module-level `srs_card_budget` is a hard build error.
9. Decision B parse-only constraint stated in the schema doc *and* the script.

## Decomposition rule (deterministic, generalizes to Phases 4/6)

Per pilot module: 1 orientation lesson (corpus: Sigma vs Risk vs Forensics) + one lesson
per (corpus, channel) section meeting a minimum row count, small sections merged into a
per-corpus "smaller channels" lesson, + 1 lab `action -> event` exercise lesson.
Lessons split into numbered parts when the 420s budget is exceeded.

## Idempotency

Generated JSON contains **no timestamps**. Re-running with unchanged sources produces
byte-identical output. `build-manifest.json` records each source's sha256; a source whose
hash is unchanged short-circuits regeneration of the lessons derived from it.

## Order of work

1. `app-data-schema.md` + `schema/app-data-schema.json` + `module-manifest.json`
2. `lib/` parsers (markdown tables, ps1 labels)
3. `build-content.mjs` -> generate
4. `validate-content.mjs` + `check-prereqs.mjs` -> validate
5. Idempotency + scoped-regeneration proof
6. Delegated review (security-auditor, code-reviewer, tester-debugger in parallel)
7. **STOP at exit gate** — no commit, no push, until approved.
