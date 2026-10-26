import { expect, test } from 'vitest';
import { isId, newId } from './ids';

test('creates well-formed ids of the requested kind', () => {
  const id = newId('chr');
  expect(isId(id, 'chr')).toBe(true);
  expect(isId(id, 'loc')).toBe(false);
  expect(id).toHaveLength(4 + 26);
});

test('ids created in the same millisecond are strictly increasing', () => {
  const ids = Array.from({ length: 50 }, () => newId('job', 1_900_000_000_000));
  expect(new Set(ids).size).toBe(50);
  expect([...ids].sort()).toEqual(ids);
});

test('ids sort by creation time', () => {
  const early = newId('art', 1_800_000_000_000);
  const late = newId('art', 1_800_000_000_001);
  expect(early < late).toBe(true);
});

test('rejects malformed values', () => {
  expect(isId('chr_lowercase0000000000000000', 'chr')).toBe(false);
  expect(isId(42, 'chr')).toBe(false);
});
