import './app.css';

/**
 * Unit 1 deliverable: a specimen page, not a mock shell.
 *
 * It renders every theme token and both type faces so the system can be inspected in a
 * browser, and so a regression is visible rather than theoretical. The left rail, HUD and
 * atom renderer are Unit 2 and Unit 3 — putting fake versions of them here would make the
 * shell look further along than it is.
 */

const SURFACES = ['bg', 'surface', 'surface-raised', 'border', 'border-strong'] as const;
const MEANING = ['text', 'text-muted', 'accent', 'accent-strong', 'danger', 'success', 'focus'] as const;

function Swatch({ token }: { token: string }) {
  return (
    <div class="swatch">
      <div class="swatch__chip" style={{ background: `var(--${token})` }} />
      <code class="swatch__name">--{token}</code>
    </div>
  );
}

export function App() {
  return (
    <main class="specimen">
      <h1>SEIM Academy — theme specimen</h1>
      <p class="lede">
        Phase 2, Unit 1. Every pairing below is verified against WCAG 2.1 AA by{' '}
        <code>npm run check:contrast</code>, which fails the build on a violation.
      </p>

      <h2>Surfaces</h2>
      <div class="swatches">
        {SURFACES.map((t) => (
          <Swatch key={t} token={t} />
        ))}
      </div>

      <h2>Meaning</h2>
      <div class="swatches">
        {MEANING.map((t) => (
          <Swatch key={t} token={t} />
        ))}
      </div>

      <h2>Type</h2>
      <div class="card">
        <p>
          Humanist sans carries prose. A Tier 1 analyst reading this should be reading, not
          decoding.
        </p>
        <p class="muted">
          Muted text is for secondary information that must still clear 4.5:1 — a
          lower-contrast aside is still body copy.
        </p>
        <p>
          Monospace carries anything that also appears in a SIEM:{' '}
          <code>Security 4624</code>, <code>An account was successfully logged on.</code>{' '}
          Reading <code>4624</code> in the prose face makes it prose; reading it in mono
          makes it data, which is what it is.
        </p>
        <pre>
          <code>{'index=wineventlog EventCode=4624 | stats count by Account_Name'}</code>
        </pre>
      </div>

      <h2>Motion</h2>
      <div class="card">
        <p>
          <strong>Reduced motion is a hard default</strong> (Decision 5, resolved
          2026-09-10). Nothing animates unless a learner opts in, and the OS preference can
          only ever reduce motion further, never restore it.
        </p>
      </div>
    </main>
  );
}
