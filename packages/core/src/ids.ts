/** Crockford base32 alphabet used by ULIDs (no I, L, O or U). */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Number of characters encoding the millisecond timestamp (50 bits, enough for the 48-bit ULID time). */
const TIME_LENGTH = 10;

/** Number of characters encoding the random part (80 bits). */
const RANDOM_LENGTH = 16;

/** Largest value of the 80-bit random part. */
const RANDOM_MAX = (1n << 80n) - 1n;

/** Pattern of the 26-character ULID body that follows the kind prefix. */
const BODY_PATTERN = '[0-9A-HJKMNP-TV-Z]{26}';

/** Kind prefixes of identifiers; the prefix tells a reader (and a validator) what an id points at. */
export const ID_PREFIXES = [
  'prj', // project
  'chr', // character
  'loc', // location
  'prp', // prop
  'voc', // voice
  'ins', // instrument
  'scn', // scene
  'sht', // shot
  'lin', // dialogue line
  'sec', // song section
  'job', // generation job
  'art', // artifact
  'tln', // timeline
  'trk', // timeline track
  'clp', // timeline clip
] as const;

/** One of the id kind prefixes. */
export type IdPrefix = (typeof ID_PREFIXES)[number];

/** A stable identifier: kind prefix, underscore, then a sortable 26-character ULID body. */
export type Id<P extends IdPrefix = IdPrefix> = `${P}_${string}`;

/** Minimal view of the Web Crypto API, available in Node, Electron and browsers. */
declare const crypto: { getRandomValues<T extends ArrayBufferView>(array: T): T };

/** Millisecond timestamp of the previously generated id, used to keep ids monotonic. */
let lastTime = -1;

/** Random part of the previously generated id. */
let lastRandom = 0n;

/**
 * Encodes a non-negative integer as fixed-width Crockford base32.
 * @param value Value to encode.
 * @param length Number of output characters.
 */
function encode(value: bigint, length: number): string {
  let out = '';
  let rest = value;
  for (let i = 0; i < length; i++) {
    out = ALPHABET.charAt(Number(rest & 31n)) + out;
    rest >>= 5n;
  }
  return out;
}

/** Draws 80 random bits from the platform's secure random source. */
function randomBits(): bigint {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return bytes.reduce((acc, byte) => (acc << 8n) | BigInt(byte), 0n);
}

/**
 * Creates a new identifier. Ids sort by creation time and are strictly increasing within one process, even when
 * several are created in the same millisecond. They are never reused.
 * @param prefix Kind of object the id will identify.
 * @param now Timestamp in milliseconds; only tests should pass it.
 */
export function newId<P extends IdPrefix>(prefix: P, now: number = Date.now()): Id<P> {
  let time = now;
  if (time <= lastTime) {
    time = lastTime;
    lastRandom = (lastRandom + 1n) & RANDOM_MAX;
  } else {
    lastTime = time;
    lastRandom = randomBits();
  }
  return `${prefix}_${encode(BigInt(time), TIME_LENGTH)}${encode(lastRandom, RANDOM_LENGTH)}`;
}

/**
 * Regular expression matching ids of one kind.
 * @param prefix Kind prefix the id must carry.
 */
export function idPattern(prefix: IdPrefix): RegExp {
  return new RegExp(`^${prefix}_${BODY_PATTERN}$`);
}

/**
 * Tells whether a value is a well-formed id of the given kind.
 * @param value Value to test.
 * @param prefix Kind prefix the id must carry.
 */
export function isId<P extends IdPrefix>(value: unknown, prefix: P): value is Id<P> {
  return typeof value === 'string' && idPattern(prefix).test(value);
}
