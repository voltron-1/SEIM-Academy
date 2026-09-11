/**
 * Accessibility assertions for component tests.
 *
 * Pulls Phase 8's axe-core gate (#98) forward to where it is actually needed: an
 * inaccessible interaction found in Phase 8 is a rewrite, not a fix.
 *
 * `jest-axe` is the usual wrapper and is bound to Jest's matcher API, so this is a small
 * direct call to axe instead. The violation output is formatted to say what to change,
 * not just that something is wrong.
 */
import axe from 'axe-core';

export interface A11yOptions {
  /** Rules to switch off, each with a reason. Never silence one without saying why. */
  disable?: Record<string, string>;
}

export async function findA11yViolations(container: Element, options: A11yOptions = {}): Promise<string[]> {
  const rules: Record<string, { enabled: boolean }> = {};
  for (const rule of Object.keys(options.disable ?? {})) rules[rule] = { enabled: false };

  const results = await axe.run(container, {
    rules,
    // A component is rendered in isolation, so page-level landmark and region rules fire
    // on things the app shell provides. Those are asserted where the shell is tested.
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
  });

  return results.violations.map((v) => {
    const where = v.nodes.map((n) => n.html.slice(0, 90)).join('\n      ');
    return `${v.id} (${v.impact}): ${v.help}\n      ${where}\n      ${v.helpUrl}`;
  });
}

/** Throws with every violation listed, so one run reports all of them rather than the first. */
export async function assertNoA11yViolations(container: Element, options?: A11yOptions): Promise<void> {
  const violations = await findA11yViolations(container, options);
  if (violations.length > 0) {
    throw new Error(`${violations.length} accessibility violation(s):\n  ${violations.join('\n  ')}`);
  }
}
