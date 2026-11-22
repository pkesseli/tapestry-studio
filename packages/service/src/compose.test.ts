import { createEntity } from '@tapestry/core';
import { sampleId } from '@tapestry/core/testing';
import { MOCK_MANIFEST } from '@tapestry/providers';
import type { ProviderManifest } from '@tapestry/providers';
import { expect, test } from 'vitest';
import { composeShot } from './compose';

/** A character with two reference pictures in her canonical sheet, one of them a face. */
const maria = {
  ...createEntity({ kind: 'character', name: 'Maria', description: 'A ferry captain.' }),
  appearance: 'Short dark hair with a grey streak, dark wool coat',
  references: [
    { path: 'entities/maria/body.png', mediaType: 'image' as const, role: 'body' as const },
    { path: 'entities/maria/face.png', mediaType: 'image' as const, role: 'face' as const },
  ],
  canonicalSheet: ['entities/maria/body.png', 'entities/maria/face.png'],
};

/** A prop with no pictures yet. */
const lantern = createEntity({
  kind: 'prop',
  name: 'Lantern',
  description: 'An old brass lantern.',
});

const scene = {
  id: sampleId('scn', 1),
  number: 1,
  heading: 'INT. HARBOR - NIGHT',
  entityIds: [maria.id, lantern.id],
  description: 'Rain on the pier.',
  shots: [],
};

const shot = {
  id: sampleId('sht', 1),
  action: 'Maria lifts a lantern and looks into the fog.',
  dialogue: [],
  direction: 'slow push-in',
  cameraHint: 'low angle',
  durationSeconds: 6,
  referenceEntityIds: [maria.id],
};

/** The mock manifest with different video limits. */
const limited = (video: object): ProviderManifest => ({
  ...MOCK_MANIFEST,
  limits: { ...MOCK_MANIFEST.limits, video },
});

test('the prompt joins the action, direction, camera, setting and who is in the shot', () => {
  const { request } = composeShot({
    scene,
    shot,
    entities: [maria, lantern],
    manifest: MOCK_MANIFEST,
    quality: 'draft',
    seed: 5,
  });
  expect(request.prompt.split('\n')).toEqual([
    'Maria lifts a lantern and looks into the fog.',
    'Direction: slow push-in',
    'Camera: low angle',
    'Setting: INT. HARBOR - NIGHT. Rain on the pier.',
    'In the shot: Maria: Short dark hair with a grey streak, dark wool coat; Lantern: An old brass lantern.',
  ]);
  expect(request).toMatchObject({
    capability: 'video',
    provider: { providerId: 'mock' },
    quality: 'draft',
    seed: 5,
    durationSeconds: 6,
  });
});

test('references follow the provider limits, most important role first, and the rest are reported', () => {
  const { request, dropped } = composeShot({
    scene,
    shot,
    entities: [maria, lantern],
    manifest: limited({ maxImageReferences: 1 }),
    quality: 'final',
    seed: 1,
  });
  expect(request.references.map((r) => r.role)).toEqual(['face']);
  expect(dropped.map((d) => d.path)).toEqual(['entities/maria/body.png']);
});

test('people and things with no pictures yet are listed, and a long shot is cut to the provider maximum', () => {
  const composed = composeShot({
    scene,
    shot: { ...shot, durationSeconds: 30 },
    entities: [maria, lantern],
    manifest: limited({ maxDurationSeconds: 8 }),
    quality: 'final',
    seed: 1,
  });
  expect(composed.withoutLook).toEqual(['Lantern']);
  expect(composed.request.durationSeconds).toBe(8);
});

test('the same inputs always give the same request', () => {
  const input = {
    scene,
    shot,
    entities: [maria, lantern],
    manifest: MOCK_MANIFEST,
    quality: 'draft' as const,
    seed: 9,
  };
  expect(composeShot(input)).toEqual(composeShot(input));
});

test('an entity missing from the cast is simply left out', () => {
  const { request } = composeShot({
    scene,
    shot,
    entities: [lantern],
    manifest: MOCK_MANIFEST,
    quality: 'draft',
    seed: 1,
  });
  expect(request.prompt).not.toContain('Maria:');
  expect(request.references).toEqual([]);
});
