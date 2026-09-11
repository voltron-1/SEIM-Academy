# SEIMAcademy — content pipeline

Phase 1 deliverable. Turns the source knowledge base into normalized lesson atoms.

## Prerequisites

Node 20+. No dependencies — nothing to `npm install`.

The source knowledge base ([`TonyPhipps/SIEM`](https://github.com/TonyPhipps/SIEM), GPL-3.0)
is **not vendored here**. Clone it alongside this repo, or point the pipeline at it:

```bash
node SEIMAcademy/scripts/build-content.mjs --source=/path/to/SIEM
# or: export SEIM_SOURCE_REPO=/path/to/SIEM
# default: ../SIEM
```

## Commands

| Command | What it does |
|---|---|
| `node SEIMAcademy/scripts/build-content.mjs` | Generate `content/lessons/*.json` + `content/exercise-data/*.json` |
| `… --dry-run` | Report what would change, write nothing |
| `… --prune` | Also delete artifacts no longer produced (never deletes without this flag) |
| `… --out=<dir> --manifest=<file>` | Build into a sandbox — used by the test harness |
| `node SEIMAcademy/scripts/validate-content.mjs` | Enforce every rule in `app-data-schema.md` |
| `… --out=<dir>` | Validate a sandbox build instead of the working tree |
| `node SEIMAcademy/scripts/check-prereqs.mjs` | Fast pre-commit gate: `requires` ⊆ `teaches`, instructions before exercises |
| `node SEIMAcademy/scripts/test-pipeline.mjs` | Prove idempotency, scoped regeneration, orphan detection, parse-only |
| `python3 SEIMAcademy/scripts/verify-against-source.py` | Check generated content is *true* to the source, using an independent parser |

Install the prerequisite gate as a hook:

```bash
printf '#!/bin/sh\nnode SEIMAcademy/scripts/check-prereqs.mjs\n' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

## Adding a module

Edit [`content/module-manifest.json`](content/module-manifest.json) — it is the only
hand-maintained content file. A module names its tier, its source paths, and a generator
profile. **Adding a module whose source has the same shape is a manifest edit and nothing
else.**

A genuinely new source shape needs a new generator profile:

```
scripts/lib/profiles/<name>.mjs   the new profile
scripts/lib/profiles/index.mjs    one line registering it
```

A profile owns one source shape — how to parse it, and what atoms that shape can honestly
support. It declares the `exercise_data` profiles and manifest options it accepts, so
manifest validation needs no knowledge of any specific profile and `build-content.mjs`
needs no edit. Generic lesson assembly — the 180–420s budget, chunking, instructions
anatomy, multiple-choice construction, provenance stamping — comes from
`scripts/lib/lesson-kit.mjs` and is not reimplemented per profile.

Generated files are never hand-edited. Regenerate instead.

## Safety constraint

`Lab/Generate-Suspicious-Activity*.ps1` are **live telemetry generators** for a lab domain.
The pipeline reads them as text and parses their comments. It never executes them, never
shells out, and imports no execution primitive. `test-pipeline.mjs` asserts this against
the pipeline's own source, and `validate-content.mjs` rejects generated content carrying
command syntax. See `app-data-schema.md` §0.

## What is generated

Governed by [`app-data-schema.md`](app-data-schema.md) (normative) and mirrored for
machines in [`schema/app-data-schema.json`](schema/app-data-schema.json).

```
content/
├── module-manifest.json      hand-maintained
├── build-manifest.json       generated: source hashes, play order, per-artifact deps
├── lessons/*.json            generated
└── exercise-data/*.json      generated
```

Generated JSON carries no timestamps, and Markdown-derived atoms record `path` + `heading`
rather than absolute line numbers, so a re-run over unchanged sources produces byte-identical
output and an ordinary authoring edit regenerates only what depends on it. Measured on the
pilot module: a mid-document blank line regenerates **0** of 65 artifacts, and adding one row
to a channel table regenerates **3** — that channel's two lessons plus the orientation lesson,
which cites the corpus-wide Event ID count.

Lesson ids carry a content-derived suffix (`…-application-e1034`), not an ordinal. When a
source edit moves a chunk boundary the id moves with it and the old lesson appears in the
orphan report, rather than keeping its name while its contents quietly change.
