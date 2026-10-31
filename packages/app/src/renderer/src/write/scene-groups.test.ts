import { expect, test } from 'vitest';
import { filterGroups, groupScenes, matchesQuery } from './scene-groups';
import type { SceneItem } from './scenes';

/** Builds a scene item for tests. */
const scene = (
  number: number,
  title: string,
  act: string | undefined,
  names: string[] = [],
): SceneItem => ({
  number,
  title,
  start: number * 100,
  end: number * 100 + 99,
  heading: `INT. ${title.toUpperCase()} - DAY`,
  ...(act !== undefined && { act }),
  names,
});

const items = [
  scene(1, 'Harbor, night', undefined, ['HARBOR', 'MARIA']),
  scene(2, 'Ferry deck, dawn', 'Act One', ['FERRY DECK', 'TOM']),
  scene(3, 'Cabin, day', 'Act One', ['CABIN', 'MARIA']),
  scene(4, 'Café, morning', 'Act Two', ['CAFÉ']),
];

test('groups scenes by act in script order, with scenes before any act in their own group', () => {
  const groups = groupScenes(items);
  expect(groups.map((g) => [g.act, g.scenes.map((s) => s.item.number)])).toEqual([
    [undefined, [1]],
    ['Act One', [2, 3]],
    ['Act Two', [4]],
  ]);
  expect(groups[1]?.scenes.map((s) => s.index)).toEqual([1, 2]);
});

test('every typed word must match, ignoring case and accents, in title, heading, act or names', () => {
  expect(matchesQuery(items[2] as SceneItem, 'maria cabin')).toBe(true);
  expect(matchesQuery(items[2] as SceneItem, 'MARIA')).toBe(true);
  expect(matchesQuery(items[3] as SceneItem, 'cafe')).toBe(true);
  expect(matchesQuery(items[1] as SceneItem, 'act one')).toBe(true);
  expect(matchesQuery(items[1] as SceneItem, 'maria')).toBe(false);
  expect(matchesQuery(items[1] as SceneItem, '   ')).toBe(true);
});

test('filtering keeps matching scenes under their act, and a matching act keeps all its scenes', () => {
  const groups = groupScenes(items);
  expect(
    filterGroups(groups, 'maria').map((g) => [g.act, g.scenes.map((s) => s.item.number)]),
  ).toEqual([
    [undefined, [1]],
    ['Act One', [3]],
  ]);
  expect(filterGroups(groups, 'act two').map((g) => g.scenes.length)).toEqual([1]);
  expect(filterGroups(groups, 'act one')[0]?.scenes.map((s) => s.item.number)).toEqual([2, 3]);
  expect(filterGroups(groups, 'zzz')).toEqual([]);
  expect(filterGroups(groups, '')).toHaveLength(3);
});
