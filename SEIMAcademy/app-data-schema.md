# `app-data-schema.md` — lesson / atom / quiz JSON schema

**Phase 1 deliverable.** Normative reference for every JSON file under
`SEIMAcademy/content/`. The machine-readable mirror is
[`schema/app-data-schema.json`](schema/app-data-schema.json) (JSON Schema 2020-12); where
the two disagree, **this document is normative** and the mirror is a bug.

- **Schema version:** `1.0.0`
- **Consumers:** `scripts/build-content.mjs` (writes), `scripts/validate-content.mjs`
  (enforces), the Phase 2 app shell (reads), the Phase 8 CI gates (re-enforces).
- **Design authority:** `BUILD-PLAN.md` § Design Principles. Every `MUST` below traces to a
  named principle; the trace is given inline so a future change can tell whether it is
  loosening a cosmetic rule or an anxiety-safe one.

---

## 0. Hard safety constraint — Lab generators are parse-only

*Decision B, approved 2026-09-06.*

`Lab/Generate-Suspicious-Activity.ps1`, `Lab/Generate-Suspicious-Activity-Sigma.ps1` and
`Lab/Generate-Suspicious-Activity-lolbins.ps1` in the source repo are **live telemetry
generators written for a throwaway lab domain**. They create users, add accounts to Domain
Admins, register services and scheduled tasks, and clear logs.

**Nothing in SEIM-Academy executes them.** The pipeline opens them as UTF-8 text, reads the
`#` comment lines, and discards the rest. It MUST NOT:

- invoke `powershell`, `pwsh`, `Start-Process`, or any shell,
- `eval` or otherwise interpret their contents,
- copy their executable statements into generated content.

Generated exercise data contains only the comment-derived `action → event` label pairs and
the file/line provenance for each. The constraint is asserted in code by
`scripts/lib/ps1-labels.mjs`, which is a pure string function over a file it reads with
`fs.readFile`, and is re-checked by `validate-content.mjs`
(§9, `no-executable-content`).

---

## 1. File layout

```
SEIMAcademy/content/
├── module-manifest.json          hand-maintained: module → sources → generator profile
├── build-manifest.json           generated: source sha256 → emitted lesson files
├── lessons/<lesson-id>.json      generated: one Lesson object per file
└── exercise-data/<set-id>.json   generated: one ExerciseDataSet per file
```

`module-manifest.json` is the **only** hand-maintained file. Adding a module in Phase 4 or 6
is an edit to that file plus, where the source shape is new, a generator profile — never a
per-module script.

---

## 2. `Lesson`

A lesson is one 3–7 minute sitting. It is the unit of regeneration: a source-file change
regenerates every lesson derived from that file and nothing else.

| Field | Type | Req | Notes |
|---|---|:--:|---|
| `schema_version` | `"1.0.0"` | ✔ | Exact string. Bump only with a migration note in §11. |
| `id` | slug | ✔ | `^t[12]-m\d{2}[a-z]?-[a-z0-9-]+$`. Stable across rebuilds. |
| `tier` | `1 \| 2` | ✔ | |
| `module` | string | ✔ | Module number as written in `curriculum-map.md` — `"3"`, `"5a"`. |
| `part` | integer ≥ 1 | | Present only when a lesson was split for the time budget. |
| `title` | string ≤ 80 | ✔ | Shown in the left rail. |
| `summary` | string ≤ 240 | ✔ | One sentence. Shown on the Today screen. |
| `estimated_seconds` | integer | ✔ | Sum of the atoms'. MUST be 180–420 (§6.1). |
| `teaches` | tag[] | ✔ | Union of the atoms' `teaches`. May be empty only for a pure-exercise lesson. |
| `requires` | tag[] | ✔ | Union of the atoms' `requires` **not** satisfied within this lesson — i.e. this lesson's external prerequisites. |
| `sources` | `Source[]` | ✔ | Deduplicated union of the atoms' `source`. |
| `generated` | `Provenance` | ✔ | §8. |
| `atoms` | `Atom[]` | ✔ | 1–24 items, ordered. Order is the play order. |

### `Source`

