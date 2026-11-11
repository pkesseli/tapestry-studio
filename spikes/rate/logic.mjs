/** Questions asked about a final (a clip made from an accepted draft); each is answered from 1 (poor) to 5 (great). */
export const FINAL_QUESTIONS = [
  {
    key: 'composition',
    text: 'Does it frame the shot like the draft?',
    low: 'Not at all',
    high: 'Exactly',
  },
  { key: 'motion', text: 'Does it move like the draft?', low: 'Not at all', high: 'Exactly' },
  {
    key: 'identity',
    text: 'Do the people and things look like themselves?',
    low: 'Different',
    high: 'Same',
  },
  {
    key: 'smooth',
    text: 'Is it smooth, without flicker or glitches?',
    low: 'Very glitchy',
    high: 'Clean',
  },
];

/** Questions asked about a draft: can a person judge the shot from it? */
export const DRAFT_QUESTIONS = [
  { key: 'happening', text: 'Can you tell what is happening?', low: 'No idea', high: 'Clearly' },
  { key: 'acting', text: 'Can you judge the acting and mood?', low: 'Not at all', high: 'Easily' },
  {
    key: 'framing',
    text: 'Can you judge the framing and camera?',
    low: 'Not at all',
    high: 'Easily',
  },
];

/** The yes / maybe / no choice about a final. */
export const USABLE_CHOICES = [
  { value: 'yes', text: 'Yes, use it' },
  { value: 'maybe', text: 'Maybe' },
  { value: 'no', text: 'No' },
];

/**
 * The questions for a clip.
 * @param {{ role: string }} clip A clip of the manifest.
 */
export function questionsFor(clip) {
  return clip.role === 'draft' ? DRAFT_QUESTIONS : FINAL_QUESTIONS;
}

/**
 * Orders items in a repeatable but unpredictable way, so versions of a shot do not appear in the order they were made
 * (which would hint at which one is which) and the order stays the same each time the page is opened.
 * @template T
 * @param {T[]} items Items to order.
 * @param {string} seed Text that decides the order.
 * @returns {T[]} A new array.
 */
export function seededShuffle(items, seed) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Groups the clips by shot, in the order the shots are listed, with drafts first.
 * @param {{ clips: Record<string, any>[] }} manifest The manifest.
 * @param {string[]} order Shot ids in the wanted order; shots not listed come last.
 * @param {string} rater Who is rating (decides the order of versions).
 * @returns {{ shot: string, drafts: Record<string, any>[], finals: Record<string, any>[] }[]}
 */
export function groupByShot(manifest, order, rater) {
  const shots = [...new Set(manifest.clips.map((clip) => clip.shot))].sort((a, b) => {
    const rank = (id) => (order.includes(id) ? order.indexOf(id) : order.length);
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return shots.map((shot) => {
    const clips = manifest.clips.filter((clip) => clip.shot === shot);
    return {
      shot,
      drafts: seededShuffle(
        clips.filter((c) => c.role === 'draft'),
        `${rater}/${shot}/draft`,
      ),
      finals: seededShuffle(
        clips.filter((c) => c.role === 'final'),
        `${rater}/${shot}/final`,
      ),
    };
  });
}

/**
 * Records one answer.
 * @param {Record<string, any>} ratings The ratings so far.
 * @param {string} clipId Clip the answer is about.
 * @param {string} key Question key (`usable` and `notes` are also allowed).
 * @param {number | string} value The answer.
 * @returns {Record<string, any>} New ratings; the old object is not changed.
 */
export function setAnswer(ratings, clipId, key, value) {
  const clips = ratings.clips ?? {};
  return { ...ratings, clips: { ...clips, [clipId]: { ...clips[clipId], [key]: value } } };
}

/**
 * Counts the clips that have every question answered.
 * @param {Record<string, any>} ratings The ratings so far.
 * @param {Record<string, any>[]} clips Clips to count.
 * @returns {{ done: number, total: number }}
 */
export function progress(ratings, clips) {
  const done = clips.filter((clip) => {
    const answers = ratings.clips?.[clip.id] ?? {};
    const keys = [
      ...questionsFor(clip).map((q) => q.key),
      ...(clip.role === 'final' ? ['usable'] : []),
    ];
    return keys.every((key) => answers[key] !== undefined);
  }).length;
  return { done, total: clips.length };
}
