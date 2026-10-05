import Influship, { APIError } from 'influship';
import { isSameOrigin, parseBrief, toCandidates } from '../../../lib/shortlist';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // This starter runs locally. Do not put a paid API key behind a public,
  // unauthenticated endpoint; add your app's auth and per-user budgets first.
  if (!isSameOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return Response.json(
      { error: 'This request must come from the shortlist app.' },
      { status: 403 }
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Send a JSON campaign brief.' }, { status: 400 });
  }
  const brief = parseBrief(body && typeof body === 'object' && 'brief' in body ? body.brief : null);
  if (!brief) {
    return Response.json(
      { error: 'Enter a campaign brief between 3 and 500 characters.' },
      { status: 400 }
    );
  }
  if (!process.env.INFLUSHIP_API_KEY) {
    return Response.json(
      { error: 'Set INFLUSHIP_API_KEY in .env.local and restart the app.' },
      { status: 503 }
    );
  }

  try {
    const client = new Influship({ maxRetries: 0, timeout: 60_000 });
    const { data, response } = await client.search
      .create({
        query: brief,
        platforms: ['instagram'],
        limit: 5,
      })
      .withResponse();
    return Response.json({
      candidates: toCandidates(data),
      searchId: data.search_id,
      creditsCharged: response.headers.get('x-credits-charged'),
    });
  } catch (error) {
    if (error instanceof APIError) {
      const messages: Record<number, string> = {
        400: 'The API could not accept this brief. Review it and try again.',
        401: 'The API key was rejected. Check the server configuration.',
        402: 'The account needs more credits or a billing action. Check the dashboard.',
        403: 'This API key does not have permission to search.',
        429: 'The account is rate limited. Wait before submitting another search.',
      };
      const retryAfter = error.headers?.get('retry-after');
      return Response.json(
        {
          error:
            messages[error.status ?? 0] ?? 'Search is temporarily unavailable. Try again later.',
        },
        {
          status: error.status && error.status >= 400 && error.status < 600 ? error.status : 502,
          headers: retryAfter ? { 'Retry-After': retryAfter } : undefined,
        }
      );
    }
    return Response.json(
      { error: 'The search did not complete. Try again later.' },
      { status: 502 }
    );
  }
}
