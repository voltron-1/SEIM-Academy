# Phase 1 — security audit of the content pipeline

**Date:** 2026-09-10 · **Auditor:** `security-auditor` sub-agent (read-only), findings
persisted and triaged by the main session · **Scope:** the Phase 1 pipeline changeset.

> The audit agent had no write tool; its output is reproduced here in full. Triage lines
> marked **[main session]** are verification or scoping added afterwards, not the auditor's.

## Counts

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 2 |
| MEDIUM | 8 |
| LOW | 9 |
| INFO | 5 |

**Headline:** Decision B holds — parse-only verified in code, not comments. No
`child_process` / `vm` / `eval` / `new Function` / dynamic `import()` anywhere in
`build-content.mjs` or `lib/*.mjs`. The only `spawnSync` is `test-pipeline.mjs:33`
invoking `process.execPath` with an argv array — no shell, no PowerShell.

**Most important:** source text reaches rendered strings with no escaping and no
Markdown-subset enforcement, while `app-data-schema.md` §7 asserts the constraint
normatively. A stored-XSS channel pre-staged for the Phase 2 renderer.

## Scope checked

Read in full: `scripts/build-content.mjs`, `validate-content.mjs`, `check-prereqs.mjs`,
`test-pipeline.mjs`, `lib/{sources,markdown,ps1-labels,tags,atoms}.mjs`,
`schema/app-data-schema.json`, `content/module-manifest.json`, and §0/§4/§5/§6/§7/§8/§9 of
`app-data-schema.md`. Repo grepped for execution primitives, schema consumers, CI config,
and HTML-significant characters in emitted JSON.

Out of scope / not executed: the source repo's contents, the Phase 2 app (does not exist),
and runtime timing. **All ReDoS findings are static analysis** and were not measured.

---

## HIGH

### 1. Source-derived text reaches rendered strings with no escaping or Markdown-subset enforcement
*T1059.007, T1195.001*

`cleanCell` (`lib/markdown.mjs:141-146`) collapses whitespace and strips wrapping backticks;
`makeAtom` (`lib/atoms.mjs:66`) only trims. Table cells and `##` headings land byte-for-byte
in `body`, `title`, `payload.front/back`, `payload.rows[].description`, quiz
`question`/`rationale`, match `pairs[].right` and drag-classify labels. `build-content.mjs`
also interpolates headings inside `**${section.heading}**`, so a heading containing
`</b><script>` breaks the surrounding Markdown construct.

The channel is already open: `t1-m03-forensics-microsoft-windows-terminalservices-localsessionmanager-operational-p1.json`
carries `"back": "Session <X> has been disconnected by session <Y>"`, and
`t1-m03-forensics-smaller-channels-p3.json` carries `"<SessionEnv>"`. A Phase 2 renderer
using `marked` defaults, `innerHTML`, or `dangerouslySetInnerHTML` executes whatever is there.

The only content filter, `no-executable-content` (`validate-content.mjs:29`), looks for
PowerShell verbs — not `<`, `>`, `javascript:`, `on*=` or `data:` — and only runs on atoms
whose `source.path` ends in `.ps1`, so every Markdown-derived string is unchecked.

**Recommendation:** enforce a content-safety rule in both `makeAtom` and
`validate-content.mjs`; state the renderer's raw-HTML obligation in §7.

> **[main session] Verified and re-scoped.** Grepped all 64 generated lessons: the only raw
> angle brackets are the benign placeholders `<X>`, `<Y>`, `<Z>`, `<SessionEnv>` — **zero**
> real HTML tags, `javascript:`, `data:text/html`, or `on*=` handlers today. So this is a
> missing control over a pre-staged channel, not a live break. It also means a blanket
> `/<[a-zA-Z]/` reject would fail the build on legitimate corpus data. The fix must be a
> targeted tag/scheme/handler denylist that lets `<X>` through and stops `<script>`.

### 2. §7 "Markdown subset" and §6.10 `no-executable-content` are asserted but enforced by no code path

`app-data-schema.md:313-319` states renderers implement exactly the listed subset and that
`body` carries no HTML; `:305-309` describes rejecting command syntax "outside a fenced code
block that is explicitly marked `source_quote: true`". There is no `source_quote` field in
the JSON Schema, the validator, or the builder — grep returns zero hits. Nothing checks that
`body` conforms to the subset. The JSON Schema mirror types `body` as `{"type":"string"}` and
`payload` as `{"type":"object"}` (`schema/app-data-schema.json:61,70`) — no length, no
pattern, no per-type payload shape.

**Recommendation:** implement the checks, or amend §6.10/§7 to say plainly "renderer
obligation, not validated by the pipeline", so Phase 2 is not built on a false premise. Add a
hostile-heading fixture to `test-pipeline.mjs`.

