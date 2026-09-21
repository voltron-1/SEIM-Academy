/**
 * Content access.
 *
 * Every load goes through fetchJson, which reports whether the learner is looking at a
 * fresh copy or a cached one. There is no separate "offline path" to forget to write —
 * the degraded case is the same call with a different result.
 */
import type { BuildManifest, Lesson } from './types';
import { fetchJson, ContentUnavailable, type JsonResult } from './fetch-json';
import { BASE_URL } from '../env';

const BASE = `${BASE_URL}content`;

export { ContentUnavailable };
export type { JsonResult };

const deps = () => ({
  fetch: (url: string) => globalThis.fetch(url),
  cacheMatch: globalThis.caches
    ? async (url: string) => (await globalThis.caches.match(url)) ?? undefined
    : undefined,
});

export const loadManifest = (): Promise<JsonResult<BuildManifest>> =>
  fetchJson<BuildManifest>(`${BASE}/build-manifest.json`, deps());

/**
 * `id` is manifest-derived, not learner input, but it still crosses a URL boundary — an id
 * containing `../` would otherwise redirect the fetch outside `lessons/`. Encoding it is
 * cheap insurance against a corrupted or tampered manifest, not a defence against a learner.
 */
export const loadLesson = (id: string): Promise<JsonResult<Lesson>> =>
  fetchJson<Lesson>(`${BASE}/lessons/${encodeURIComponent(id)}.json`, deps());

export const modulesForTier = (manifest: BuildManifest, tier: 1 | 2) =>
  manifest.modules.filter((m) => m.tier === tier);
