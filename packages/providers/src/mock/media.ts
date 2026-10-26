import { deflateSync } from 'node:zlib';
import { PLACEHOLDER_VIDEO_BASE64 } from './placeholder-video';

/** CRC-32 lookup table used by PNG chunks. */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

/**
 * CRC-32 of a byte array, as PNG requires.
 * @param bytes Data to checksum.
 */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Builds one PNG chunk.
 * @param type Four-letter chunk type.
 * @param data Chunk payload.
 */
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * Deterministic 32-bit hash of a string (FNV-1a); used to derive colours, tones and references from prompts.
 * @param text Text to hash.
 */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return hash;
}

/**
 * Creates a PNG with a diagonal gradient whose colours depend on a seed, so different prompts look different.
 * @param seed Any integer; the same seed always gives the same image.
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 */
export function gradientPng(seed: number, width = 256, height = 144): Uint8Array {
  const a = [seed & 255, (seed >>> 8) & 255, (seed >>> 16) & 255];
  const b = [255 - a[2]!, 255 - a[0]!, 255 - a[1]!];
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const t = (x / width + y / height) / 2;
      for (let c = 0; c < 3; c++)
        rows[row + 1 + x * 3 + c] = Math.round(a[c]! + (b[c]! - a[c]!) * t);
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const parts = [
    Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', new Uint8Array(0)),
  ];
  return Uint8Array.from(Buffer.concat(parts));
}

/**
 * Creates a mono 16-bit WAV file containing a sine tone.
 * @param seed Any integer; selects the pitch (220-880 Hz).
 * @param seconds Length of the tone.
 * @param sampleRate Samples per second.
 */
export function tonedWav(seed: number, seconds: number, sampleRate = 16000): Uint8Array {
  const frequency = 220 + (seed % 660);
  const samples = Math.max(1, Math.round(seconds * sampleRate));
  const out = new Uint8Array(44 + samples * 2);
  const view = new DataView(out.buffer);
  const text = (offset: number, s: string): void => {
    for (let i = 0; i < s.length; i++) out[offset + i] = s.charCodeAt(i);
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    const fade = Math.min(1, i / 400, (samples - i) / 400);
    view.setInt16(
      44 + i * 2,
      Math.round(Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 9000 * fade),
      true,
    );
  }
  return out;
}

/** The embedded placeholder clip, decoded. */
export function placeholderVideo(): Uint8Array {
  return Uint8Array.from(Buffer.from(PLACEHOLDER_VIDEO_BASE64, 'base64'));
}
