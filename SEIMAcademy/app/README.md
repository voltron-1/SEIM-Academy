# SEIM Academy — app shell

Phase 2 deliverable. Static-first SPA: **Preact + TypeScript, built with Vite**.
Explicitly not Next.js/React — nothing here needs SSR or a routing framework.

## Commands

```bash
npm install
npm run dev              # dev server
npm run build            # typecheck + static bundle into dist/
npm run preview          # serve the built bundle
npm run check            # contrast + typecheck (what CI will run)
npm run check:contrast   # WCAG 2.1 AA across every token pairing
```

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

## Status

Unit 1 of 4 (#20–#23). `src/app.tsx` is a **theme specimen**, not a mock shell — the left
rail, HUD and atom renderer are Units 2 and 3. Fake versions here would make the shell look
further along than it is.
