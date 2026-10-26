import { expect, test } from 'vitest';
import { AliasIndex, normalizeAlias } from './aliases';
import { buildSampleFilm } from './testing';

test('normalises case, diacritics and whitespace', () => {
  expect(normalizeAlias('  MaRíA  ')).toBe('maria');
  expect(normalizeAlias('Old   Town')).toBe('old town');
});

test('resolves names and aliases to the same entity', () => {
  const index = new AliasIndex(buildSampleFilm().entities);
  expect(index.resolve('MARIA').map((e) => e.name)).toEqual(['Maria']);
  expect(index.resolve('maría').map((e) => e.name)).toEqual(['Maria']);
  expect(index.resolve('Nobody')).toEqual([]);
});

test('reports aliases claimed by several entities', () => {
  const [maria, tom] = buildSampleFilm().entities;
  if (!maria || !tom) throw new Error('sample data changed');
  const index = new AliasIndex([maria, { ...tom, aliases: ['María'] }]);
  expect(index.conflicts().map((c) => c.alias)).toEqual(['maria']);
});
