# Influship cookbook workflows

Three bounded TypeScript programs using the [published SDK](https://docs.influship.com/sdks). Requires Node.js 22+ and pnpm 10.32.1.

```bash
pnpm install --frozen-lockfile
export INFLUSHIP_API_KEY="your_api_key_here"
pnpm shortlist "Fitness creators teaching home workouts"
pnpm lookalikes "Fitness creators teaching home workouts" your_seed_handle
pnpm score-list "Fitness creators teaching home workouts" your_first_handle your_second_handle
```

Get a key from the [developer dashboard](https://developers.influship.com). Run one command at a time after reviewing its maximum intended spend:

| Command | API stages | Maximum intended credits |
| --- | --- | ---: |
| `shortlist` | Search ten, match up to ten, expand up to three | 55.3 ($0.553) |
| `lookalikes` | Up to three equal-weight seeds, return five, match up to five | 12.5 ($0.125) |
| `score-list` | Resolve up to ten handles, match distinct resolved creators | 11 ($0.11) |

Outputs are JSON with per-stage usage headers and total charged credits. Missing headers remain unknown. Empty stages stop before dependent calls. Every command disables automatic retries. Search, similarity and campaign scores stay separate; neutral campaign results remain available for review. Profile warnings and structured evidence are preserved.

## Recipes

- [Build a shortlist](https://docs.influship.com/cookbook/build-a-shortlist)
- [Expand with lookalikes](https://docs.influship.com/cookbook/expand-with-lookalikes)
- [Score an existing list](https://docs.influship.com/cookbook/score-campaign-fit)
- [Direct handle comparison](https://docs.influship.com/cookbook/compare-creators) skips profile resolution when you do not need profile data.

Edit `workflows.ts` for the API stages and `cli.ts` for command-line output and recovery. Keys stay in the environment. See [pricing](https://docs.influship.com/concepts/pricing), [match reasons](https://docs.influship.com/concepts/match-reasons), and [error handling](https://docs.influship.com/guides/error-handling). For support, send the endpoint/status/request ID to [elliot@influship.com](mailto:elliot@influship.com); never include your key.

```bash
pnpm type-check
pnpm test
```

Tests exercise the actual SDK using synthetic HTTP responses and do not make live requests. Live result quality and billing require a separate, budgeted test. Source is MIT licensed; the license does not license API data.
