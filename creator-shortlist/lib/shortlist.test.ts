import assert from 'node:assert/strict';
import { test } from 'node:test';
import type Influship from 'influship';
import { isSameOrigin, parseBrief, toCandidates, toCsv } from './shortlist.ts';

test('checks the browser origin against the incoming host, including a local port', () => {
  assert.equal(isSameOrigin('http://127.0.0.1:3441', '127.0.0.1:3441'), true);
  assert.equal(isSameOrigin('http://localhost:3000', 'localhost:3000'), true);
  assert.equal(isSameOrigin('https://other.example', 'localhost:3000'), false);
  assert.equal(isSameOrigin('http://localhost:3001', 'localhost:3000'), false);
  assert.equal(isSameOrigin(null, 'localhost:3000'), false);
  assert.equal(isSameOrigin('null', 'localhost:3000'), false);
});

test('rejects briefs outside the API limit before making a request', () => {
  assert.equal(parseBrief({ query: 'fitness' }), null);
  assert.equal(parseBrief('  '), null);
  assert.equal(parseBrief('a'.repeat(501)), null);
  assert.equal(parseBrief(' fitness '), 'fitness');
  assert.equal(parseBrief('a'.repeat(500))?.length, 500);
});

test('keeps unknown metrics and retrieval fallback distinct from AI ranking', () => {
  const response: Influship.SearchCreateResponse = {
    search_id: 'synthetic-search',
    total: 1,
    has_more: false,
    next_cursor: null,
    data: [
      {
        creator: {
          id: 'synthetic-creator',
          name: '=HYPERLINK("bad")',
          bio: null,
          avatar_url: null,
        },
        relevant_profile: null,
        primary_profile: null,
        location_unverified: true,
        match: {
          score: 0.4,
          confidence: 0.4,
          evidence: [],
          reasons: ['Needs review'],
          low_confidence: true,
          ranking_source: 'retrieval_fallback',
        },
      },
    ],
  };
  const candidates = toCandidates(response);
  assert.equal(candidates[0]?.followers, null);
  assert.equal(candidates[0]?.engagementRate, null);
  assert.equal(candidates[0]?.rankingSource, 'retrieval_fallback');
  assert.equal(candidates[0]?.locationUnverified, true);
  assert.equal(candidates[0]?.lowConfidence, true);
  const csv = toCsv(candidates);
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('retrieval_fallback'));
  assert.ok(csv.includes('Needs review'));
});

test('quotes commas, line breaks and formula prefixes in CSV cells', () => {
  const csv = toCsv([
    {
      id: 'synthetic',
      name: 'Example, Creator',
      username: ' +SUM(1,2)',
      followers: 0,
      engagementRate: 0,
      score: 0.8,
      rankingSource: 'reranked',
      locationUnverified: false,
      lowConfidence: false,
      reasons: ['Line one\nLine two'],
    },
  ]);
  assert.ok(csv.includes('"Example, Creator"'));
  assert.ok(csv.includes('"\' +SUM(1,2)"'));
  assert.ok(csv.includes('"Line one\nLine two"'));
  assert.ok(csv.includes('"0","0"'));
});
