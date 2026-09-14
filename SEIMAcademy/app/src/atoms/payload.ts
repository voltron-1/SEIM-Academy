/**
 * Narrow accessors for `payload`, shared by every atom renderer.
 *
 * `payload` is `Record<string, unknown>` in the schema and lesson JSON is fetched and cast
 * without runtime validation, so a lesson from a future generator profile can carry a shape
 * this build has never seen. Every value is read through one of these rather than cast.
 */

export const str = (payload: Record<string, unknown>, key: string): string =>
  typeof payload[key] === 'string' ? (payload[key] as string) : '';

export const list = (payload: Record<string, unknown>, key: string): unknown[] =>
  Array.isArray(payload[key]) ? (payload[key] as unknown[]) : [];

/** The same narrowing for a value that is not in `payload` — an `srs.reason`, say. */
export const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;
