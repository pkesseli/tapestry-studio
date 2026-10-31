import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { Readable } from 'node:stream';
import { MEDIA_SCHEME } from '../shared/media-url';

/** Only files inside an artifact folder are served: `artifacts/<artifact id>/<file name>`. */
const MEDIA_PATH = /^artifacts\/art_[0-9A-Z]{26}\/[A-Za-z0-9._-]+$/;

/** Content types of the media files the project can hold. */
const CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
};

/**
 * Turns a media URL into a project-relative path, refusing anything outside the artifact folders.
 * @param url Request URL (`tapestry-media://project/artifacts/art_…/clip.mp4`).
 * @returns The relative path, or `undefined` when the URL is not an allowed media path.
 */
export function mediaPathOf(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== `${MEDIA_SCHEME}:`) return undefined;
  const path = decodeURIComponent(parsed.pathname).replace(/^\//, '');
  return MEDIA_PATH.test(path) ? path : undefined;
}

/**
 * Reads a `Range` header.
 * @param header Value of the header, or `null` when absent.
 * @param size File size in bytes.
 * @returns Inclusive byte range, `null` when no range was asked for, or `'invalid'` when it cannot be satisfied.
 */
export function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null | 'invalid' {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid';
  const start = match[1] === '' ? size - Number(match[2]) : Number(match[1]);
  const end = match[1] === '' || match[2] === '' ? size - 1 : Math.min(Number(match[2]), size - 1);
  return start < 0 || start > end || start >= size ? 'invalid' : { start, end };
}

/**
 * Answers a media request from the project folder, with support for the range requests video players make.
 * @param projectFolder Absolute path of the open project.
 * @param request The incoming request.
 */
export async function serveMedia(projectFolder: string, request: Request): Promise<Response> {
  const relative = mediaPathOf(request.url);
  if (!relative) return new Response('Not found', { status: 404 });
  const file = join(projectFolder, relative);
  let size: number;
  try {
    size = (await stat(file)).size;
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const range = parseRange(request.headers.get('range'), size);
  if (range === 'invalid') {
    return new Response('Range not satisfiable', {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    });
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  const body = Readable.toWeb(createReadStream(file, { start, end })) as unknown as ReadableStream;
  return new Response(body, {
    status: range ? 206 : 200,
    headers: {
      'Content-Type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
      ...(range && { 'Content-Range': `bytes ${start}-${end}/${size}` }),
    },
  });
}
