import { expect, test } from 'vitest';
import { RULE, renderSummary, summarize } from './summary.mjs';

/** Ten shot ids. */
const shots = Array.from({ length: 10 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);

/**
 * A manifest with a normal draft per shot and a final per shot for each given variant.
 * @param {string[]} variants Ways of making finals.
 * @param {number} [seconds] Time to make each final.
 */
const manifest = (variants, seconds = 300) => ({
  clips: [
    ...shots.map((shot) => ({
      id: `D-${shot}`,
      shot,
      role: 'draft',
      variant: 'normal',
      file: 'd.mp4',
    })),
    ...variants.flatMap((variant) =>
      shots.map((shot) => ({
        id: `F-${shot}-${variant}`,
        shot,
        role: 'final',
        variant,
        source: `D-${shot}`,
        file: 'f.mp4',
        seconds,
      })),
    ),
  ],
});

/**
 * A rater who gives every listed clip the same scores.
 * @param {string[]} ids Clips rated.
 * @param {number} score Score for finals.
 * @param {number} [draftScore] Score for drafts.
 */
const rater = (ids, score, draftScore = 5) => ({
  clips: {
    ...Object.fromEntries(
      ids.map((id) => [
        id,
        { composition: score, motion: score, identity: score, smooth: score, usable: 'yes' },
      ]),
    ),
    ...Object.fromEntries(
      shots.map((s) => [
        `D-${s}`,
        { happening: draftScore, acting: draftScore, framing: draftScore },
      ]),
    ),
  },
});

test('a way of making finals that keeps everything for enough shots, fast enough, is adopted', () => {
  const m = manifest(['B']);
  const raters = [
    rater(
      m.clips.map((c) => c.id),
      5,
    ),
  ];
  const result = summarize({ manifest: m, measures: {}, raters, shots });
  expect(result.variants.B).toMatchObject({ shotsPassing: 10, passes: true });
  expect(result.adopted).toEqual(['B']);
  expect(result.legible).toEqual(['normal']);
});

test('it is not adopted when scores are low, when too few shots pass, or when it is too slow', () => {
  const m = manifest(['B']);
  const ids = m.clips.map((c) => c.id);
  const low = summarize({
    manifest: m,
    measures: {},
    raters: [rater(ids, RULE.keptScore - 1)],
    shots,
  });
  expect(low.adopted).toEqual([]);

  const slow = manifest(['B'], RULE.maxFinalSeconds + 1);
  const slowRaters = [
    rater(
      slow.clips.map((c) => c.id),
      5,
    ),
  ];
  expect(summarize({ manifest: slow, measures: {}, raters: slowRaters, shots }).adopted).toEqual(
    [],
  );

  const unrated = rater(
    ids.filter((id) => !/^F-S0[1-3]/.test(id)),
    5,
  );
  const few = summarize({ manifest: m, measures: {}, raters: [unrated], shots });
  expect(few.variants.B.shotsPassing).toBe(7);
  expect(few.adopted).toEqual([]);
});

test('the median of several raters decides, and measurements are carried through', () => {
  const m = manifest(['C']);
  const ids = m.clips.map((c) => c.id);
  const measures = { 'F-S01-C': { ssimToDraft: 0.9, motionCorrelationToDraft: 0.8 } };
  const raters = [rater(ids, 5), rater(ids, 5), rater(ids, 1)];
  const result = summarize({ manifest: m, measures, raters, shots });
  expect(result.variants.C.passes).toBe(true);
  expect(result.variants.C.ssimToDraft).toBe(0.9);
  expect(result.raters).toBe(3);
});

test('drafts nobody can judge are not legible, and the text states the verdict', () => {
  const m = manifest(['B']);
  const raters = [
    rater(
      m.clips.map((c) => c.id),
      5,
      2,
    ),
  ];
  const result = summarize({ manifest: m, measures: {}, raters, shots });
  expect(result.legible).toEqual([]);
  const text = renderSummary(result);
  expect(text).toContain('Staged model viable with: B.');
  expect(text).toContain('No kind of draft was judged legible enough.');
});
