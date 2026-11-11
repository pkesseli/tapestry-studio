import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';

/** Media types of the files the rating page loads. */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.css': 'text/css; charset=utf-8',
};

/** Largest ratings upload accepted, in bytes. */
const MAX_BODY = 1024 * 1024;

/** A rater's name as used in a file name. */
const RATER = /^[a-z0-9][a-z0-9-]{0,30}$/;

/** Where ratings are stored, relative to the served folder. */
export const RATINGS_DIR = join('draft-final', 'results', 'ratings');

/**
 * Sends a JSON answer.
 * @param {import('node:http').ServerResponse} res The response.
 * @param {number} status HTTP status.
 * @param {unknown} body Value to send.
 */
function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': TYPES['.json'], 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

/**
 * Sends a file, honouring `Range` requests (Safari will not play a video without them).
 * @param {import('node:http').IncomingMessage} req The request.
 * @param {import('node:http').ServerResponse} res The response.
 * @param {string} file Absolute path of an existing file.
 */
function sendFile(req, res, file) {
  const { size } = statSync(file);
  const type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      res.writeHead(416, { 'content-range': `bytes */${size}` });
      res.end();
      return;
    }
    res.writeHead(206, {
      'content-type': type,
      'accept-ranges': 'bytes',
      'content-range': `bytes ${start}-${end}/${size}`,
      'content-length': end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': size });
  createReadStream(file).pipe(res);
}

/**
 * Reads a request body, refusing anything large.
 * @param {import('node:http').IncomingMessage} req The request.
 * @returns {Promise<string>} The body text.
 */
function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let text = '';
    req.on('data', (chunk) => {
      text += chunk;
      if (text.length > MAX_BODY) {
        reject(new Error('too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolveBody(text));
    req.on('error', reject);
  });
}

/**
 * A small local web server for the rating page: it serves the `spikes/` folder (read only) and stores each person's
 * ratings under `draft-final/results/ratings/`. It only answers requests addressed to localhost, so a web page on the
 * internet cannot reach it through the browser.
 * @param {string} root The folder to serve (the `spikes/` folder).
 * @returns {import('node:http').Server} The server, not yet listening.
 */
export function createRatingServer(root) {
  const base = resolve(root);
  return createServer(async (req, res) => {
    try {
      const host = (req.headers.host ?? '').replace(/:\d+$/, '');
      if (!['localhost', '127.0.0.1'].includes(host))
        return sendJson(res, 403, { error: 'localhost only' });
      const url = new URL(req.url ?? '/', 'http://localhost');
      const rating = /^\/api\/ratings\/([^/]+)$/.exec(url.pathname);
      if (rating) {
        const rater = decodeURIComponent(rating[1]);
        if (!RATER.test(rater))
          return sendJson(res, 400, { error: 'use lower-case letters, digits and dashes' });
        const file = join(base, RATINGS_DIR, `${rater}.json`);
        if (req.method === 'GET') {
          return sendJson(res, 200, existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});
        }
        if (req.method === 'POST') {
          const data = JSON.parse(await readBody(req));
          if (typeof data !== 'object' || data === null || Array.isArray(data))
            throw new Error('not an object');
          mkdirSync(join(base, RATINGS_DIR), { recursive: true });
          writeFileSync(
            file,
            `${JSON.stringify({ ...data, rater, updatedAt: new Date().toISOString() }, null, 2)}\n`,
          );
          return sendJson(res, 200, { ok: true });
        }
        return sendJson(res, 405, { error: 'GET or POST only' });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD')
        return sendJson(res, 405, { error: 'read only' });
      if (url.pathname === '/') {
        // The page loads its script by a relative address, so it must be opened at its own folder.
        res.writeHead(302, { location: '/rate/index.html' });
        return res.end();
      }
      const path = resolve(base, `.${decodeURIComponent(url.pathname)}`);
      if (path !== base && !path.startsWith(base + sep))
        return sendJson(res, 403, { error: 'outside the folder' });
      if (!existsSync(path) || !statSync(path).isFile())
        return sendJson(res, 404, { error: 'not found' });
      return sendFile(req, res, path);
    } catch (error) {
      return sendJson(res, 400, { error: String(error.message) });
    }
  });
}
