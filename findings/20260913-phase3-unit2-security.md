# Phase 3 Unit 2 — security audit (Flashcard + SRS)

**Date:** 2026-09-13 · **Branch:** `claude/phase3-unit2-flashcard-srs` vs `main` ·
**Issue:** [#35](https://github.com/voltron-1/SEIM-Academy/issues/35) ·
**Agent:** `security-auditor` (read-only; findings persisted by the main session)

> **Resolution (2026-09-13, same session):** every Must-Fix, Medium and Low finding below was
> fixed on `claude/phase3-unit2-flashcard-srs` before commit, each with a regression test that
> was watched failing first. Deferred with reasons: the app-wide error boundary and the CSP
> (both pre-existing and larger than this unit), and deck-size/`teaches` caps in `migrate()`
> (the window-bounded scan removes the practical cost, so the caps buy little).



**Verdict: 0 critical, 0 high, 4 medium, 3 low.** No remotely exploitable vulnerability.
This is a no-auth, no-backend, client-only PWA, so every finding below requires the attacker
to already hold the browser profile, devtools, or the content repo. They are integrity and
availability defects with a security shape.

**Clean, with the check stated:** no XSS sink introduced; `@testing-library/user-event`
confirmed dev-only; no secrets, PII, or telemetry.

The through-line: **`migrate()`'s new `srsCards` validation is materially weaker than the
`completedByDay` validation three lines above it in the same function.** Findings 1, 2, 3
and 5 are all that one gap.

---

## MEDIUM — `__proto__` as a card key mutates the deck map instead of being rejected

`persistence.ts:100,114`

```
for (const [atomId, value] of Object.entries(candidate.srsCards)) {
...
      srsCards[atomId] = {
```

`JSON.parse` makes `__proto__` a real own property, so `Object.entries` yields it, and the
bracket assignment is a `[[Set]]` that finds the `Object.prototype.__proto__` accessor and
re-points the prototype of the local `srsCards` map. Not global prototype pollution — the
receiver is the local object — but the entry becomes invisible to `Object.keys` and vanishes
on the next save.

Independently: `srsCardFor` (`persistence.ts:206`) does an unguarded bracket lookup, so an
atom id of `toString` or `constructor` resolves to an inherited `Object.prototype` member.
That value is truthy, so `cardForAtom` (`srs.ts:144`, `if (existing) return existing;`) hands
a *function* to the component as an `SrsCard`, `nextInterval` renders "NaN days", and grading
persists an entry keyed `"undefined"`.

`putSrsCard` (`persistence.ts:202`) is **safe** — object spread uses `CreateDataProperty`, not
`[[Set]]`. Only the `migrate()` loop is affected.

**Fix:** `Object.create(null)` for the map, reject `__proto__` / `constructor` / `prototype`
keys, and guard `srsCardFor` with `Object.hasOwn`. Regression test alongside the existing
`bad` / `alsoBad` case at `persistence.test.ts:164`.

## MEDIUM — `dueDay` accepts any string, so a card can leave the scheduler permanently

`persistence.ts:111` — `typeof c.dueDay === 'string' &&`

`"zzz"` never matches the ISO string compare in `cardsDue` (`srs.ts:151`) or `dueCount`
(`persistence.ts:214`), so the card is due forever-never and drops silently out of review
while staying in storage. `""` makes every card permanently due. Neither is visible to the
learner. The same function already applies `/^\d{4}-\d{2}-\d{2}$/` to day keys at `:88`.

**Fix:** reuse that regex on `dueDay`; lift it to a module const so the two cannot drift.

## MEDIUM — unbounded numbers produce an Invalid Date and a `"NaN-NaN-NaN"` due day

`persistence.ts:108-112`

`ease` and `intervalDays` are checked only as `typeof === 'number'`. `{"ease":1e308,
"intervalDays":1e308}` survives, `nextInterval` (`srs.ts:99`) overflows to `Infinity`,
`addDays` (`srs.ts:81-86`) produces an Invalid Date, and `dayKey` returns the literal
`"NaN-NaN-NaN"` — which sorts above any real ISO day, so the card is never due again.

This is exactly the outcome `srs.ts:159-163` names as unacceptable in its own comment, with
nothing asserting it.

**Fix:** clamp on read (`Number.isFinite`, ease within `[MIN_EASE, 5]`, non-negative bounded
integers), and make `addDays` return the input day unchanged on an invalid date so no path
can emit `"NaN-NaN-NaN"`.

## MEDIUM — `buildReviewQueue()` is Θ(n²·t²) with no input cap

`srs.ts:174-179`, `:181-200`

**It always terminates** — `splice` removes exactly one element per iteration — so the defect
is cost, not a hang loop. Each outer iteration scans the whole queue or the whole remainder,
and `shareTopic` is itself O(t²). `migrate()` caps neither card count nor `teaches` length
(`persistence.ts:117`). The localStorage quota bounds it at roughly 35-40k cards, giving
~8x10^8 comparisons on the main thread.

Latent today: `buildReviewQueue` is reachable only from tests, and the existing tests use
decks of 3-7 cards. It becomes a real availability bug the moment the Review route wires it.

**Fix:** bound the backward scan at `window` — the function only needs to know whether a
conflict is *closer than* `window`, so the result is identical and the cost drops to
O(n·window·t). Cap deck size and `teaches` length in `migrate()`. Add a perf-shaped test.

## LOW — cards are keyed by the outer map key, not by their own `atomId`

`persistence.ts:114-115`. `{"A": {"atomId":"B"}}` stores under `A` while claiming to be `B`;
grading writes key `B` and orphans `A`, which `dueCount` then counts forever.

**Fix:** reject when `c.atomId !== atomId`. That matches the file's stated drop-one-card-keep-
the-deck policy.

## LOW — `atom.srs.reason.replace()` is an unguarded deref on unvalidated content

`Flashcard.tsx:106-108`. Lesson JSON is cast without runtime validation
(`fetch-json.ts:66`), so an atom with a missing or non-string `reason` throws during render.
There is **no error boundary anywhere in the app** (grepped for `componentDidCatch`,
`getDerivedStateFromError`, `ErrorBoundary` — no matches), so the throw blanks the app rather
than degrading one atom.

`atoms/index.tsx:18-20` states the house rule — every payload value read through a narrow
accessor — and this line bypasses it.

**Fix:** route it through the accessor pattern. The error boundary is a separate, larger
change than this unit.

## LOW — no Content-Security-Policy anywhere in the app

Pre-existing and app-wide, not introduced here. Nothing in this changeset needs a CSP to be
safe; it is the control that would contain a future regression of the kind
`app-data-schema.md` §7 lines 375-376 explicitly names. Not this unit's work.

---

## What was checked, and what was not

**Audited:** `src/state/srs.ts`, `src/state/persistence.ts`, `src/state/session.tsx`,
`src/atoms/Flashcard.tsx` + `.css`, `src/atoms/index.tsx`, `src/views/Lesson.tsx`,
`src/shell/LeftRail.tsx`, `package.json`, `package-lock.json`, `scripts/run-tests.mjs`,
`tsconfig.json`, plus call sites needed to judge reachability (`content/index.ts`,
`content/fetch-json.ts`, `content/types.ts`, `atoms/Markdown.tsx`) and the two changed test
files.

**Not examined:** `content/markdown.ts` parser internals, the service worker,
`scripts/sync-content.mjs` and the content generator, `shell/LeftRail.css`.

**XSS — how it was cleared.** `Flashcard.tsx` renders `front`, `back` and the grade labels as
JSX children, which Preact emits as text nodes. Grepped `src/` for
`dangerouslySetInnerHTML`, `innerHTML`, `eval(` — the only hits are the two comments asserting
their absence. Attribute interpolations at `Flashcard.tsx:80/83/88` go through Preact's
attribute path, never HTML string concatenation, and `label` comes from the hardcoded `GRADES`
const. The one `href` (`LeftRail.tsx:34`) iterates the hardcoded `ROUTES` const.

**Dependency — how it was cleared.** `package.json:31` places `@testing-library/user-event`
under `devDependencies`; the lock records `"dev": true` with an SRI hash. One import, in
`flashcard.test.tsx:4`. `tsconfig.json:29-33` excludes test files from the app build and the
Vite entry graph starts at `index.html`.

**Pre-existing advisories.** `vite` 5.4.21 (high) and `esbuild` 0.21.5 (moderate) are both
dev-only and **dev-server-scoped**: `vite build` emits static assets with no Vite runtime, so
the built site is unaffected. They do affect a developer running `npm run dev` on an untrusted
network. `esbuild` is pinned transitively by Vite 5 and cannot be bumped without a Vite major,
so the mitigation is operational — bind the dev server to `127.0.0.1`. Not part of this
changeset.

**Secrets and PII.** No `console.*` in production code. The only `fetch` calls are same-origin
GETs for lesson JSON; persisted state is never transmitted. The one free-text field is the
flag `note`, learner-authored, capped at 140 chars, in plaintext localStorage — appropriate
for a local-only app.

## Handed to tester-debugger

1. The actual wall-clock threshold at which `buildReviewQueue` freezes the thread — the
   complexity analysis gives the shape, not the number.
2. End-to-end confirmation of the `__proto__` `[[Set]]` behaviour under happy-dom. Reasoned
   from the specification, not executed.