| Field | Type | Req | Notes |
|---|---|:--:|---|
| `path` | string | ✔ | Repo-relative to the **source** repo root, e.g. `Logging/Notable-Event-IDs-Sigma.md`. Never absolute, never `../`. |
| `heading` | string | | Section heading without the `#` marks, e.g. `Security`. Renders as `path#heading`. |
| `lines` | `[int, int]` | | 1-based inclusive line span. **Recorded only for `.ps1` sources.** |

`lines` is deliberately absent on Markdown-derived atoms. A table row is addressed by
`path` + `heading` + its Event ID — coordinates that survive an edit elsewhere in the file.
An absolute line number does not: adding one row near the top of a document shifts every
line below it, changing the serialized bytes of every downstream lesson and forcing a
rewrite of content that did not change. Measured before this rule existed: **one added row
rewrote 22 of 65 artifacts**, and a single mid-document blank line rewrote 20 — which
defeats §6.9 for every ordinary authoring edit. PowerShell comments have no heading to
anchor to and their line number is the Decision B audit trail, so they keep it; a Lab edit
already regenerates broadly by design, since those files decide SRS eligibility (§6.5).

`source` is mandatory on every atom (§3). The UI is required to be able to say "from
`/Logging/Notable-Event-IDs-Sigma.md#Security`" for anything it shows — this is a licensing
obligation under GPL-3.0 attribution as much as a learning-design one.

---

## 3. `Atom` — common fields

Every atom, regardless of type:

| Field | Type | Req | Notes |
|---|---|:--:|---|
| `id` | slug | ✔ | Unique within the corpus. Deterministic: derived from source path + heading + key, never from a counter that shifts when a row is inserted. |
| `type` | enum | ✔ | One of §4's eight. |
| `title` | string ≤ 80 | ✔ | |
| `body` | string | ✔ | Markdown subset (§7). Length-capped per type (§6.2). |
| `source` | `Source` | ✔ | §2. |
| `teaches` | tag[] | cond. | REQUIRED and non-empty on `reading`, `flashcard`, `instructions`. Forbidden elsewhere. |
| `requires` | tag[] | cond. | REQUIRED and non-empty on `exercise`. Optional on `quiz`, `scenario`, `capstone-step`. Forbidden on `predict` (§6.3). |
| `estimated_seconds` | integer 5–180 | ✔ | |
| `difficulty` | `intro \| standard \| step-up` | cond. | REQUIRED on `exercise`. `step-up` MUST be announced in the preceding `instructions` atom (§6.4). |
| `lifecycle_stage` | enum | | §5. Decision A. |
| `graded` | boolean | ✔ | `predict` atoms MUST be `false` (§6.3). |
| `srs` | `Srs` | cond. | REQUIRED on `flashcard`, forbidden elsewhere. §6.5. |
| `payload` | object | ✔ | Type-specific. §4. |

### Tag vocabulary

Tags are lowercase, `:`-namespaced, and derived by the pipeline from parsed structure —
never hand-authored, never free text.

| Namespace | Form | Derived from |
|---|---|---|
| `corpus` | `corpus:sigma` | Which of the three Notable-Event-ID docs a row came from |
| `channel` | `channel:security` | The `##` section heading, slugified |
| `event` | `event:security:4720` | `channel` + the `EventID` cell |
| `provider` | `provider:msiinstaller` | The `ProviderName` / `Provider Name` cell, when the table has one |
| `concept` | `concept:action-to-event` | A named teaching concept declared in `module-manifest.json` |
| `lifecycle` | `lifecycle:containment` | Mirrors `lifecycle_stage`, so PICERL participates in `requires`/`teaches` |

An unknown namespace is a validation error. Adding one is a schema change.

---

## 4. Atom types

Eight types. The renderer is one shared component per type (BUILD-PLAN: *predictable
structure everywhere*), so a new type is a Phase 2/3 component, not a content decision.

### 4.1 `predict`
Ungraded retrieval-first opener. `graded` MUST be `false`; no `requires`.
`payload`: `{ prompt: string, reveal: string }`.

### 4.2 `reading`
Content atom. `payload`: `{}` — the content is `body`.

### 4.3 `flashcard`
`payload`: `{ front: string, back: string }`. Requires `srs` (§6.5).

