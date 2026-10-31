import { analyze } from '@tapestry/script';
import { expect, test } from 'vitest';
import { actRemoval, describeImpact, impactOf, sceneRemoval } from './deletions';
import { actItems, sceneItems } from './scenes';

/** Two acts: the first has two scenes, the second one. */
const SCRIPT = [
  '# Act One',
  '',
  'INT. HARBOR - NIGHT',
  '',
  'Rain falls.',
  '',
  'EXT. FERRY DECK - DAWN',
  '',
  'Gulls cry.',
  '',
  '# Act Two',
  '',
  'INT. CABIN - DAY',
  '',
  'A stove ticks.',
  '',
].join('\n');

/** The script after deleting a range. */
const without = (from: number, to: number) => SCRIPT.slice(0, from) + SCRIPT.slice(to);

const analysis = analyze('fountain', SCRIPT, []);
const scenes = sceneItems(analysis);
const acts = actItems(analysis);

test('deleting a scene removes its text and nothing else', () => {
  const { from, to } = sceneRemoval(scenes[1]!, SCRIPT.length);
  const rest = without(from, to);
  expect(rest).not.toContain('FERRY DECK');
  expect(rest).not.toContain('Gulls cry.');
  expect(rest).toContain('# Act Two');
  expect(rest).toContain('INT. HARBOR - NIGHT');
});

test('deleting the first scene of an act keeps the act line', () => {
  const { from, to } = sceneRemoval(scenes[0]!, SCRIPT.length);
  const rest = without(from, to);
  expect(rest.startsWith('# Act One')).toBe(true);
  expect(rest).not.toContain('HARBOR');
  expect(rest).toContain('FERRY DECK');
});

test('deleting the last scene reaches the end of the text', () => {
  const { from, to } = sceneRemoval(scenes[2]!, SCRIPT.length);
  expect(to).toBe(SCRIPT.length);
  expect(without(from, to)).not.toContain('CABIN');
});

test('deleting an act but keeping its scenes only removes the act line', () => {
  const { from, to } = actRemoval(SCRIPT, acts, 0, false);
  const rest = without(from, to);
  expect(rest).not.toContain('Act One');
  expect(rest).toContain('HARBOR');
  expect(rest).toContain('FERRY DECK');
  expect(rest.startsWith('INT. HARBOR')).toBe(true);
});

test('deleting an act with its scenes stops at the next act', () => {
  const rest = without(...(Object.values(actRemoval(SCRIPT, acts, 0, true)) as [number, number]));
  expect(rest.startsWith('# Act Two')).toBe(true);
  expect(rest).not.toContain('HARBOR');
});

test('the last act is removed up to the end of the text', () => {
  const removal = actRemoval(SCRIPT, acts, 1, true);
  expect(removal.to).toBe(SCRIPT.length);
  expect(without(removal.from, removal.to)).not.toContain('CABIN');
});

test('the impact counts the scenes, shots and videos inside the range', () => {
  const shots = [[{}, {}], [{}], [{}, {}, {}]] as never;
  const footage = [{ clips: [{}, {}] }, { clips: [] }, { clips: [{}] }] as never;
  const act = actRemoval(SCRIPT, acts, 0, true);
  expect(impactOf(act, scenes, shots, footage)).toEqual({ scenes: 2, shots: 3, clips: 2 });
});

test('the impact is worded for people', () => {
  expect(describeImpact({ scenes: 1, shots: 0, clips: 0 })).toBe('1 scene');
  expect(describeImpact({ scenes: 2, shots: 7, clips: 1 })).toBe('2 scenes, 7 shots and 1 video');
});
