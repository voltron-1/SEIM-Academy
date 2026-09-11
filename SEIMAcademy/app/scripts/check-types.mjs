#!/usr/bin/env node
/**
 * Type-drift check: src/content/types.ts vs ../schema/app-data-schema.json.
 *
 *   npm run check:types
 *
 * app-data-schema.md is normative; the JSON Schema mirrors it; these TypeScript types are
 * a third view of the same contract. Three views drift. Phase 1 already had this happen
 * once — the schema document described a `source_quote` mechanism that existed in no code
 * — so the mirror is compared rather than trusted.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const schema = JSON.parse(readFileSync(path.resolve(HERE, '..', '..', 'schema', 'app-data-schema.json'), 'utf8'));
const ts = readFileSync(path.resolve(HERE, '..', 'src', 'content', 'types.ts'), 'utf8');

const failures = [];

/** Pull a `const X = [ 'a', 'b' ] as const;` list out of the TypeScript source. */
function tsUnion(name) {
  const m = ts.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const;`));
  if (!m) return null;
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

function compare(label, fromTs, fromSchema) {
  if (!fromTs) {
    failures.push(`${label}: not found in types.ts`);
    return;
  }
  if (!fromSchema) {
    failures.push(`${label}: not found in the JSON Schema`);
    return;
  }
  const missing = fromSchema.filter((v) => !fromTs.includes(v));
  const extra = fromTs.filter((v) => !fromSchema.includes(v));
  if (missing.length) failures.push(`${label}: in the schema but not in types.ts — ${missing.join(', ')}`);
  if (extra.length) failures.push(`${label}: in types.ts but not in the schema — ${extra.join(', ')}`);
  if (!missing.length && !extra.length) console.log(`pass  ${label.padEnd(22)} ${fromTs.length} values agree`);
}

compare('AtomType', tsUnion('ATOM_TYPES'), schema.$defs.atom.properties.type.enum);
compare('LifecycleStage', tsUnion('LIFECYCLE_STAGES'), schema.$defs.lifecycleStage.enum);

/** Required fields on a lesson and an atom must both be non-optional in the interface. */
function checkRequired(label, iface, required) {
  const body = ts.match(new RegExp(`export interface ${iface} \\{([\\s\\S]*?)\\n\\}`))?.[1];
  if (!body) {
    failures.push(`${label}: interface ${iface} not found`);
    return;
  }
  let ok = 0;
  for (const field of required) {
    const declared = new RegExp(`^\\s*${field}\\??:`, 'm').test(body);
    const optional = new RegExp(`^\\s*${field}\\?:`, 'm').test(body);
    if (!declared) failures.push(`${label}: ${iface}.${field} is required by the schema but absent`);
    else if (optional) failures.push(`${label}: ${iface}.${field} is required by the schema but optional here`);
    else ok += 1;
  }
  if (ok === required.length) console.log(`pass  ${label.padEnd(22)} ${ok} required fields present and non-optional`);
}

checkRequired('Lesson required', 'Lesson', schema.$defs.lesson.required);
checkRequired('Atom required', 'Atom', schema.$defs.atom.required);

if (failures.length) {
  console.error(`\n${failures.map((f) => `FAIL  ${f}`).join('\n')}`);
  console.error(`\nTYPE DRIFT — ${failures.length} mismatch(es) between types.ts and the JSON Schema`);
  process.exit(1);
}
console.log('\nTYPES MATCH THE SCHEMA');