### 4.4 `quiz`
`payload`: one of
- `{ format: "multiple-choice", question, choices: string[3..6], answer_index, rationale }`
- `{ format: "fill-blank", question, blank_answer, accepted: string[], rationale }`

`choices` MUST be distinct and drawn from the same source table as the answer (a distractor
from a different channel makes the question answerable without knowing the material).
`rationale` MUST cite the row it came from — it is generated from the Description cell, not
written by hand.

### 4.5 `instructions`
Fixed anatomy, enforced by the validator, never blended into the exercise
(BUILD-PLAN anxiety-safe principle):
`payload`: `{ goal: string, what_youll_use: string, done_when: string, step_up_notice?: string }`.
All three of `goal` / `what_youll_use` / `done_when` MUST be non-empty.
`what_youll_use` MUST reference the tags the following exercise `requires`.

### 4.6 `exercise`
`payload`: one of
- `{ format: "drag-classify", items: {label, bucket}[], buckets: string[] }`
- `{ format: "lookup-drill", table_ref: string, columns: string[], rows: object[], prompts: {ask, answer}[] }`

  `rows` carries the full parsed table so the app can render the reference offline; `prompts`
  are the drilled subset. `table_ref` is `path#heading` for the deep link back to source.
- `{ format: "match", pairs: {left, right}[] }`

Every `exercise` MUST be immediately preceded by an `instructions` atom in the same lesson.
Every `exercise` MUST carry `requires` and `difficulty`.
A keyboard-operable equivalent is a Phase 3 renderer obligation, not a schema field.

### 4.7 `scenario`
`payload`: `{ setup: string, steps: {prompt, expected, evidence?}[] }`. Optional
`lifecycle_stage` per step is expressed by splitting into one atom per stage.

### 4.8 `capstone-step`
`payload`: `{ alert: string, question: string, expected: string, evidence_refs: Source[] }`.
Reserved for Capstone 1 / 2; the pilot module emits none.

---

## 5. `lifecycle_stage` — PICERL (Decision A)

*Decision A, approved 2026-09-06.* Tier 1 Module 8 expands from "escalation basics" to the
full incident lifecycle, sourced from
`Documentation-Templates/Incident-Response-Policy.md`. Escalation becomes one beat inside
Containment.

Enum, in order: `preparation`, `identification`, `containment`, `eradication`, `recovery`,
`lessons-learned`.

- Optional on every atom type. Present only where the source material is genuinely
  stage-specific — a stage tag on generic material is worse than no tag.
- When present, the pipeline MUST also emit the mirroring `lifecycle:<stage>` tag into
  `teaches` (content atoms) or `requires` (exercise atoms), so PICERL ordering is enforced
  by the same §6.6 check as everything else rather than by a second mechanism.
- The pilot module emits none. The field exists now because retrofitting a field into
  generated content after Phase 4 has run means regenerating and re-reviewing every lesson.

---

## 6. Invariants

The validator (`scripts/validate-content.mjs`) enforces all of these. Each is a named check
so a failure points at a rule, not a line number.

### 6.1 `lesson-time-budget`
`estimated_seconds` MUST equal the sum of the atoms' and MUST be within **180–420 s**.
*Traces to: atomic sessions, not chapters.* A lesson over budget is split into `part`s by
the pipeline; the pipeline never truncates content to fit.

### 6.2 `atom-body-cap`
Per-type maximum `body` length, in characters:

| Type | Cap | Rationale |
|---|--:|---|
| `predict` | 400 | One question, one screen |
| `reading` | 900 | ~150 words — the ceiling for one screen without scroll on a phone |
| `flashcard` | 300 | Front + back are in `payload`; `body` is context only |
| `quiz` | 500 | |
| `instructions` | 600 | Anatomy lives in `payload`; `body` is optional framing |
| `exercise` | 500 | |
| `scenario` | 900 | |
| `capstone-step` | 900 | |

*Traces to: one atom per screen; no infinite-scroll lesson pages.* The cap is on the
generated artifact, so an over-long source section fails the build rather than silently
producing a wall of text.

