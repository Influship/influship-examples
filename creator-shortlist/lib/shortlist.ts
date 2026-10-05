import type Influship from 'influship';

export interface Candidate {
  engagementRate: number | null;
  followers: number | null;
  id: string;
  locationUnverified: boolean;
  lowConfidence: boolean;
  name: string;
  rankingSource: 'reranked' | 'retrieval_fallback';
  reasons: string[];
  score: number;
  username: string | null;
}

export interface Shortlist {
  candidates: Candidate[];
  creditsCharged: string | null;
  searchId: string;
}

export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!(origin && host)) {
    return false;
  }
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.host === host;
  } catch {
    return false;
  }
}

export function parseBrief(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const brief = value.trim();
  return brief.length >= 3 && brief.length <= 500 ? brief : null;
}

export function toCandidates(response: Influship.SearchCreateResponse): Candidate[] {
  return response.data.map(
    ({ creator, relevant_profile, primary_profile, match, location_unverified }) => {
      const profile = relevant_profile ?? primary_profile;
      return {
        id: creator.id,
        name: creator.name,
        username: profile?.username ?? null,
        followers: profile?.followers ?? null,
        engagementRate: profile?.engagement_rate ?? null,
        score: match.score,
        rankingSource: match.ranking_source ?? 'reranked',
        reasons: match.reasons,
        locationUnverified: location_unverified === true,
        lowConfidence: match.low_confidence,
      };
    }
  );
}

const FORMULA_PREFIX = /^[\s]*[=+\-@]/;

function csvCell(value: string | number | null): string {
  let text = value === null ? '' : String(value);
  // Creator names, handles, and reasons are untrusted spreadsheet input.
  if (FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

export function toCsv(candidates: Candidate[]): string {
  const header = [
    'Name',
    'Instagram handle',
    'Followers',
    'Engagement %',
    'Score',
    'Ranking source',
    'Location unverified',
    'Low confidence',
    'Reasons',
  ];
  const rows = candidates.map((candidate) => [
    candidate.name,
    candidate.username,
    candidate.followers,
    candidate.engagementRate,
    candidate.score,
    candidate.rankingSource,
    String(candidate.locationUnverified),
    String(candidate.lowConfidence),
    candidate.reasons.join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
