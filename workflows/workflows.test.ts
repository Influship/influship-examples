import assert from 'node:assert/strict';
import test from 'node:test';
import Influship, { APIError } from 'influship';
import { buildShortlist, expandLookalikes, scoreExistingList } from './workflows.ts';

const id = '123e4567-e89b-12d3-a456-426614174000';
const candidate = {
  creator: { id, name: 'Synthetic creator' },
  primary_profile: null,
  match: {
    score: 0.4,
    reasons: ['Synthetic explanation'],
    ranking_source: 'retrieval_fallback',
    low_confidence: true,
  },
  location_unverified: true,
};
const fit = {
  creator: candidate.creator,
  input: { creator_id: id },
  match: {
    score: 0.8,
    decision: 'neutral',
    reasons: [{ text: 'Synthetic inference', provenance: 'inferred' }],
  },
};

function transport(replies: Array<{ body: unknown; credits?: string; status?: number }>) {
  const requests: Array<{ path: string; body: Record<string, unknown> }> = [];
  const client = new Influship({
    apiKey: 'synthetic-test-key',
    maxRetries: 0,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      requests.push({
        path: new URL(request.url).pathname,
        body: request.method === 'GET' ? {} : await request.json(),
      });
      const reply = replies.shift();
      assert.ok(reply, 'Unexpected additional request');
      return new Response(JSON.stringify(reply.body), {
        status: reply.status ?? 200,
        headers: {
          'content-type': 'application/json',
          ...(reply.credits ? { 'x-credits-charged': reply.credits } : {}),
          'retry-after': '12',
        },
      });
    },
  });
  return { client, requests };
}

test('empty search stops before match or expansion', async () => {
  const { client, requests } = transport([{ body: { data: [], search_id: id }, credits: '25' }]);
  const output = await buildShortlist(client, 'Home workout creators');
  assert.equal(requests.length, 1);
  assert.equal(output.creditsCharged, '25.00');
});

test('shortlist keeps search uncertainty and structured campaign evidence distinct', async () => {
  const { client, requests } = transport([
    { body: { data: [candidate], search_id: id }, credits: '27' },
    { body: { data: [fit] }, credits: '1' },
    {
      body: {
        data: { id, name: 'Synthetic creator', profiles: [] },
        warning: 'Synthetic partial profile',
      },
      credits: '0.1',
    },
  ]);
  const output = await buildShortlist(client, 'Home workout creators');
  assert.equal(requests.length, 3);
  assert.equal(output.creditsCharged, '28.10');
  assert.equal(output.candidates[0]?.search.primary_profile, null);
  assert.equal(output.candidates[0]?.search.location_unverified, true);
  assert.equal(output.candidates[0]?.campaign.reasons[0]?.provenance, 'inferred');
  assert.equal(output.candidates[0]?.warning, 'Synthetic partial profile');
});

test('lookalikes remain bounded and empty results do not trigger matching', async () => {
  const { client, requests } = transport([{ body: { data: [] }, credits: '0' }]);
  await expandLookalikes(client, 'Home workout creators', ['@Example', 'example']);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.body.limit, 5);
  assert.deepEqual(requests[0]?.body.seeds, [
    { platform: 'instagram', username: 'example', weight: 1 },
  ]);
});

test('unresolved profile list stops before matching and unknown usage stays unknown', async () => {
  const { client, requests } = transport([{ body: { data: [] } }]);
  const output = await scoreExistingList(client, 'Home workout creators', ['example']);
  assert.equal(requests.length, 1);
  assert.equal(output.creditsCharged, null);
});

test('rate-limit failure preserves status and Retry-After without retrying', async () => {
  const { client, requests } = transport([
    { status: 429, body: { error: { code: 'rate_limit_exceeded', message: 'Synthetic limit' } } },
  ]);
  await assert.rejects(buildShortlist(client, 'Home workout creators'), (error: unknown) => {
    assert.ok(error instanceof APIError);
    assert.equal(error.status, 429);
    assert.equal(error.headers?.get('retry-after'), '12');
    return true;
  });
  assert.equal(requests.length, 1);
});

test('invalid inputs fail before transport', async () => {
  const { client, requests } = transport([]);
  await assert.rejects(buildShortlist(client, 'x'));
  await assert.rejects(scoreExistingList(client, 'Home workout creators', []));
  await assert.rejects(
    expandLookalikes(client, 'Home workout creators', ['one', 'two', 'three', 'four'])
  );
  assert.equal(requests.length, 0);
});
