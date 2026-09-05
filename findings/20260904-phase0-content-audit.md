# Phase 0 — Content audit findings

**Date:** 2026-09-04
**Scope:** every source path cited in the Build Plan's Curriculum Map
**Source repo:** `TonyPhipps/SIEM` @ `4adb971` (GPL-3.0)
**Result:** all paths resolve; **one module's format is not buildable as specified**

---

## 1. Path verification — PASS

31 path specs checked, resolving to **177 files**. Zero missing, zero empty.
Seven paths required directory qualification — corrected in
[`../curriculum-map.md`](../curriculum-map.md).

The source repo's license is confirmed **GPL-3.0**, which holds up the licensing
reasoning already applied to this repo: generated Academy content derives from
GPL-3.0 docs and inherits that license regardless, so GPL-3.0 across the tree is
the consistent choice rather than an elective one.

## 2. Parsing-consistency risk — RETIRED

`IMPLEMENTATION-PLAN.md` §8 lists this as the top risk:

> Automated parsing of 58 `Tactics/*.md` files produces inconsistent atom quality
> (headings/lists don't parse uniformly across all files)

**It does not.** The corpus is close to machine-generated in its uniformity:

| Section | Files containing it |
|---|---|
| Aggregate Count, Whitelist Alert, Levenshtein Score Alert, Rolling Whitelist Alert, Shannon Entropy Score Alert, Threshold Alert | 58 / 58 |
| Blacklist Alert | 57 / 58 |
| Match Alert | 33 / 58 (optional by design) |

Only 4 files deviate at all, and every deviation is cosmetic and trivially normalized:

- `Commandline-Activity.md` — two headings are Markdown links rather than plain text
- `Process-Execution.md` — "Match **Alarm**" instead of "Match **Alert**"
- `DNS-Request.md` — one extra section, "Deviation from Baseline Alarm"
- `Log-Clearing.md` — "LogSource Examples" at H2 rather than the usual H1 "Log Source Examples"

**Consequence:** the Phase 1 parser can rely on a fixed section vocabulary. This risk
should be struck from §8 and the Phase 4 time budget reduced accordingly.

## 3. Content sparsity — NEW RISK, replaces the one above

The problem is not that the Tactics files parse badly. It is that **most of them are
empty scaffolding.**

- **28 of 58 files contain zero authored content** — a title, the boilerplate line
  `Grouped by [Detection Method](/Detection-Methods.md)`, and eleven empty headings.
- Median file: **422 bytes**. 29 of 58 are under 400 bytes.
- Total body text across all 58 files: **~47 KB (~7,800 words)** — and **45% of that
  sits in just two files** (`Commandline-Activity.md`, `Process-Execution.md`).

Per-section fill rate across the corpus:

| Section | Files with any content |
|---|---|
| Blacklist Alert | 22/58 (38%) |
| Log Source Examples | 20/57 (35%) |
| Rolling Whitelist Alert | 19/58 (33%) |
| Aggregate Count | 16/58 (28%) |
| Whitelist Alert | 16/58 (28%) |
| Threshold Alert | 14/58 (24%) |
| Levenshtein Score Alert | 8/58 (14%) |
| Shannon Entropy Score Alert | 7/58 (12%) |
| Match Alert | 4/33 (12%) |
| Possible False Positives | 3/58 (5%) |

**The 28 empty files, for the record:** DHCP-Request, Domain-Replication-Request,
File-Content, File-Deletion, File-Rename, Firmware-Modification, Group-Access,
Group-Creation, Group-Deletion, Group-Modification, Group-Rename, Instance-Creation,
Instance-Deletion, Instance-Modification, Instance-Start, Instance-Stop,
MBR-VBR-Modification, Named-Pipe-Connection, Named-Pipe-Creation, Network-File-Carving,
Network-Port-Opening, Process-Hooking, Process-Termination, Registry-Access,
Registry-Deletion, SQL-Command, USB-Device-Attached, WMI-Activity.

### Why this breaks Tier 1 Module 4 as specified

The Build Plan specifies the format as **"matching game: tactic → data source → field."**
The data-source half comes from `Log Source Examples`, which is populated in **20 of 57
files (35%)**. Two thirds of the tactics have no data source to match to. The exercise
cannot be generated at the stated scope.

This also violates an anxiety-safe design principle structurally, not just cosmetically:
an atom generated from an empty file teaches nothing, so any exercise depending on it
would fail the `requires` ⊆ `teaches` CI gate in Phase 8 — correctly. Building Module 4
as written means building content the project's own merge gate will reject.

### Reframe — APPROVED 2026-09-04

Split the module in two, both generatable from what actually exists:

1. **Tactic taxonomy (all 58 files).** The uniform heading skeleton *is* the lesson: every
   tactic is analyzed through the same eight detection methods. That teaches the Tier 1
   objective the Build Plan states for this module — "what/why, not rules" — and it is
   generatable from an empty file, because the structure carries the meaning.
2. **Worked tactic depth (the 16 substantive files).** Matching, data-source, and field
   exercises drawn only from files that have the content to support them.

**Status: approved.** `curriculum-map.md` now carries Module 4 as 4a/4b, and
`execution.md` Phase 4 is updated to match.

This keeps the module, keeps it honest, and needs no hand-authoring — preserving the
"generated, never hand-duplicated" rule. The alternative — hand-writing content for 28
files — breaks that rule and turns a 2–3 week phase into a content-authoring project.

An upstream contribution to `TonyPhipps/SIEM` filling those files is the clean long-term
fix, but it is not on this project's critical path and should not block Phase 4.

## 4. Tier 2 Module 7 (Data enrichment & lookups) — PARTIAL

`Lookups/*.csv` resolves to 3 files, but they are lopsided: `o365-principalappid.csv`
holds 306 rows while `windows-logon-type.csv` has 9 and `windows-status-code.csv` has 12.

The two small files are excellent SRS flashcard material — logon types and status codes
are exactly the memorize-this facts Tier 1 analysts need, and the Build Plan already
routes them there. The 306-row O365 app-ID table is a lookup reference, not something to
memorize; generating flashcards from it would flood the SRS queue with low-value cards.
Treat it as a "how to use a lookup table" drill, not a recall deck.

## 5. Decision 4 (pilot module) — RESOLVED 2026-09-04: confirmed as proposed

"Windows Event ID triage" is the best-supported module in the entire curriculum:

| File | Size | Table rows |
|---|---|---|
| `Logging/Notable-Event-IDs-Sigma.md` | 42 KB | 272 |
| `Logging/Notable-Event-IDs-Risk.md` | 28 KB | 204 |
| `Logging/Notable-Event-IDs-Forensics.md` | 18 KB | 136 |
| **Total** | **88 KB** | **612** |

Three dense, consistently structured Markdown tables — 612 rows of Event ID → description
pairs that generate flashcards and drag-to-classify atoms directly, with no hand-copied
answer keys. For contrast, these three files hold nearly twice the body text of all 58
Tactics files combined.

It also exercises the two pipeline capabilities everything else depends on — table parsing
and `teaches`/`requires` tag derivation — against the cleanest available input, which is
what a de-risking pilot is for.

**Resolved 2026-09-04: confirmed as the Phase 1 pilot.** Phase 1 is unblocked.

## 6. Not yet done in Phase 0

- Cross-check the module list against 5–10 current Tier 1/Tier 2 SOC job postings
- Cross-check against Security+ and GCIH exam objectives
- Decide whether any gap those surface folds into the map now or is backlogged

These need external research rather than repo inspection, and are the remaining work
before Phase 0's exit check is met.
