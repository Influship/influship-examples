# Influship developer examples

Maintained, runnable examples using the published [Influship TypeScript SDK](https://docs.influship.com/sdks). The example code is MIT licensed; API access and data remain subject to the service terms.

| Example | What you build | Guide |
| --- | --- | --- |
| [Creator shortlist](./creator-shortlist) | Next.js app: brief → five Instagram creators → CSV | [Setup and walkthrough](https://docs.influship.com/cookbook/creator-search-nextjs) |
| [Workflows](./workflows) | Bounded shortlist, lookalike expansion, and existing-list scoring scripts | [Recipe hub](https://docs.influship.com/cookbook) |

Each directory is standalone. Requires Node.js 22+ and pnpm 10.32.1. Read its README before running; live calls consume credits, and the examples disable automatic SDK retries. Synthetic tests require no API key.

[Get an API key](https://developers.influship.com) · [Quickstart](https://docs.influship.com/quickstart) · [Pricing](https://docs.influship.com/concepts/pricing) · [Error recovery](https://docs.influship.com/guides/error-handling) · [Build article](https://www.influship.com/blog/build-influencer-discovery-tool)

## Contributing and maintenance

This repository distributes the reviewed examples maintained in the Influship application repository. File an issue here with the example, Node version, exact command and error status/request ID. Never include an API key. For private API support, contact [elliot@influship.com](mailto:elliot@influship.com).

Changes must pass type checks and synthetic tests in both directories and the Next.js production build. API behavior still requires a real request; CI deliberately makes no paid API calls. Keep guides, source downloads and SDK links aligned when updating an example.