`payload` has its own ceiling of **64 KB** serialized (`payload-cap`). The body cap does not
constrain it, and the `lookup-drill` payload embeds a whole source table — without a
separate cap a large or hostile table produces one lesson the app must load whole.

### 6.3 `predict-never-graded`
`predict` atoms MUST have `graded: false` and MUST NOT carry `requires`.
*Traces to: retrieval-first, not review-first — the opener is a guess, and a guess that can
be wrong must cost nothing.*

### 6.4 `instructions-precede-exercise`
For every `exercise` atom at index *i*, `atoms[i-1].type` MUST be `instructions`.
If the exercise's `difficulty` is `step-up`, the preceding instructions atom MUST have a
non-empty `step_up_notice`.
*Traces to: every exercise is preceded by a dedicated Instructions atom; difficulty ramps
are visible and gradual, never a cliff.*

### 6.5 `srs-anti-flood`
`flashcard.srs` is `{ eligible: boolean, deck: string, reason: string }`.

Two independent mechanisms, one per concern.

**Lesson shape** decides whether cards are generated at all. A section with more than
`lookup_table_rows` (**default 120**) data rows is a reference table by nature: it emits
`reading` atoms plus one `lookup-drill` exercise carrying the whole table in its payload,
and **no flashcards**. A reference-sized table therefore cannot produce a recall deck by
construction — there is no eligibility rule left to get wrong. A section below
`min_section_rows` (**default 4**) is swept into a per-corpus "smaller channels" lesson
rather than getting one of its own.

**SRS eligibility** decides which of the cards that *were* generated enter the
spaced-repetition scheduler. `eligible` is `true` iff the Event ID appears in the module's
**evidence set** — the ground-truth `action → event` pairs parsed from the Lab generators
(§9, Decision B) — and no earlier card already covers it. `reason` records which branch
fired: `evidence-set`, `not-in-evidence-set`, or `duplicate-event`.

Evidence lookup tolerates a source table that names a channel more precisely than the
generator comment does: a pair labelled `(Security 4741 on DC)` matches the
`Security (Domain Controller Specific)` section. The *matched* channel is the dedupe key,
so an Event ID filed under both headings yields one card, not two.

A module MUST NOT emit more than `srs_card_budget` (**default 80**) eligible cards.
Exceeding it is a **build error**, not a truncation — a silently trimmed deck is a content
bug that surfaces months later as a gap in a learner's review queue.

An ineligible flashcard is still a real atom: it plays in the lesson queue as a front/back
reveal, it just never enters the spaced-repetition scheduler. Eligibility is what keeps the
pilot module's 448 source rows from becoming 448 recall cards — it yields 36. The events
with ground-truth evidence are exactly the ones this module's exercises test, so they are
the ones the review queue should protect; everything else stays available as reference.

*Traces to: the `Lookups/o365-principalappid.csv` finding (306 rows vs 9 and 12) in
`IMPLEMENTATION-PLAN.md` § 8. Encoded here so the pipeline cannot generate a recall deck
from a reference-sized table by default, in any module, without an explicit override.*

### 6.6 `requires-subset-of-teaches`
For every atom, every tag in `requires` MUST appear in the `teaches` of some atom that
**precedes** it — within the same lesson, or in a lesson earlier in the same module's play
order, or in a module earlier in the same tier.
*Traces to: no exercise may require knowledge that wasn't explicitly taught first — the
single biggest anxiety source in training software.* This is the check
`scripts/check-prereqs.mjs` runs locally ahead of the full Phase 8 CI gate.

### 6.7 `source-required`
Every atom MUST carry a resolvable `source.path`. Paths are repo-relative, contain no `..`
segment, and MUST resolve to a real file in the pinned source commit.

### 6.8 `deterministic-ids`
Atom and lesson `id`s MUST be derived from stable source coordinates (path, heading, event
ID), never from array position. Inserting a row into a source table MUST NOT renumber the
atoms after it — an ID change silently resets that card's SRS history for every learner.

**This binds lesson ids too.** A channel with more rows than fit one sitting is split into
parts, and chunk boundaries necessarily move when rows are added or removed. The part
suffix is therefore derived from the **first row of the chunk** (`…-e4624`), not from its
ordinal (`…-p2`): when membership shifts, the id shifts with it and the old lesson appears
in the orphan report. An id that keeps its name while its contents change is worse than one
that is visibly renamed, because nothing flags it — a single-build validator cannot detect
"same id, different meaning" across two runs. `part` remains the human-facing ordinal.

