import { request } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { RATINGS_DIR, createRatingServer } from './server.mjs';

let root;
let server;
let base;
let port;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'spike-serve-'));
  mkdirSync(join(root, 'rate'), { recursive: true });
  writeFileSync(join(root, 'rate', 'index.html'), '<h1>rate</h1>');
  writeFileSync(join(root, 'clip.mp4'), '0123456789');
  writeFileSync(join(tmpdir(), 'spike-secret.txt'), 'secret');
  server = createRatingServer(root);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = server.address().port;
  base = `http://localhost:${port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

/**
 * Sends a raw request, so the path and Host header are exactly as given.
 * @param {string} path Request path.
 * @param {Record<string, string>} [headers] Extra headers.
 * @param {string} [method] HTTP method.
 */
const raw = (path, headers = {}, method = 'GET') =>
  new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, path, method, headers: { host: `localhost:${port}`, ...headers } },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
      },
    );
    req.on('error', reject);
    req.end();
  });

test('the start page is the rating page, and files are served', async () => {
  const start = await raw('/');
  expect([start.status, start.headers.location]).toEqual([302, '/rate/index.html']);
  expect(await (await fetch(`${base}/rate/index.html`)).text()).toBe('<h1>rate</h1>');
  expect((await fetch(`${base}/missing.mp4`)).status).toBe(404);
});

test('video ranges are answered, which Safari needs to play a clip', async () => {
  const res = await raw('/clip.mp4', { range: 'bytes=2-5' });
  expect(res.status).toBe(206);
  expect(res.body).toBe('2345');
  expect(res.headers['content-range']).toBe('bytes 2-5/10');
  expect((await raw('/clip.mp4', { range: 'bytes=50-60' })).status).toBe(416);
});

test('nothing outside the served folder can be read, and other host names are refused', async () => {
  for (const path of [
    '/%2e%2e/spike-secret.txt',
    '/..%2f..%2fspike-secret.txt',
    '/../spike-secret.txt',
  ]) {
    const res = await raw(path);
    expect([403, 404], path).toContain(res.status);
    expect(res.body, path).not.toContain('secret');
  }
  expect((await raw('/clip.mp4', { host: 'evil.example.com' })).status).toBe(403);
});

test('ratings are stored per person and can be read back', async () => {
  const post = await fetch(`${base}/api/ratings/maria`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clips: { a: { composition: 5 } } }),
  });
  expect(post.status).toBe(200);
  const file = join(root, RATINGS_DIR, 'maria.json');
  expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({
    rater: 'maria',
    clips: { a: { composition: 5 } },
  });
  expect(await (await fetch(`${base}/api/ratings/maria`)).json()).toMatchObject({
    clips: { a: { composition: 5 } },
  });
  expect(await (await fetch(`${base}/api/ratings/nobody`)).json()).toEqual({});
});

test('bad names and bad bodies are refused and nothing is written', async () => {
  const bad = await fetch(`${base}/api/ratings/${encodeURIComponent('../evil')}`, {
    method: 'POST',
    body: '{}',
  });
  expect(bad.status).toBe(400);
  const notJson = await fetch(`${base}/api/ratings/tom`, { method: 'POST', body: 'nope' });
  expect(notJson.status).toBe(400);
  const list = await fetch(`${base}/api/ratings/tom`, { method: 'POST', body: '[1]' });
  expect(list.status).toBe(400);
  expect(existsSync(join(root, RATINGS_DIR, 'tom.json'))).toBe(false);
  expect((await fetch(`${base}/clip.mp4`, { method: 'POST', body: '' })).status).toBe(405);
});
