import { createEntity } from '@tapestry/core';
import type { Scene } from '@tapestry/core';
import { analyze, planShots } from '@tapestry/script';
import type { SceneClip } from '@tapestry/service';
import { expect, test } from 'vitest';
import { activeShotIndex, shotViews } from './shots-view';

const maria = createEntity({ kind: 'character', name: 'Maria' });
const TEXT =
  'INT. HARBOR - NIGHT\n\nMARIA lifts a LANTERN.\n[[direction: slow push-in]]\n\nMARIA\nHello?\n';

/** The first scene of TEXT as parsed and as a saved scene with the given shot ids. */
function setup() {
  const analysis = analyze('fountain', TEXT, [maria]);
  const parsed = analysis.fountain!.scenes[0]!;
  const planned = planShots(parsed);
  const saved = {
    id: 'scn_x',
    shots: planned.map((p, i) => ({
      id: `sht_${i}`,
      action: p.action,
      referenceEntityIds: i === 0 ? [maria.id] : [],
    })),
  } as unknown as Scene;
  return { parsed, saved };
}

/** Builds a clip for a shot id. */
const clip = (shotId: string, accepted: boolean): SceneClip => ({
  sceneId: 'scn_x',
  shotId,
  shotNumber: 1,
  artifactId: `art_${shotId}`,
  path: 'artifacts/x/clip.mp4',
  accepted,
  sample: true,
});

test('combines the script, the cast and the footage into shots with a state', () => {
  const { parsed, saved } = setup();
  const views = shotViews(parsed, saved, [clip('sht_0', true), clip('sht_1', false)], [maria]);
  expect(views.map((v) => [v.number, v.kind, v.state])).toEqual([
    [1, 'action', 'accepted'],
    [2, 'line', 'to-review'],
  ]);
  expect(views[0]).toMatchObject({ direction: 'slow push-in', people: ['Maria'] });
  expect(views[1]?.direction).toBeUndefined();
  expect(TEXT.slice(views[0]!.start, views[0]!.end)).toBe('MARIA lifts a LANTERN.');
});

test('shots without footage, or with a project that has not caught up, are not made', () => {
  const { parsed, saved } = setup();
  expect(shotViews(parsed, saved, [], [maria]).map((v) => v.state)).toEqual([
    'not-made',
    'not-made',
  ]);
  expect(shotViews(parsed, undefined, [clip('sht_0', true)], [maria]).map((v) => v.state)).toEqual([
    'not-made',
    'not-made',
  ]);
});

test('the active shot is the last one that starts at or before the cursor', () => {
  const { parsed, saved } = setup();
  const views = shotViews(parsed, saved, [], [maria]);
  expect(activeShotIndex(views, 0)).toBe(0);
  expect(activeShotIndex(views, views[1]!.start)).toBe(1);
  expect(activeShotIndex(views, TEXT.length)).toBe(1);
  expect(activeShotIndex([], 5)).toBe(-1);
});
