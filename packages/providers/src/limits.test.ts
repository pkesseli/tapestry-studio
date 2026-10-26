import { expect, test } from 'vitest';
import type { RequestReference } from '@tapestry/core';
import { checkRequestLimits, selectReferences } from './limits';
import { MOCK_MANIFEST } from './mock/mock-provider';

/**
 * Shorthand for an image reference.
 * @param name File name stem.
 * @param role Reference role.
 */
const image = (name: string, role: RequestReference['role']): RequestReference => ({
  path: `refs/${name}.png`,
  mediaType: 'image',
  role,
});

test('keeps the most important roles when references exceed the limit', () => {
  const candidates = [
    image('mood', 'mood'),
    image('face', 'face'),
    image('place', 'place'),
    image('body', 'body'),
  ];
  const { selected, dropped } = selectReferences(candidates, { maxImageReferences: 2 });
  expect(selected.map((r) => r.path)).toEqual(['refs/face.png', 'refs/body.png']);
  expect(dropped.map((d) => d.reference.path)).toEqual(['refs/place.png', 'refs/mood.png']);
  expect(dropped[0]?.reason).toMatch(/Only 2 image/);
});

test('keeps the caller order among equal roles', () => {
  const candidates = [image('b', 'face'), image('a', 'face'), image('c', 'face')];
  expect(
    selectReferences(candidates, { maxImageReferences: 2 }).selected.map((r) => r.path),
  ).toEqual(['refs/b.png', 'refs/a.png']);
});

test('applies per-type and total limits together', () => {
  const audio: RequestReference = { path: 'v.wav', mediaType: 'audio', role: 'voice-sample' };
  const candidates = [image('a', 'face'), image('b', 'body'), audio];
  const { selected, dropped } = selectReferences(candidates, {
    maxTotalReferences: 2,
    maxAudioReferences: 1,
  });
  expect(selected.map((r) => r.path)).toEqual(['refs/a.png', 'refs/b.png']);
  expect(dropped[0]?.reference).toBe(audio);
  expect(dropped[0]?.reason).toMatch(/2 references allowed in total/);
});

test('passes everything through when there are no limits', () => {
  const candidates = [image('a', 'face'), image('b', 'mood')];
  expect(selectReferences(candidates, {}).selected).toHaveLength(2);
});

test('request checks name the problem in plain language', () => {
  const base = {
    capability: 'video' as const,
    provider: { providerId: 'mock' },
    prompt: 'p',
    references: [],
    audioInputs: [],
    extras: {},
  };
  expect(checkRequestLimits({ ...base, durationSeconds: 99 }, MOCK_MANIFEST)).toMatch(
    /at most 15 seconds/,
  );
  expect(checkRequestLimits({ ...base, audioInputs: ['a', 'b', 'c', 'd'] }, MOCK_MANIFEST)).toMatch(
    /audio input/,
  );
  expect(checkRequestLimits({ ...base, durationSeconds: 5 }, MOCK_MANIFEST)).toBeUndefined();
});
