import { seededShuffle } from '../rate/logic.mjs';

/** Folder, relative to the served root, where blind comparison answers are stored (one file per person). */
export const COMPARE_DIR = 'draft-final/results/compare';

/**
 * The decision rule of the blind comparison, a proposal until the human confirms it: the enlarged draft is a real
 * option when it is as good as a direct render (or better) in at least this many shots.
 */
export const COMPARE_RULE = {
  /** Shots (of the ten) where the enlarged draft must win or tie. */
  shotsNeeded: 7,
};

/**
 * Which version is shown on which side for one person and shot. The order is repeatable (the same each time the page is
 * opened) but unpredictable, so neither version is always on the left.
 * @param {string} shot Shot id.
 * @param {string} rater Person rating.
 * @returns {['direct' | 'upscaled', 'direct' | 'upscaled']} The versions on side A and side B.
 */
export function sidesFor(shot, rater) {
  return seededShuffle(['direct', 'upscaled'], `${rater}/${shot}/compare`);
}

/**
 * Turns a choice of side into the version that won.
 * @param {string} shot Shot id.
 * @param {string} rater Person rating.
 * @param {'A' | 'B' | 'same'} choice What the person picked.
 * @returns {'direct' | 'upscaled' | 'tie'} The winner.
 */
export function winnerOf(shot, rater, choice) {
  if (choice === 'same') return 'tie';
  const [a, b] = sidesFor(shot, rater);
  return choice === 'A' ? a : b;
}

/**
 * Counts, per person, how the ten shots went and applies the decision rule.
 * @param {string[]} shots The shot ids compared.
 * @param {Record<string, { answers?: Record<string, { choice?: string }> }>} raters Answers by person.
 * @returns {Record<string, { direct: string[], upscaled: string[], tie: string[], unanswered: string[],
 *   notWorse: number, passes: boolean }>} Shots by winner for each person. `notWorse` counts the shots where the
 * enlarged draft won or tied.
 */
export function tally(shots, raters) {
  return Object.fromEntries(
    Object.entries(raters).map(([rater, data]) => {
      const result = { direct: [], upscaled: [], tie: [], unanswered: [] };
      for (const shot of shots) {
        const choice = data.answers?.[shot]?.choice;
        if (choice === 'A' || choice === 'B' || choice === 'same') {
          result[winnerOf(shot, rater, choice)].push(shot);
        } else result.unanswered.push(shot);
      }
      const notWorse = result.upscaled.length + result.tie.length;
      return [rater, { ...result, notWorse, passes: notWorse >= COMPARE_RULE.shotsNeeded }];
    }),
  );
}
