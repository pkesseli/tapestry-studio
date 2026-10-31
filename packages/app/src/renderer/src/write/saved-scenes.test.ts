import type { Scene } from '@tapestry/core';
import { analyze } from '@tapestry/script';
import { expect, test } from 'vitest';
import { savedScenesFor } from './saved-scenes';
import { sceneItems } from './scenes';

/** A saved scene with just an id and a heading. */
const saved = (id: string, heading: string) => ({ id, heading }) as unknown as Scene;

/** The scene items of a screenplay with the given headings. */
const itemsOf = (...headings: string[]) =>
  sceneItems(analyze('fountain', headings.map((h) => `${h}\n\nText.\n`).join('\n'), []));

test('matches by heading even when the saved scenes are in a different order', () => {
  const items = itemsOf('INT. HARBOR - NIGHT', 'EXT. FERRY DECK - DAWN', 'INT. CABIN - DAY');
  const scenes = [
    saved('c', 'INT. CABIN - DAY'),
    saved('a', 'INT. HARBOR - NIGHT'),
    saved('b', 'EXT. FERRY DECK - DAWN'),
  ];
  expect(savedScenesFor(items, scenes).map((s) => s?.id)).toEqual(['a', 'b', 'c']);
});

test('a scene just inserted has no saved scene yet, and the ones below keep theirs', () => {
  const items = itemsOf('INT. HARBOR - NIGHT', 'INT. LOCATION - DAY', 'EXT. FERRY DECK - DAWN');
  const scenes = [saved('a', 'INT. HARBOR - NIGHT'), saved('b', 'EXT. FERRY DECK - DAWN')];
  expect(savedScenesFor(items, scenes).map((s) => s?.id)).toEqual(['a', undefined, 'b']);
});

test('several scenes with the same heading are matched in order', () => {
  const items = itemsOf('INT. LOCATION - DAY', 'INT. LOCATION - DAY', 'INT. CABIN - DAY');
  const scenes = [
    saved('1', 'INT. LOCATION - DAY'),
    saved('2', 'INT. LOCATION - DAY'),
    saved('c', 'INT. CABIN - DAY'),
  ];
  expect(savedScenesFor(items, scenes).map((s) => s?.id)).toEqual(['1', '2', 'c']);
});