### 6.9 `no-timestamps`
Generated JSON MUST NOT contain a build timestamp or any other value that varies between
runs over unchanged input. *Traces to: the Phase 1 exit gate — idempotency is checked by
byte-comparison, which a timestamp defeats.*

### 6.10 `no-executable-content` and `markdown-subset`
Two tiers, because the two source kinds warrant different strictness.

**Tier 1 — every generated string, whatever produced it.** Applied to `title`, `body` and
every string in `payload`:

- `markdown-subset` rejects markup that would execute or navigate in a renderer: real HTML
  tags (`script`, `iframe`, `img`, `a`, `svg`, `style`, `form`, …), inline `on*=` event
  handlers, `javascript:` / `vbscript:` / `data:` URIs, and numeric HTML entities used to
  smuggle them. It is a **targeted denylist, not a ban on `<`** — the source corpus contains
  legitimate placeholders such as `Session <X> has been disconnected by session <Y>` and
  `<SessionEnv>`, and rejecting those would fail the build on real, harmless content.
- `no-executable-content` rejects shell/PowerShell command syntax: verb-noun cmdlets
  (`Invoke-WebRequest`, `New-LocalUser`, …), `$(`, `${`, and template-injection markers.
  Bare `;` and `|` are **not** rejected at this tier — they are ordinary punctuation in an
  Event ID description (`Connection failed; bad username or password`). Calibrated against
  all 3,948 generated strings: zero false positives.

**Tier 2 — strings derived from a `.ps1` source.** The strict rule, `EXECUTABLE_HINT_RE`,
which does reject bare `;` and `|`. It is **exported from `scripts/lib/ps1-labels.mjs` and
imported by the validator**, so the extractor and the gate cannot drift apart — three
separately maintained copies of this regex is how a safety gate ends up weaker than its own
documentation.

*Traces to: §0.* Tier 1 is defence in depth. The primary control is the renderer — see §7.

### 6.11 `closed-schema`
Lessons, atoms, sources, `srs`, `generated`, exercise sets, pairs and each payload shape
have a **closed** set of permitted keys. An unrecognized key is a failure, not something to
ignore.

*Traces to: heuristics only catch the shapes you thought of.* A `no-timestamps` check that
looks for ISO datetimes misses a bare `2026-09-10` under a `reviewed` key and a numeric
epoch under a `seq` key entirely — both were demonstrated to pass validation before this
rule existed. Rejecting unknown keys catches the whole class instead of the instances.

## 7. Markdown subset permitted in `body`

Renderers implement exactly this and nothing else, so an atom cannot smuggle in layout:

`**bold**`, `` `code` ``, fenced code blocks, unordered lists, `[text](path)` links to
repo-relative source paths only. **No** headings, images, HTML, or tables inside `body` —
tabular content is a `lookup-drill` exercise or a `payload`, never prose.

**Renderer obligation (normative, Phase 2).** The renderer MUST parse `body` with raw HTML
**disabled**, and MUST treat every `payload` string as text rather than markup. Content
flows from a third-party source repository; §6.10's `markdown-subset` check is a build-time
backstop against what that repo might contain, not a substitute for a renderer that cannot
be made to execute markup in the first place. `innerHTML`, `dangerouslySetInnerHTML`, and a
Markdown parser left on its permissive defaults are all out of contract.

---

## 8. `Provenance` (`generated`)

| Field | Type | Notes |
|---|---|---|
| `generator` | string | `"build-content"` |
| `generator_version` | semver | Bumped when output shape changes. |
| `source_repo` | string | `"TonyPhipps/SIEM"` |
| `source_commit` | string | Pinned commit the content was generated from. |
| `source_license` | string | `"GPL-3.0"` |
| `profile` | string | Generator profile that produced this lesson, e.g. `event-id-tables`. |
| `content_hash` | string | sha256 of the emitted atoms array, for scoped-regeneration checks. |

No timestamp — see §6.9.

---

