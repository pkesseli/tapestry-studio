import { expect, test } from 'vitest';
import { alignKeys, similarity } from './align';

test('identical lists map one to one', () => {
  expect(alignKeys(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([0, 1, 2]);
});

test('inserting, deleting and appending keeps the other items matched', () => {
  expect(alignKeys(['a', 'b', 'c'], ['a', 'x', 'b', 'c'])).toEqual([0, undefined, 1, 2]);
  expect(alignKeys(['a', 'b', 'c'], ['a', 'c'])).toEqual([0, 2]);
  expect(alignKeys(['a'], ['a', 'b'])).toEqual([0, undefined]);
});

test('reordered items are still recognised', () => {
  expect(alignKeys(['a', 'b'], ['b', 'a'])).toEqual([1, 0]);
  expect(alignKeys(['a', 'b', 'c', 'd'], ['d', 'a', 'b', 'c'])).toEqual([3, 0, 1, 2]);
});

test('duplicated keys are matched in order', () => {
  const heading = 'int harbor night';
  expect(alignKeys([heading, heading], [heading, heading])).toEqual([0, 1]);
  expect(alignKeys(['x', 'x'], ['x'])).toEqual([0]);
});

test('lightly renamed items keep their identity, heavily changed ones do not', () => {
  expect(
    alignKeys(['int harbor night', 'ext deck dawn'], ['int harbor dusk', 'ext deck dawn']),
  ).toEqual([0, 1]);
  expect(alignKeys(['int harbor night'], ['ext forest day'])).toEqual([undefined]);
});

test('similarity counts shared words', () => {
  expect(similarity('a b c', 'a b d')).toBe(0.5);
  expect(similarity('', '')).toBe(1);
  expect(similarity('a', 'b')).toBe(0);
});
