# SEIM Academy — app shell

Phase 2 deliverable. Static-first SPA: **Preact + TypeScript, built with Vite**.
Explicitly not Next.js/React — nothing here needs SSR or a routing framework.

## Commands

```bash
npm install
npm run dev              # dev server
npm run build            # typecheck + static bundle into dist/
npm run preview          # serve the built bundle
npm run check            # contrast + type drift + typecheck + tests (what CI will run)
npm run check:contrast   # WCAG 2.1 AA across every token pairing
npm run check:types      # src/content/types.ts vs the JSON Schema
npm test                 # session logic
npm run sync:content     # copy ../content into public/ (runs before dev and build)
```

## Content

`public/content/` is a **generated copy** of `SEIMAcademy/content/`, synced automatically
before `dev` and `build`. It is gitignored. Never edit it — regenerate with
`node SEIMAcademy/scripts/build-content.mjs` and it will re-sync.

Play order comes from `build-manifest.json` → `modules[].lesson_order`, never from a
filename sort.

`src/content/types.ts` is a third view of the schema contract, after the normative document
and the JSON Schema mirror. Three views drift, so `npm run check:types` compares them —
Phase 1 already had a schema document describe a mechanism that existed in no code.

## Theme tokens

`src/theme/tokens.css` holds the whole palette. Every pairing the UI can produce is
declared in `scripts/check-contrast.mjs` and **computed** against WCAG 2.1 AA — 4.5:1 for
body text, 3:1 for UI boundaries and focus indicators. A violation fails the build.

That is not ceremony. The first `--border-strong` value written here was 1.93:1 against the
page background — visually fine, well under the 3:1 that WCAG 1.4.11 requires of a control
boundary. The check caught it before it shipped.

Adding a token means adding its pairings to that list. An unused token is fine; an
unverified one is not.

## Motion

**Reduced motion is a hard default** — Decision 5, resolved 2026-09-10. Nothing animates
unless a learner opts in via `data-motion="full"` on the root element, and
`prefers-reduced-motion` can only ever reduce motion further, never restore it.

Every animation and transition in the app resolves through `--motion-duration`, enforced by
a global rule in `tokens.css`, so a component cannot opt itself back into motion by
hardcoding a duration.

## Type

System font stacks only — no webfont in the critical path, nothing to fetch, no
third-party request from a tool meant to work with the network cut.

Humanist sans for prose; **monospace for anything that also appears in a SIEM** — Event
IDs, log lines, SPL, field names. Reading `4624` in the prose face makes it prose; reading
it in mono makes it data.

## Renderer contract (normative)

`../app-data-schema.md` §7: the renderer **MUST** parse atom `body` with raw HTML disabled
and **MUST** treat every `payload` string as text, not markup. Lesson content is generated
from a third-party source repository; the build-time markup check in the content pipeline
is a backstop, not a substitute.

`innerHTML`, `dangerouslySetInnerHTML`, and a Markdown parser left on permissive defaults
are out of contract. The permitted Markdown subset is small enough to render directly, so
it is — no Markdown library in the critical path.

## Shell contract

The exit affordances (Skip / Hint / Pause / Exit to Today) are a grid row of the shell, not
something a view renders. That is structural on purpose: a view cannot omit them, and Focus
mode cannot collapse them. BUILD-PLAN calls them "rendered once by the app shell, never
hidden", so `chromeFor()` in `state/session-core.ts` states it as an assertion and
`npm test` checks it.

Skip and Hint are `aria-disabled` rather than `disabled` until an atom is on screen: still
reachable by keyboard, still announced, visibly inert — discoverable rather than absent.

## Rendering atom bodies

`content/markdown.ts` parses the permitted subset into a small AST; `atoms/Markdown.tsx`
turns that AST into Preact nodes. **There is no `innerHTML` in the path and no Markdown
library behind it** — text reaches the DOM as text nodes, which is the §7 obligation stated
as code rather than as a parser setting someone can flip later.

Links are repo-relative only. A target with a scheme — `javascript:`, `data:`, `http:` — or
a protocol-relative `//host` renders as literal text and is never followed. The content
pipeline should already have rejected such a string; this is the second lock on the door.

## Tests

`npm test` compiles the pure modules and runs them under `node --test`. No test runner
dependency, no DOM harness.

The suite refuses to report success if it compiled fewer than four test files. That guard
is there because this suite already failed silently once: the base tsconfig excludes
`*.test.ts`, `exclude` is inherited through `extends`, zero tests compiled, and
`node --test` reported `# pass 0 / # fail 0` and exited 0. A suite that can pass by being
empty is not a gate.

`state/resume.test.ts` runs against the **real** generated lessons rather than a fixture:
it plays a lesson through the same state transitions the player performs, throws the
in-memory state away the way closing a tab does, and asserts the resume point. It also
round-trips all 707 atom ids through storage, because an id that does not survive
serialisation would silently orphan a learner's progress.

## Status

Units 1–3 of 4 done (#20–#27, #29–#31). The pilot module plays start to finish: 707 atoms
across six types render, progress and streak persist, resume lands on the atom you left,
and every atom can be flagged with an optional note.

Not yet built, and deliberately not faked: the offline/degraded render and the PWA shell
(Unit 4, #28/#32). Answering, grading, SRS scheduling and drag interaction are **Phase 3** —
quiz and exercise atoms render faithfully and reveal their answers so a lesson reads end to
end, but nothing here scores anything.
