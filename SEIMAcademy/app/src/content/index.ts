/**
 * Content access.
 *
 * Unit 2 loads the build manifest only — the module list, play order and atom counts the
 * rail and HUD need. Individual lesson bodies are Unit 3's concern, and the
 * offline/degraded path around both is Unit 4's.
 */
import type { BuildManifest, Lesson } from './types';

const BASE = `${import.meta.env.BASE_URL}content`;

export class ContentError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ContentError';
  }
}

async function getJson<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new ContentError(`Could not reach ${url}`, cause);
  }
  if (!response.ok) throw new ContentError(`${response.status} from ${url}`);
  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new ContentError(`Malformed JSON at ${url}`, cause);
  }
}

export const loadManifest = () => getJson<BuildManifest>(`${BASE}/build-manifest.json`);

export const loadLesson = (id: string) => getJson<Lesson>(`${BASE}/lessons/${id}.json`);

/** Total atoms across a module, from the manifest's own stats — never recounted here. */
export const atomsInModule = (manifest: BuildManifest, moduleId: string): number =>
  manifest.modules.find((m) => m.id === moduleId)?.stats.atoms ?? 0;

export const modulesForTier = (manifest: BuildManifest, tier: 1 | 2) =>
  manifest.modules.filter((m) => m.tier === tier);
