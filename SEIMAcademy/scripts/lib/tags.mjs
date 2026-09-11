/**
 * Tag derivation. Tags are never hand-authored: every one is computed from a parsed
 * source coordinate (document, heading, cell) or declared as a module concept in
 * module-manifest.json. See app-data-schema.md section 3, "Tag vocabulary".
 */

export const TAG_NAMESPACES = new Set(['corpus', 'channel', 'event', 'provider', 'concept', 'lifecycle']);
export const TAG_RE = /^(corpus|channel|event|provider|concept|lifecycle):[a-z0-9][a-z0-9:._-]*$/;

export function slug(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function assertTag(tag) {
  if (!TAG_RE.test(tag)) throw new Error(`Derived tag violates the schema tag grammar: ${tag}`);
  return tag;
}

export const corpusTag = (corpus) => assertTag(`corpus:${slug(corpus)}`);
export const channelTag = (heading) => assertTag(`channel:${slug(heading)}`);
export const eventTag = (heading, eventId) => assertTag(`event:${slug(heading)}:${slug(String(eventId))}`);
export const providerTag = (provider) => assertTag(`provider:${slug(provider)}`);
export const conceptTag = (name) => assertTag(name.startsWith('concept:') ? name : `concept:${slug(name)}`);
export const lifecycleTag = (stage) => assertTag(`lifecycle:${slug(stage)}`);

/** Deduplicate and sort, so tag arrays are byte-stable across runs. */
export function normalizeTags(tags) {
  return [...new Set(tags.filter(Boolean))].sort();
}