---

## MEDIUM

### 3. Output paths have no containment check
*T1565.001*

`safeJoin()` guards every read; nothing guards any write. `build-content.mjs:59` resolves
`--out=`/`--manifest=` with no root check, and `:145` builds the artifact filename directly
from `module.id`, which is never validated (`main()` checks only `module.profile`). A
manifest with `"id": "../../../../home/tjlam/.config/systemd/user/x"` makes the write path
resolve outside the repo, and the code then calls `mkdirSync(..., {recursive:true})` +
`writeFileSync` — arbitrary directory creation and attacker-chosen JSON at an arbitrary path.
The validator's id-grammar checks fire *after* the write and never see a file outside
`CONTENT_DIR`.

**Recommendation:** validate `module.id` and `src.corpus` against strict grammars; assert
every write target resolves inside `CONTENT_DIR`.

### 4. `readGitHead()` path traversal — a hostile source repo leaks 7 bytes of an arbitrary file into committed provenance
*T1005*

`lib/sources.mjs:75` takes the ref name straight out of the untrusted repo's `.git/HEAD`:
`const ref = head.slice(4).trim(); const loose = path.join(root, '.git', ref);`. `path.join`
collapses `..`, so `ref: ../../../../../home/tjlam/.ssh/id_rsa` escapes. The file is read
whole; its first 7 characters become `commit.actual` and are written into
`generated.source_commit` of **every lesson** and into `build-manifest.json` — committed and
pushed. Repeat builds give a file-existence oracle plus a 7-byte-per-file leak. Pointing at
`/dev/zero` hangs or OOMs the build. **This is the one finding triggerable purely by the
untrusted input the pipeline is designed to consume.**

**Recommendation:** require `/^refs\/[A-Za-z0-9._\/-]+$/` and no `..` before joining; route
through `safeJoin`; cap the read size; require `/^[0-9a-f]{40}$/` on the result.

### 5. `safeJoin()` is lexical only — symlinks in the source repo defeat containment
*T1005*

`lib/sources.mjs:45-49` compares resolved strings and never calls `realpathSync`. Git
preserves symlinks on clone, so a hostile fork can ship
`Lab/Generate-Suspicious-Activity.ps1` as a symlink to `~/.aws/credentials` or `/dev/zero`.
The pipeline reads the target, sha256s it into `build-manifest.json:sources` (a committed
content oracle), and feeds it to the comment parser.

**Recommendation:** `realpathSync` re-verification plus an `lstatSync` symlink reject and a
file-size cap in `readSource`.

### 6. Quadratic ReDoS in `SEPARATOR_RE`
*T1499.004*

`lib/markdown.mjs:42` — `/^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/`. The literal `-` is a member of
both surrounding classes, so a non-matching input splits a dash run in O(n²) ways. The regex
runs on every body line twice (`:85`, `:101`), so one crafted line hangs the build.

**Recommendation:** replace with a single unambiguous class; cap source line length.

### 7. Superlinear ReDoS in `HEADING_RE`
*T1499.004*

`lib/markdown.mjs:10` — `/^(#{1,6})\s+(.*?)\s*#*\s*$/`. Four quantifiers can each absorb part
of the same whitespace run. Runs on every line of every source document.

**Recommendation:** match `/^(#{1,6})\s+(.*)$/` and strip trailing `#`/whitespace with linear
`.replace()` calls.

### 8. Quadratic ReDoS in `EVENT_SPEC_RE`
*T1499.004*

`lib/ps1-labels.mjs:32-33`. The channel class contains a space and competes with the
following `\s+`; the lazy `^(.*?)\(` prefix re-runs that ambiguity per `(`. Polynomial, not
exponential — practical blast radius is "hangs on a multi-hundred-KB crafted line".
**Explicitly unconfirmed by measurement.**

**Recommendation:** skip comments over 512 characters; remove the space from the channel
character class.

### 9. The `no-executable-content` regex has drifted from both the spec and the builder

Three definitions disagree. `app-data-schema.md:307-308` lists one set;
`lib/ps1-labels.mjs:39` uses another; `validate-content.mjs:29` uses a third that drops
`Get`, requires a **double** pipe, and requires `;` to be followed by non-whitespace. So
`Get-ADUser -Filter *`, `type secrets.txt | clip` and a trailing `whoami ;` all pass
validation. This is the standing gate backstopping Decision B, and it is weaker than its own
documentation.

**Recommendation:** export one regex from `lib/ps1-labels.mjs`, import it in the validator,
delete the copy, and assert in `test-pipeline.mjs` that it matches §6.10's list.

### 10. `no-executable-content` only inspects atoms whose `source.path` ends in `.ps1`

