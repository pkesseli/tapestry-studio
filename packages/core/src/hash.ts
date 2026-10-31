import { stableStringify } from './json';

/** Minimal view of the Web Crypto API (Node, Electron and browsers). */
declare const crypto: {
  subtle: { digest(algorithm: string, data: Uint8Array): Promise<ArrayBuffer> };
};

/** Minimal view of the platform text encoder. */
declare const TextEncoder: new () => { encode(text: string): Uint8Array };

/**
 * SHA-256 of some data as lowercase hex.
 * @param data Bytes, or text (hashed as UTF-8).
 */
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash of any JSON-compatible value, independent of key order. Used to recognise identical requests.
 * @param value Value to hash.
 */
export function hashJson(value: unknown): Promise<string> {
  return sha256Hex(stableStringify(value));
}