## 9. `ExerciseDataSet` — `content/exercise-data/<set-id>.json`

Ground-truth data too large or too cross-cutting to inline in one lesson. The pilot module
emits one, from the Lab generators (Decision B).

| Field | Type | Notes |
|---|---|---|
| `schema_version` | `"1.0.0"` | |
| `id` | slug | |
| `kind` | `"action-event-pairs"` | Only kind defined at 1.0.0. |
| `parse_only` | `true` | MUST be literal `true`. Asserts §0 in the artifact itself. |
| `pairs` | `Pair[]` | |
| `generated` | `Provenance` | |

`Pair`: `{ action: string, channel: string, event_ids: integer[], scope?: "dc" \| "target-system", source: Source }`.

`action` is the comment's human label with the parenthesised event spec removed
(`# Create Local User (Security 4720)` → `Create Local User`). `source.lines` records the
exact comment line, so any pair can be audited back to its origin in one click.

A generator file that yields zero pairs is **not** an error — `-lolbins.ps1` labels its
blocks with ATT&CK technique IDs (`# Bitsadmin.exe T1105`) rather than Event IDs, and
correctly produces nothing here.

---

## 10. `module-manifest.json`

The one hand-maintained content file. It is **validated before any of it is used**: its
values become output filenames and safety budgets, so `id`, `tier`, `module`, `profile`,
each `sources[].corpus`, each `exercise_data[].profile`, and every `options` key are
range- and grammar-checked, unknown options are rejected, and the `modules` array must be
in play order (§6.6 accumulates `teaches` in that order and would otherwise enforce a
fiction). `options.srs_card_budget` may lower the §6.5 ceiling of 80, never raise it.

**`confirmed_cells`** records a human's ruling on an ambiguous source cell. Some EventID
cells mix separators — `8 15, 16, 33` — where one reading is four Event IDs and another is
a typo that would make `Event ID 8` a fabricated card. The pipeline cannot tell, so it
warns once and a person decides; the answer lives here, keyed by `path` + `heading` +
`cell` (never a line number, which shifts). A confirmed cell downgrades to a note. If the
recorded `event_ids` disagree with what the parser produces, that is a **build error**, not
a preference — one of the two is wrong and shipping either would be guessing.

```jsonc
{
  "schema_version": "1.0.0",
  "source_repo": "TonyPhipps/SIEM",
  "source_commit": "4adb971",
  "source_license": "GPL-3.0",
  "modules": [
    {
      "id": "t1-m03",
      "tier": 1,
      "module": "3",
      "title": "Windows Event ID triage",
      "profile": "event-id-tables",
      "concepts": ["concept:action-to-event", "concept:corpus-purpose"],
      "options": { "lookup_table_rows": 120, "srs_card_budget": 80, "min_section_rows": 4 },
      "sources": [
        { "path": "Logging/Notable-Event-IDs-Sigma.md",     "corpus": "sigma" },
        { "path": "Logging/Notable-Event-IDs-Risk.md",      "corpus": "risk" },
        { "path": "Logging/Notable-Event-IDs-Forensics.md", "corpus": "forensics" }
      ],
      "exercise_data": [
        { "path": "Lab/Generate-Suspicious-Activity.ps1",         "profile": "ps1-event-labels" },
        { "path": "Lab/Generate-Suspicious-Activity-Sigma.ps1",   "profile": "ps1-event-labels" },
        { "path": "Lab/Generate-Suspicious-Activity-lolbins.ps1", "profile": "ps1-event-labels" }
      ]
    }
  ]
}
```

---

## 11. Versioning

`schema_version` is semver on the *content contract*.

- **Patch** — clarification only; no producer or consumer change.
- **Minor** — additive optional field. Consumers written against the previous minor keep working.
- **Major** — a removed or narrowed field. Requires a migration note here and a full rebuild
  of `content/`, because generated files are not hand-edited and are cheap to regenerate.

**1.0.0** — initial. Includes `lifecycle_stage` (Decision A) and the `parse_only` /
`no-executable-content` constraints (Decision B) from the first version deliberately: both
were approved before this document was drafted, and adding either later would mean
regenerating and re-reviewing every lesson produced in the meantime.
