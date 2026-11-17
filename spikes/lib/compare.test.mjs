import { expect, test } from 'vitest';
import { sidesFor, tally, winnerOf } from './compare.mjs';

/** Ten shot ids. */
const shots = Array.from({ length: 10 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);

test('the order of the two versions is repeatable, and both versions are on both sides across shots', () => {
  expect(sidesFor('S01', 'maria')).toEqual(sidesFor('S01', 'maria'));
  for (const shot of shots)
    expect([...sidesFor(shot, 'maria')].sort()).toEqual(['direct', 'upscaled']);
  const firsts = new Set(shots.map((shot) => sidesFor(shot, 'maria')[0]));
  expect(firsts).toEqual(new Set(['direct', 'upscaled']));
});

test('a choice of side becomes the version that won, and "same" is a tie', () => {
  const [a, b] = sidesFor('S03', 'rater-1');
  expect(winnerOf('S03', 'rater-1', 'A')).toBe(a);
  expect(winnerOf('S03', 'rater-1', 'B')).toBe(b);
  expect(winnerOf('S03', 'rater-1', 'same')).toBe('tie');
});

/**
 * Answers where the person always prefers the given version (or says "same").
 * @param {string} rater Person.
 * @param {'direct' | 'upscaled' | 'tie'} prefer Which version wins in every shot.
 * @param {string[]} [skip] Shots left unanswered.
 */
const always = (rater, prefer, skip = []) => ({
  answers: Object.fromEntries(
    shots
      .filter((shot) => !skip.includes(shot))
      .map((shot) => {
        const [a] = sidesFor(shot, rater);
        const choice = prefer === 'tie' ? 'same' : a === prefer ? 'A' : 'B';
        return [shot, { choice }];
      }),
  ),
});

test('the rule passes when the enlarged draft wins or ties often enough', () => {
  const result = tally(shots, {
    a: always('a', 'upscaled'),
    b: always('b', 'tie'),
    c: always('c', 'direct'),
  });
  expect(result.a).toMatchObject({ notWorse: 10, passes: true });
  expect(result.b).toMatchObject({ notWorse: 10, passes: true });
  expect(result.c).toMatchObject({ notWorse: 0, passes: false });
  expect(result.c.direct).toHaveLength(10);
});

test('unanswered shots are listed and do not count for the enlarged draft', () => {
  const four = shots.slice(0, 4);
  const three = shots.slice(0, 3);
  const result = tally(shots, {
    d: always('d', 'upscaled', four),
    e: always('e', 'upscaled', three),
  });
  expect(result.d.unanswered).toEqual(four);
  expect(result.d).toMatchObject({ notWorse: 6, passes: false });
  expect(result.e).toMatchObject({ notWorse: 7, passes: true });
});
