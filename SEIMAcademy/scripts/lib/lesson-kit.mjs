/**
 * lesson-kit -- lesson assembly that no generator profile owns.
 *
 * The split matters for Phases 4 and 6: a module whose source is not a table of Event IDs
 * needs its own parsing and its own atom shapes, but it needs the SAME time budgeting,
 * chunking, instructions anatomy and provenance stamping. Everything profile-agnostic
 * lives here so the next profile inherits it instead of copying it.
 */
import { SCHEMA_VERSION, SECONDS, makeAtom, deterministicId, dedupeSources, contentHash, truncateTitle } from './atoms.mjs';
import { normalizeTags, slug } from './tags.mjs';

/** section 6.1 lesson-time-budget */
export const LESSON_MIN_SECONDS = 180;
export const LESSON_MAX_SECONDS = 420;

/**
 * Build a multiple-choice option list that is distinct by construction.
 * `preferred` always appears; `pools` are drawn on in order until `max` is reached.
 * Callers order the result themselves -- numerically for Event IDs, alphabetically for
 * prose -- so the answer never sits at a predictable index.
 */
export function pickDistinctChoices(preferred, pools, max = 4) {
  const out = [];
  for (const candidate of [preferred, ...pools]) {
    if (candidate === undefined || candidate === null) continue;
    const value = String(candidate);
    if (!out.includes(value)) out.push(value);
    if (out.length === max) break;
  }
  return out;
}

export function finalizeLesson({ module, id, title, summary, atoms, provenanceBase, part }) {
  const seconds = atoms.reduce((n, a) => n + a.estimated_seconds, 0);
  if (seconds < LESSON_MIN_SECONDS || seconds > LESSON_MAX_SECONDS) {
    throw new Error(
      `lesson-time-budget: ${id} is ${seconds}s, must be ${LESSON_MIN_SECONDS}-${LESSON_MAX_SECONDS}s ` +
        `(${atoms.length} atoms)`
    );
  }
  const teaches = normalizeTags(atoms.flatMap((a) => a.teaches ?? []));
  const internallyTaught = new Set();
  const external = new Set();
  for (const atom of atoms) {
    for (const tag of atom.requires ?? []) if (!internallyTaught.has(tag)) external.add(tag);
    for (const tag of atom.teaches ?? []) internallyTaught.add(tag);
  }
  const lesson = {
    schema_version: SCHEMA_VERSION,
    id,
    tier: module.tier,
    module: module.module,
    ...(part ? { part } : {}),
    title: truncateTitle(title),
    summary: truncateTitle(summary, 240),
    estimated_seconds: seconds,
    teaches,
    requires: normalizeTags([...external]),
    sources: dedupeSources(atoms.map((a) => a.source)),
    generated: { ...provenanceBase, content_hash: contentHash(atoms) },
    atoms,
  };
  return lesson;
}


export function chunkEvenly(items, maxPerChunk) {
  if (items.length === 0) return [];
  const n = Math.ceil(items.length / maxPerChunk);
  const size = Math.floor(items.length / n);
  const extra = items.length % n;
  const chunks = [];
  let i = 0;
  for (let c = 0; c < n; c += 1) {
    const take = size + (c < extra ? 1 : 0);
    chunks.push(items.slice(i, i + take));
    i += take;
  }
  return chunks;
}

/**
 * Event IDs repeat inside a channel with different providers -- System 16 means three
 * different things. Where that happens the provider (or, failing that, a slug of the
 * description) disambiguates the atom id and the on-screen label. The suffix is derived
 * from content, never from row position, so inserting a row above does not renumber
 * anything (section 6.8).
 */

export function chunkSuffixes(chunks, keyOf) {
  const used = new Set();
  return chunks.map((chunk, idx) => {
    const base = slug(String(keyOf(chunk[0]) ?? '')) || `p${idx + 1}`;
    let candidate = base;
    let n = 2;
    while (used.has(candidate)) { candidate = `${base}-${n}`; n += 1; }
    used.add(candidate);
    return candidate;
  });
}


export function makeInstructions({ module, corpus, heading, idSuffix, goal, use, doneWhen, source, teaches, stepUp }) {
  return makeAtom({
    id: deterministicId(module.id, corpus, slug(heading), 'instr', idSuffix),
    type: 'instructions',
    title: `Before you start: ${truncateTitle(heading, 50)}`,
    body: '',
    source,
    teaches,
    seconds: SECONDS.instructions,
    graded: false,
    payload: {
      goal,
      what_youll_use: use,
      done_when: doneWhen,
      ...(stepUp ? { step_up_notice: stepUp } : {}),
    },
  });
}

