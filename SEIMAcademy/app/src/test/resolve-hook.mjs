/**
 * ESM hooks for compiled test runs. Test-only; no dependency.
 *
 * Two things Vite does that Node does not, and that the app source is entitled to rely on:
 *
 *   1. Extensionless relative imports (`./atoms`). Adding `.js` to every import in the app
 *      to satisfy a test runner would make the production source worse to serve the tests,
 *      so the hook resolves them the way Vite does: try `.js`, then `/index.js`.
 *   2. Style imports (`import './atoms.css'`). A component importing its own stylesheet is
 *      correct; in a DOM test it has nothing to do. These resolve to an empty module rather
 *      than being stripped from the source.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const STYLE = /\.(css|scss|sass|less)$/;
const EMPTY = 'stub:empty-module';

export async function resolve(specifier, context, next) {
  if (STYLE.test(specifier)) return { url: EMPTY, shortCircuit: true };

  if (specifier.startsWith('.') && !path.extname(specifier)) {
    const parent = context.parentURL ? path.dirname(fileURLToPath(context.parentURL)) : process.cwd();
    for (const candidate of [`${specifier}.js`, `${specifier}/index.js`]) {
      const abs = path.resolve(parent, candidate);
      if (existsSync(abs)) return { url: pathToFileURL(abs).href, shortCircuit: true };
    }
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (url === EMPTY) return { format: 'module', source: 'export default {};', shortCircuit: true };
  return next(url, context);
}
