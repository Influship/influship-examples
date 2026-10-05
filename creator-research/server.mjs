import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);
const localHostPattern = /^(127\.0\.0\.1|localhost):\d+$/;
const usernamePattern = /^[\p{L}\p{N}_.-]{1,50}$/u;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invalid(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
function text(value, name, max, required = true) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw invalid(`${name} must be ${required ? '1' : '0'}–${max} characters.`);
  }
  return required ? value.trim() : value;
}
async function readJSON(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw invalid('Send application/json.', 415);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16_384) {
      throw invalid('Request is too large.', 413);
    }
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw invalid('Expected an object.');
    }
    return body;
  } catch {
    throw invalid('Expected a JSON object.');
  }
}
function shortlist(body) {
  if (!Array.isArray(body.profiles) || body.profiles.length < 1 || body.profiles.length > 8) {
    throw invalid('Choose 1–8 Instagram profiles.');
  }
  const profiles = body.profiles.map((profile) => {
    const username = text(profile?.username, 'Username', 50).toLowerCase();
    if (profile.platform !== 'instagram' || !usernamePattern.test(username)) {
      throw invalid('Choose valid Instagram profiles.');
    }
    return { platform: 'instagram', username };
  });
  if (new Set(profiles.map((p) => p.username)).size !== profiles.length) {
    throw invalid('Choose each profile once.');
  }
  return {
    name: text(body.name, 'Name', 80),
    brief: text(body.brief, 'Brief', 500),
    notes: text(body.notes ?? '', 'Notes', 2000, false),
    profiles,
  };
}

function localOrigin(req) {
  // Local-only host and origin checks protect the server-held API key.
  if (!localHostPattern.test(req.headers.host ?? '')) {
    throw invalid('Open the app on localhost.', 403);
  }
  const origin = `http://${req.headers.host}`;
  if (
    (req.headers.origin && req.headers.origin !== origin) ||
    (req.method === 'POST' && req.headers.origin !== origin)
  ) {
    throw invalid('Use the app from its own local address.', 403);
  }
  return origin;
}

async function operation(req, path) {
  let upstream;
  let body;
  if (path === '/api/search' && req.method === 'POST') {
    const input = await readJSON(req);
    body = { query: text(input.query, 'Brief', 500), limit: 5 };
    upstream = '/v1/search';
  } else if (path === '/api/shortlists' && req.method === 'POST') {
    body = shortlist(await readJSON(req));
    upstream = '/v1/shortlists';
  } else if (path === '/api/shortlists' && req.method === 'GET') {
    upstream = '/v1/shortlists';
  } else if (
    path.startsWith('/api/shortlists/') &&
    req.method === 'GET' &&
    idPattern.test(path.slice(16))
  ) {
    upstream = `/v1/shortlists/${path.slice(16)}`;
  } else {
    throw invalid('Route not found.', 404);
  }
  return { upstream, body };
}

async function forward({ apiKey, fetchImpl, upstream, body, res, send }) {
  // Send once: a timed-out paid search or shortlist create can have completed.
  const response = await fetchImpl(`https://api.influship.com${upstream}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-API-Key': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60_000),
    redirect: 'error',
  });
  const payload = await response.json();
  for (const header of ['x-credits-charged', 'retry-after', 'x-request-id']) {
    const value = response.headers.get(header);
    if (value) {
      res.setHeader(header, value);
    }
  }
  send(response.status, payload);
}

export function createAppServer({ apiKey, fetchImpl = fetch }) {
  if (!apiKey) {
    throw new Error('Set INFLUSHIP_API_KEY before starting the app.');
  }
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    );
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(body));
    };
    try {
      const path = new URL(req.url, localOrigin(req)).pathname;
      if (req.method === 'GET' && assets.has(path)) {
        const [file, type] = assets.get(path);
        const content = await readFile(new URL(file, import.meta.url));
        res.writeHead(200, { 'Content-Type': type });
        res.end(content);
        return;
      }
      const { upstream, body } = await operation(req, path);
      await forward({ apiKey, fetchImpl, upstream, body, res, send });
    } catch (error) {
      const status = error.status ?? 502;
      send(status, {
        error: {
          code: status === 502 ? 'request_incomplete' : 'invalid_request',
          message:
            status === 502
              ? 'The request could not be completed. Check saved lists before retrying a save; another search can be billed.'
              : error.message,
        },
      });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number(process.env.PORT ?? 3344);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be 1–65535.');
  }
  const server = createAppServer({ apiKey: process.env.INFLUSHIP_API_KEY });
  server.listen(port, '127.0.0.1', () => console.log(`Open http://127.0.0.1:${port}`));
}
