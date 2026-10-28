import { createEntity } from '@tapestry/core';
import { analyze } from '@tapestry/script';
import { STARTER_SCREENPLAY } from '@tapestry/service';
import { expect, test } from 'vitest';
import { activeSceneIndex, contentsOf, sceneItems } from './scenes';

const maria = createEntity({ kind: 'character', name: 'Maria' });
const lantern = createEntity({ kind: 'prop', name: 'Lantern' });

test('lists scenes with readable titles and the range each covers', () => {
  const analysis = analyze('fountain', STARTER_SCREENPLAY, []);
  const scenes = sceneItems(analysis);
  expect(scenes.map((s) => [s.number, s.title])).toEqual([
    [1, 'Harbor, night'],
    [2, 'Ferry deck, dawn'],
  ]);
  expect(scenes[0]?.end).toBe(scenes[1]?.start);
  expect(scenes[1]?.end).toBe(STARTER_SCREENPLAY.length + 1);
});

test('the active scene follows the cursor, and defaults to the first', () => {
  const scenes = sceneItems(analyze('fountain', STARTER_SCREENPLAY, []));
  expect(activeSceneIndex(scenes, 0)).toBe(0);
  expect(activeSceneIndex(scenes, scenes[1]?.start ?? 0)).toBe(1);
  expect(activeSceneIndex(scenes, STARTER_SCREENPLAY.length)).toBe(1);
  expect(activeSceneIndex([], 5)).toBe(-1);
});

test('separates what is in the cast from the names still missing, per scene', () => {
  const entities = [maria, lantern];
  const analysis = analyze('fountain', STARTER_SCREENPLAY, entities);
  const [first, second] = sceneItems(analysis);
  const harbor = contentsOf(first!, analysis.mentions, entities);
  expect(harbor.cast.map((p) => [p.entity.name, p.mentions])).toEqual([['Maria', 2]]);
  expect(harbor.things.map((p) => p.entity.name)).toEqual(['Lantern']);
  expect(harbor.missing.map((m) => [m.name, m.kind])).toEqual([
    ['HARBOR', 'location'],
    ['HORN', 'prop'],
    ['NORA', 'character'],
  ]);
  const deck = contentsOf(second!, analysis.mentions, entities);
  expect(deck.missing.map((m) => m.name)).toEqual(['FERRY DECK', 'TOM']);
});
