/**
 * JSON fetching with a last-known-good fallback (#28).
 *
 * BUILD-PLAN, anxiety-safe: "Failed content load → last-known-good cached lesson + calm
 * retry (no bare error)." So a failure is not an exception here — it is a result that says
 * which copy the learner is looking at, and the UI can be calm about it because it always
 * has something to show.
 *
 * Dependencies are injected so this is testable without a browser: the whole point is the
 * behaviour when `fetch` throws, and a test that cannot make `fetch` throw is not testing
 * the degraded path.
 */

export interface JsonResult<T> {
  data: T;
  /** True when the network failed and this came out of the cache instead. */
  stale: boolean;
}

export class ContentUnavailable extends Error {
  constructor(
    readonly url: string,
    readonly reason: 'offline' | 'missing' | 'malformed',
    cause?: unknown
  ) {
    super(`${reason}: ${url}`);
    this.name = 'ContentUnavailable';
    this.cause = cause;
  }
}

export interface FetchDeps {
  fetch: (url: string) => Promise<Response>;
  /** Cache Storage, when the browser has it. Absent is a normal case, not an error. */
  cacheMatch?: (url: string) => Promise<Response | undefined>;
}

/**
 * Network first, cache second.
 *
 * Deliberately not cache-first on the page side: the service worker already serves content
 * from cache immediately (stale-while-revalidate), so a second cache-first layer here would
 * only ever return the same bytes one step later. What the page adds is the fallback when
 * there is no service worker at all — first visit, unsupported browser, or a hard reload
 * that outruns activation.
 */
type Parsed<T> =
  | { ok: true; data: T }
  | { ok: false; looksLikeHtml: boolean; error: unknown };

/**
 * Parse as text first, then JSON.
 *
 * `response.json()` throws the same way for "this is HTML" and "this JSON is truncated",
 * and those need different things said to the learner. Reading the text lets the two be
 * told apart.
 */
async function parseBody<T>(response: Response): Promise<Parsed<T>> {
  let text: string;
  try {
    text = await response.text();
  } catch (error) {
    return { ok: false, looksLikeHtml: false, error };
  }
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch (error) {
    return { ok: false, looksLikeHtml: /^\s*<(!doctype|html)/i.test(text), error };
  }
}

export async function fetchJson<T>(url: string, deps: FetchDeps): Promise<JsonResult<T>> {
  let response: Response | null = null;
  let networkError: unknown = null;

  try {
    response = await deps.fetch(url);
  } catch (error) {
    networkError = error;
  }

  if (response?.ok) {
    const parsed = await parseBody<T>(response);
    if (parsed.ok) return { data: parsed.data, stale: false };
    // A single-page-app host answers an unknown path with index.html and a 200, so a
    // deleted lesson arrives as HTML rather than a 404. Calling that "malformed" would
    // tell the learner to retry something that will never succeed.
    if (parsed.looksLikeHtml) throw new ContentUnavailable(url, 'missing');
    throw new ContentUnavailable(url, 'malformed', parsed.error);
  }

  const cached = await deps.cacheMatch?.(url).catch(() => undefined);
  if (cached) {
    const parsed = await parseBody<T>(cached);
    // A corrupt or HTML cache entry is worth nothing; fall through to the real failure.
    if (parsed.ok) return { data: parsed.data, stale: true };
  }

  if (networkError) throw new ContentUnavailable(url, 'offline', networkError);
  // A 404 with no cached copy means the file is genuinely gone — content regenerated and
  // this lesson no longer exists. That is a different problem from being offline, and the
  // UI should not tell the learner to check their connection.
  throw new ContentUnavailable(url, 'missing');
}
