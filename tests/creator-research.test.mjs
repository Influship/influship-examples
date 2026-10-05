import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import test from 'node:test';
import { createAppServer } from '../creator-research/server.mjs';

const key = 'synthetic-server-only-key';
const missingKeyPattern = /Set INFLUSHIP_API_KEY/;
const listId = '123e4567-e89b-12d3-a456-426614174000';
const list = {
  name: 'Review',
  brief: 'Home workout teachers',
  notes: 'Read their tutorials',
  profiles: [{ platform: 'instagram', username: 'example.fit' }],
};
async function app(t, { status = 200, payload } = {}) {
  const calls = [];
  const server = createAppServer({
    apiKey: key,
    fetchImpl: (url, init) => {
      calls.push({ url, ...init });
      return Promise.resolve(
        new Response(JSON.stringify(payload ?? { data: [] }), {
          status,
          headers: {
            'Content-Type': 'application/json',
            'X-Credits-Charged': '35',
            'Retry-After': '3',
          },
        })
      );
    },
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      })
  );
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    calls,
    origin,
    request: (path, body, headers = {}) =>
      fetch(origin + path, {
        method: body ? 'POST' : 'GET',
        headers: {
          Origin: origin,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
  };
}

test('search caps delivery at five and retains key on the server', async (t) => {
  const local = await app(t, { payload: { data: [], quality: { mode: 'reranked' } } });
  const response = await local.request('/api/search', { query: ' workout tutorials ', limit: 100 });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-credits-charged'), '35');
  assert.equal(local.calls.length, 1);
  assert.equal(local.calls[0].url, 'https://api.influship.com/v1/search');
  assert.deepEqual(JSON.parse(local.calls[0].body), { query: 'workout tutorials', limit: 5 });
  assert.equal(local.calls[0].headers['X-API-Key'], key);
  assert.equal(response.headers.get('x-api-key'), null);
  assert.ok(!(await response.text()).includes(key));
  for (const path of ['/', '/app.js', '/styles.css']) {
    const asset = await local.request(path);
    assert.equal(asset.status, 200);
    assert.ok(!(await asset.text()).includes(key));
  }
});
test('save normalizes selected handles and list reads preserve the returned ID', async (t) => {
  const local = await app(t, { payload: { data: { id: listId, ...list } } });
  assert.equal(
    (
      await local.request('/api/shortlists', {
        ...list,
        profiles: [{ platform: 'instagram', username: 'EXAMPLE.fit' }],
        id: listId,
        expected_version: 1,
      })
    ).status,
    200
  );
  assert.deepEqual(JSON.parse(local.calls[0].body), list);
  assert.equal((await local.request('/api/shortlists')).status, 200);
  assert.equal((await local.request(`/api/shortlists/${listId}`)).status, 200);
  assert.equal(local.calls[2].url, `https://api.influship.com/v1/shortlists/${listId}`);
  assert.equal(local.calls[2].method, 'GET');
});
test('invalid input never reaches the API', async (t) => {
  const local = await app(t);
  for (const [path, body] of [
    ['/api/search', { query: '' }],
    ['/api/search', { query: 'x'.repeat(501) }],
    ['/api/shortlists', { ...list, profiles: [] }],
    ['/api/shortlists', { ...list, profiles: new Array(9).fill(list.profiles[0]) }],
    [
      '/api/shortlists',
      { ...list, profiles: [...list.profiles, { platform: 'instagram', username: 'EXAMPLE.FIT' }] },
    ],
    ['/api/shortlists', { ...list, profiles: [{ platform: 'tiktok', username: 'example' }] }],
    ['/api/shortlists', { ...list, name: 'x'.repeat(81) }],
    ['/api/shortlists', { ...list, notes: 'x'.repeat(2001) }],
  ]) {
    assert.equal((await local.request(path, body)).status, 400);
  }
  assert.equal((await local.request('/api/shortlists/not-an-id')).status, 404);
  assert.equal((await local.request('/api/proxy?url=https://example.com')).status, 404);
  assert.equal((await local.request('/api/search', { query: 'x'.repeat(17_000) })).status, 413);
  assert.equal(local.calls.length, 0);
});
test('cross-origin and hostile host requests cannot use the local key', async (t) => {
  const local = await app(t);
  assert.equal(
    (await local.request('/api/search', { query: 'fitness' }, { Origin: 'https://example.com' }))
      .status,
    403
  );
  assert.equal(
    (await local.request('/api/shortlists', undefined, { Origin: 'https://example.com' })).status,
    403
  );
  const hostileStatus = await new Promise((resolve, reject) => {
    const req = httpRequest(
      `${local.origin}/api/shortlists`,
      { headers: { Host: 'attacker.example:3344' } },
      (res) => {
        res.resume();
        resolve(res.statusCode);
      }
    );
    req.on('error', reject);
    req.end();
  });
  assert.equal(hostileStatus, 403);
  assert.equal(
    (
      await fetch(`${local.origin}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"query":"fitness"}',
      })
    ).status,
    403
  );
  assert.equal(local.calls.length, 0);
});
for (const status of [402, 429, 502, 503]) {
  test(`${status} is surfaced without replaying a search or create`, async (t) => {
    const local = await app(t, {
      status,
      payload: { error: { code: 'synthetic_error', message: 'Fixture failure' } },
    });
    for (const [path, body] of [
      ['/api/search', { query: 'fitness' }],
      ['/api/shortlists', list],
    ]) {
      const response = await local.request(path, body);
      assert.equal(response.status, status);
      assert.equal(response.headers.get('retry-after'), '3');
      assert.equal((await response.json()).error.code, 'synthetic_error');
    }
    assert.equal(local.calls.length, 2);
  });
}
test('missing key fails before binding a server', () => {
  assert.throws(() => createAppServer({ apiKey: '' }), missingKeyPattern);
});
