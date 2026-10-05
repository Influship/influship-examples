import type Influship from 'influship';

export interface Usage {
  credits: string | null;
  stage: string;
}
const leadingAt = /^@/;
const usernamePattern = /^[a-z0-9._]{1,30}$/;

export function validateBrief(input: string): string {
  const brief = input.trim();
  if (brief.length < 3 || brief.length > 500) {
    throw new Error('Supply a campaign brief between 3 and 500 characters.');
  }
  return brief;
}

export function validateHandles(inputs: string[]): string[] {
  const handles = [...new Set(inputs.map((value) => value.replace(leadingAt, '').toLowerCase()))];
  if (
    handles.length < 1 ||
    handles.length > 10 ||
    handles.some((value) => !usernamePattern.test(value))
  ) {
    throw new Error('Supply between 1 and 10 valid Instagram handles.');
  }
  return handles;
}

function record(usage: Usage[], stage: string, response: Response) {
  usage.push({ stage, credits: response.headers.get('x-credits-charged') });
}

function total(usage: Usage[]): string | null {
  if (usage.some(({ credits }) => credits === null || !Number.isFinite(Number(credits)))) {
    return null;
  }
  return usage.reduce((sum, { credits }) => sum + Number(credits), 0).toFixed(2);
}

export async function buildShortlist(client: Influship, input: string) {
  const brief = validateBrief(input);
  const usage: Usage[] = [];
  const { data: search, response } = await client.search
    .create({
      query: brief,
      platforms: ['instagram'],
      limit: 10,
    })
    .withResponse();
  record(usage, 'search', response);
  const candidates = [
    ...new Map(search.data.slice(0, 10).map((row) => [row.creator.id, row])).values(),
  ];
  if (candidates.length === 0) {
    return { searchId: search.search_id, candidates: [], usage, creditsCharged: total(usage) };
  }
  const { data: scored, response: matchResponse } = await client.creators
    .match({
      creators: candidates.map(({ creator }) => ({ creator_id: creator.id })),
      intent: { query: brief },
    })
    .withResponse();
  record(usage, 'campaign match', matchResponse);
  const matched = new Map(scored.data.map((row) => [row.creator.id, row]));
  const ranked = candidates
    .flatMap((row) => {
      const fit = matched.get(row.creator.id);
      return fit && fit.match.decision !== 'avoid' ? [{ search: row, campaign: fit.match }] : [];
    })
    .sort((a, b) => b.campaign.score - a.campaign.score)
    .slice(0, 3);
  const expanded: Array<
    (typeof ranked)[number] & {
      creator: Awaited<ReturnType<Influship['creators']['retrieve']>>['data'];
      warning: string | null;
    }
  > = [];
  // Sequential requests keep concurrency and the maximum call budget explicit.
  for (const row of ranked) {
    const { data: creator, response: creatorResponse } = await client.creators
      .retrieve(row.search.creator.id, { include: ['profiles'] })
      .withResponse();
    record(usage, 'creator expansion', creatorResponse);
    expanded.push({ ...row, creator: creator.data, warning: creator.warning ?? null });
  }
  return { searchId: search.search_id, candidates: expanded, usage, creditsCharged: total(usage) };
}

export async function expandLookalikes(client: Influship, input: string, handlesInput: string[]) {
  const brief = validateBrief(input);
  const handles = validateHandles(handlesInput);
  if (handles.length > 3) {
    throw new Error('This bounded example accepts up to three seed handles.');
  }
  const usage: Usage[] = [];
  const { data: similar, response } = await client.creators
    .lookalike({
      seeds: handles.map((username) => ({ platform: 'instagram', username, weight: 1 })),
      limit: 5,
    })
    .withResponse();
  record(usage, 'lookalike', response);
  const candidates = [
    ...new Map(similar.data.slice(0, 5).map((row) => [row.creator.id, row])).values(),
  ];
  if (candidates.length === 0) {
    return { candidates: [], usage, creditsCharged: total(usage) };
  }
  const { data: scored, response: matchResponse } = await client.creators
    .match({
      creators: candidates.map(({ creator }) => ({ creator_id: creator.id })),
      intent: { query: brief },
    })
    .withResponse();
  record(usage, 'campaign match', matchResponse);
  const matches = new Map(scored.data.map((row) => [row.creator.id, row]));
  const ranked = candidates
    .flatMap((row) => {
      const fit = matches.get(row.creator.id);
      return fit ? [{ ...row, campaign: fit.match }] : [];
    })
    .sort((a, b) => b.campaign.score - a.campaign.score);
  return { candidates: ranked, usage, creditsCharged: total(usage) };
}

export async function scoreExistingList(client: Influship, input: string, handlesInput: string[]) {
  const brief = validateBrief(input);
  const handles = validateHandles(handlesInput);
  const usage: Usage[] = [];
  const { data: lookup, response } = await client.profiles
    .lookup({
      profiles: handles.map((username) => ({ platform: 'instagram', username })),
    })
    .withResponse();
  record(usage, 'profile lookup', response);
  const ids = [...new Set(lookup.data.flatMap((row) => (row.creator_id ? [row.creator_id] : [])))];
  if (ids.length === 0) {
    return { profiles: lookup.data, candidates: [], usage, creditsCharged: total(usage) };
  }
  const { data: scored, response: matchResponse } = await client.creators
    .match({
      creators: ids.map((creator_id) => ({ creator_id })),
      intent: { query: brief },
    })
    .withResponse();
  record(usage, 'campaign match', matchResponse);
  return {
    profiles: lookup.data,
    candidates: scored.data.sort((a, b) => b.match.score - a.match.score),
    usage,
    creditsCharged: total(usage),
  };
}
