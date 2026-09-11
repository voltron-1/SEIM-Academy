import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson, ContentUnavailable, type FetchDeps } from './fetch-json.js';

const json = (body: unknown, ok = true, status = 200): Response =>
  ({ ok, status, text: async () => JSON.stringify(body) }) as unknown as Response;

const raw = (text: string, ok = true, status = 200): Response =>
  ({ ok, status, text: async () => text }) as unknown as Response;

const broken = (): Response => raw('{"truncated":');

test('a successful fetch is not stale', async () => {
  const deps: FetchDeps = { fetch: async () => json({ id: 'L' }) };
  assert.deepEqual(await fetchJson(' /x', deps), { data: { id: 'L' }, stale: false });
});

test('a network failure falls back to the cached copy and says it is stale', async () => {
  const deps: FetchDeps = {
    fetch: async () => { throw new TypeError('Failed to fetch'); },
    cacheMatch: async () => json({ id: 'cached' }),
  };
  const result = await fetchJson<{ id: string }>('/x', deps);
  assert.equal(result.data.id, 'cached');
  assert.equal(result.stale, true, 'the learner must be told which copy this is');
});

test('a 404 falls back to cache too — a regenerated lesson may still be readable', async () => {
  const deps: FetchDeps = {
    fetch: async () => json(null, false, 404),
    cacheMatch: async () => json({ id: 'cached' }),
  };
  assert.equal((await fetchJson<{ id: string }>('/x', deps)).stale, true);
});

test('offline with no cache reports offline, not missing', async () => {
  const deps: FetchDeps = { fetch: async () => { throw new TypeError('Failed to fetch'); } };
  await assert.rejects(fetchJson('/x', deps), (e: ContentUnavailable) => {
    assert.equal(e.reason, 'offline');
    return true;
  });
});

test('a 404 with no cache reports missing, not offline', async () => {
  // Content regenerates and lesson ids move. Telling someone to check their connection
  // when the file is simply gone sends them to debug the wrong thing.
  const deps: FetchDeps = { fetch: async () => json(null, false, 404) };
  await assert.rejects(fetchJson('/x', deps), (e: ContentUnavailable) => {
    assert.equal(e.reason, 'missing');
    return true;
  });
});

test('truncated JSON from a reachable server is malformed, not offline', async () => {
  const deps: FetchDeps = { fetch: async () => broken(), cacheMatch: async () => json({ id: 'c' }) };
  await assert.rejects(fetchJson('/x', deps), (e: ContentUnavailable) => {
    assert.equal(e.reason, 'malformed');
    return true;
  });
});

test('an SPA fallback page served with 200 is missing, not malformed', async () => {
  // Static hosts answer an unknown path with index.html and a 200 — confirmed against
  // `vite preview`, which returned 200 for a lesson id that does not exist. Reporting
  // that as "malformed" tells the learner to retry something that can never succeed.
  for (const body of ['<!doctype html><html><body>app</body></html>', '  <html>x</html>']) {
    const deps: FetchDeps = { fetch: async () => raw(body) };
    await assert.rejects(fetchJson('/x', deps), (e: ContentUnavailable) => {
      assert.equal(e.reason, 'missing', `HTML body should read as missing: ${body.slice(0, 20)}`);
      return true;
    });
  }
});

test('an HTML page in the cache does not masquerade as content', async () => {
  const deps: FetchDeps = {
    fetch: async () => { throw new TypeError('Failed to fetch'); },
    cacheMatch: async () => raw('<!doctype html><html></html>'),
  };
  await assert.rejects(fetchJson('/x', deps), (e: ContentUnavailable) => {
    assert.equal(e.reason, 'offline');
    return true;
  });
});

test('a corrupt cache entry does not mask the real failure', async () => {
  const deps: FetchDeps = {
    fetch: async () => { throw new TypeError('Failed to fetch'); },
    cacheMatch: async () => broken(),
  };
  await assert.rejects(fetchJson('/x', deps), (e: ContentUnavailable) => {
    assert.equal(e.reason, 'offline');
    return true;
  });
});

test('a browser with no Cache Storage is a normal case', async () => {
  const deps: FetchDeps = { fetch: async () => { throw new TypeError('Failed to fetch'); } };
  await assert.rejects(fetchJson('/x', deps), ContentUnavailable);
});

test('a throwing cacheMatch is survivable', async () => {
  const deps: FetchDeps = {
    fetch: async () => { throw new TypeError('Failed to fetch'); },
    cacheMatch: async () => { throw new DOMException('SecurityError'); },
  };
  await assert.rejects(fetchJson('/x', deps), (e: ContentUnavailable) => {
    assert.equal(e.reason, 'offline');
    return true;
  });
});