`validate-content.mjs:181` gates the whole payload scan behind the `.ps1` check, so every
atom derived from the three Markdown corpora — all flashcards, quizzes, match exercises, and
the `lookup-drill` payload carrying whole tables including `Recommended Filter` cells
verbatim — is never scanned. The scan also covers `payload` only: `body` and `title` are
never scanned even for `.ps1`-sourced atoms.

**Recommendation:** scan every atom regardless of source extension, and include `body` and
`title`.

### 11. SRS anti-flood is self-certifying

`validate-content.mjs:272-273` reads the budget from `build-manifest.json` — the artifact the
build just wrote — and `opts.srs_card_budget` is spread unvalidated from
`module-manifest.json`. Setting it to `1e9` disables the build-time error and the validator's
re-check simultaneously. The check can never fail.

**Recommendation:** hardcode the ceiling in the validator; allow the manifest to lower but
not raise it; range-check the option in the builder.

---

## LOW

12. **`--prune` follows a symlinked output directory** (`build-content.mjs:1167-1178`) and
    records deletions nowhere — no `pruned` array in the manifest, no log line.
13. **`--out=` with an empty value targets the cwd** (`:59`, `path.resolve('')`), so a CI
    wrapper with an unset variable writes lessons into `$PWD` and, with `--prune`, deletes
    `$PWD/lessons/*.json`.
14. **`check-prereqs.mjs:40` builds a path from a manifest-supplied lesson id** with no
    grammar check — a tampered manifest makes the advertised pre-commit hook read and parse
    an arbitrary `.json` file.
15. **The pinned-commit control is advisory and prefix-only** (`lib/sources.mjs:95`):
    `"source_commit": ""` makes every tree match, and a real mismatch only warns — the build
    still exits 0.
16. **`payload` is unbounded.** §6.2's body cap is enforced; `payload` passes through
    untouched and the `lookup-drill` payload embeds every source row verbatim.
17. **Heading slug collisions silently overwrite a lesson.** `Security (DC)`, `Security-DC`
    and `Security/DC` all slug to `security-dc`; the second `writeFileSync` wins,
    `Object.fromEntries` collapses the duplicate manifest entry, and validation passes.
18. **`module.options` is spread from the manifest with no type or range validation**
    (`:110`). `module-manifest.json` — the sole hand-maintained input — is entirely
    unvalidated.
19. **`generatorHash()` derives a path from `URL.pathname`** (`:43`), so a checkout under a
    directory containing a space yields `%20` and ENOENT. `lib/sources.mjs:19` does this
    correctly with `fileURLToPath`. The hash also omits `validate-content.mjs` and
    `check-prereqs.mjs`.
20. **The parse-only regression test is a comment-stripped substring grep** that excludes
    itself (`test-pipeline.mjs:138-145`). Evadable by `import('node:child'+'_process')` or
    `constructor.constructor`. The property genuinely holds today — this is about durability
    of the guarantee.

---

## INFO — checked and clean

21. **Prototype pollution: clean.** Every source-derived object key goes through a fixed
    `Map` (`COLUMN_ALIASES`); evidence, dedupe and counter structures are `Map`/`Set`
    throughout; `JSON.parse` is called without revivers and `Object.fromEntries` uses
    CreateDataProperty semantics. One cosmetic residue: `report.sourceHashes` is a plain `{}`
    keyed by manifest paths — a path of literally `__proto__` is a silent no-op, not
    exploitable.
22. **Heading-derived ids cannot escape `content/`.** `slug()` replaces `[^a-z0-9]+`, so `/`,
    `\`, `.` and NUL are eliminated; `../../../../etc/cron.d/x` slugs to `etc-cron-d-x`, and
    an all-punctuation heading slugs to `''` and throws in `assertTag`. **Traversal via
    headings is not possible.** The output-path risk is entirely via `module.id`/`corpus` and
    the CLI flags — finding 3.
23. **Decision B parse-only: verified in code.** Every import and call path across
    `build-content.mjs` and all five `lib/*.mjs` reviewed. Imports limited to `node:fs`,
    `node:path`, `node:crypto`, `node:url`. `.ps1` files are reached only via `readSource` →
    `readFileSync(abs,'utf8')` → `extractEventLabels`, a pure string function that discards
    every non-comment line before any other processing.
24. **The JSON Schema mirror is consumed by nothing** — no `ajv`, no `package.json`, no CI
    workflow — so doc/mirror drift is currently undetectable.
25. **`walkStrings`/`walkKeys` recurse without a depth limit**, and `validate-content.mjs:18`
    hardcodes `CONTENT_DIR`, so an `--out=<sandbox>` build is never covered by the gate meant
    to cover it.
