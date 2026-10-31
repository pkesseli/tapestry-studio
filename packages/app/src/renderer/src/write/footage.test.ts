import type { Scene } from '@tapestry/core';
import type { SceneClip } from '@tapestry/service';
import { expect, test } from 'vitest';
import { footageByScene, footageSummary } from './footage';

/** Builds a scene with the given number of shots. */
const scene = (id: string, shots: number) =>
  ({
    id,
    shots: Array.from({ length: shots }, (_, i) => ({ id: `${id}-${i}` })),
  }) as unknown as Scene;

/** Builds a clip. */
const clip = (sceneId: string, shotNumber: number, accepted: boolean): SceneClip => ({
  sceneId,
  shotId: `${sceneId}-${shotNumber}`,
  shotNumber,
  artifactId: `art-${sceneId}-${shotNumber}`,
  path: 'artifacts/x/clip.mp4',
  accepted,
  sample: true,
});

test('groups clips by scene in shot order', () => {
  const result = footageByScene(
    [scene('a', 2), scene('b', 0)],
    [clip('a', 2, false), clip('a', 1, true)],
  );
  expect(result[0]?.shots).toBe(2);
  expect(result[0]?.clips.map((c) => c.shotNumber)).toEqual([1, 2]);
  expect(result[1]).toEqual({ shots: 0, clips: [] });
});

test('summarises a scene in plain words', () => {
  const some = { shots: 3, clips: [clip('a', 1, true), clip('a', 2, false), clip('a', 3, false)] };
  expect(footageSummary(some)).toBe('3 shots · 1 accepted · 2 to review');
  expect(footageSummary({ shots: 1, clips: [] })).toBe('1 shot · none made yet');
  expect(footageSummary({ shots: 0, clips: [] })).toBe('No shots yet');
  expect(footageSummary(undefined)).toBe('No shots yet');
});
