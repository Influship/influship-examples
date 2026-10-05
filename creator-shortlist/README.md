# Influship creator shortlist

A runnable Next.js example: enter a campaign brief, review up to five Instagram creators with search relevance and match reasons, and export a CSV. Uses the published [Influship TypeScript SDK](https://docs.influship.com/sdks). No database or account system is required to run locally.

[Setup guide](https://docs.influship.com/cookbook/creator-search-nextjs) · [Get an API key](https://developers.influship.com) · [SDK source](https://github.com/Influship/influship-sdk-typescript) · [More recipes](https://docs.influship.com/cookbook)

## Run locally

Requires Node.js 22+ and pnpm 10.32.1.

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Set `INFLUSHIP_API_KEY` in `.env.local` using a key from the [developer dashboard](https://developers.influship.com), then run:

```bash
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Keep the key on the server; never prefix it with `NEXT_PUBLIC_`.

Submit the default brief. A successful search shows up to five cards, relevance labels and explanations, the actual charged credits, and an export button when candidates exist. An empty response shows guidance to broaden the brief. These are live API results; the app does not ship with demo records.

Each submission makes one `POST /v1/search` request with `limit: 5`. Five delivered results cost 35 credits ($0.35). Fewer results cost less. See [pricing](https://docs.influship.com/concepts/pricing). CSV export uses the response already in the browser and makes no additional API request. Automatic SDK retries are disabled so the example does not repeat billable searches without a new submission.

## What is included

- Server-side API client and 3–500 character brief validation.
- Loading, empty, missing-key, billing, rate-limit and service-error states.
- Names, handles, nullable metrics, search explanations and CSV export.
- Per-result ranking-source labels, low-confidence markers and location verification warnings.
- Actual charged credits from the API response header.

Scores describe relevance to a query, not conversion probability or expected campaign ROI. Search reasons are plain strings; campaign-match reasons use structured objects. Unknown profile metrics remain unknown rather than becoming zero.

## Where to start in the code

| File | Responsibility |
| --- | --- |
| `app/page.tsx` | Brief form, loading/error/results states, and CSV download |
| `app/api/search/route.ts` | Input checks, server-only SDK call, API errors and Retry-After |
| `lib/shortlist.ts` | Response mapping and CSV quoting/formula protection |
| `lib/shortlist.test.ts` | Synthetic checks; no live requests |

Reuse the route handler in an existing Next.js project and adapt it to your authentication and spending controls. Reuse the mapping helper with your own UI. See the [API reference](https://docs.influship.com/api-reference) for the response contract.

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| Missing API key | Set `INFLUSHIP_API_KEY` in `.env.local`, then restart the server. |
| Invalid key or permission error | Check your key in the [dashboard](https://developers.influship.com) and read [authentication](https://docs.influship.com/guides/authentication). |
| Insufficient credits | Check your balance and [pricing](https://docs.influship.com/concepts/pricing). |
| Rate limit or temporary failure | Read [error recovery](https://docs.influship.com/guides/error-handling) before submitting again. |
| No results | Broaden the brief using the [search guidance](https://docs.influship.com/concepts/semantic-search). |

For API support, include the endpoint, HTTP status, and request ID when available in a message to [elliot@influship.com](mailto:elliot@influship.com). Do not include your key.

## Checks

```bash
pnpm type-check
pnpm test
pnpm build
```

The tests use synthetic records and do not call Influship. A build and those tests do not verify account access, live search availability, or result quality. Submit a real brief with your own key to verify those paths.

## Before hosting

This example binds its dev and production server to `127.0.0.1`. It is a local starter, not a hosted multi-user service. Before exposing the search route, add authentication, per-user request and spending limits, and a deployment-specific origin check. A same-origin check does not replace authentication. Never publish an unrestricted endpoint backed by your paid API key.

## Documentation and license

- [Quickstart](https://docs.influship.com/quickstart): make your first API request.
- [TypeScript SDK](https://docs.influship.com/sdks): client setup and typed errors.
- [Build a shortlist](https://docs.influship.com/cookbook/build-a-shortlist): add campaign scoring and profile expansion.
- [Compare known creators](https://docs.influship.com/cookbook/compare-creators): score handles directly.
- [Lookalikes](https://docs.influship.com/cookbook/expand-with-lookalikes): expand an existing roster.
- [CSV script](https://docs.influship.com/cookbook/export-shortlist-csv): export without a browser app.

The example source is MIT licensed. The API service and creator data are subject to Influship's service terms; the example license does not license API data.
