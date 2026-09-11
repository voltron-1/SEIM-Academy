/**
 * Content access.
 *
 * Every load goes through fetchJson, which reports whether the learner is looking at a
 * fresh copy or a cached one. There is no separate "offline path" to forget to write —
 * the degraded case is the same call with a different result.
 */
import type { BuildManifest, Lesson } from './types';
import { fetchJson, ContentUnavailable, type JsonResult } from './fetch-json';

const BASE = `${import.meta.env.BASE_URL}content`;

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

export const loadLesson = (id: string): Promise<JsonResult<Lesson>> =>
  fetchJson<Lesson>(`${BASE}/lessons/${id}.json`, deps());

export const modulesForTier = (manifest: BuildManifest, tier: 1 | 2) =>
  manifest.modules.filter((m) => m.tier === tier);
