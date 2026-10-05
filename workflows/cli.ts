import Influship, { APIError } from 'influship';
import { buildShortlist, expandLookalikes, scoreExistingList } from './workflows.ts';

const [command, brief = '', ...handles] = process.argv.slice(2);
if (!process.env.INFLUSHIP_API_KEY) {
  throw new Error(
    'Set INFLUSHIP_API_KEY in your environment. See https://docs.influship.com/quickstart'
  );
}
const client = new Influship({ maxRetries: 0, timeout: 60_000 });
try {
  let output: unknown;
  if (command === 'shortlist') {
    output = await buildShortlist(client, brief);
  } else if (command === 'lookalikes') {
    output = await expandLookalikes(client, brief, handles);
  } else if (command === 'score-list') {
    output = await scoreExistingList(client, brief, handles);
  } else {
    throw new Error('Choose shortlist, lookalikes, or score-list.');
  }
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  if (error instanceof APIError) {
    console.error(
      JSON.stringify({
        status: error.status,
        retryAfter: error.headers?.get('retry-after') ?? null,
        requestId: error.headers?.get('x-request-id') ?? null,
        recovery:
          'See https://docs.influship.com/guides/error-handling. No automatic retry was made.',
      })
    );
  } else {
    console.error(error instanceof Error ? error.message : 'The workflow failed.');
  }
  process.exitCode = 1;
}
