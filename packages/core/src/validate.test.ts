import { expect, test } from 'vitest';
import { sampleId } from './testing';
import { buildSampleFilm } from './testing';
import { validateProject } from './validate';

test('reports an unaccepted artifact on the timeline', () => {
  const film = buildSampleFilm();
  const [artifact] = film.artifacts;
  if (!artifact) throw new Error('sample data changed');
  film.artifacts[0] = { ...artifact, accepted: false };
  expect(validateProject(film).map((i) => i.message)).toContain(
    `Artifact ${artifact.id} is not accepted`,
  );
});

test('reports dangling entity references', () => {
  const film = buildSampleFilm();
  const [scene] = film.scenes;
  if (!scene) throw new Error('sample data changed');
  film.scenes[0] = { ...scene, entityIds: [...scene.entityIds, sampleId('chr', 9)] };
  expect(validateProject(film)).toEqual([
    { where: scene.id, message: `Unknown entity ${sampleId('chr', 9)}` },
  ]);
});

test('reports a canonical sheet that is not among the references', () => {
  const film = buildSampleFilm();
  const [maria] = film.entities;
  if (maria?.kind !== 'character') throw new Error('sample data changed');
  film.entities[0] = { ...maria, canonicalSheet: ['entities/other.png'] };
  expect(validateProject(film)[0]?.message).toMatch(/Canonical sheet file/);
});

test('reports clips whose out point is not after the in point', () => {
  const film = buildSampleFilm();
  const [timeline] = film.timelines;
  const track = timeline?.tracks[0];
  const clip = track?.clips[0];
  if (!timeline || !track || !clip) throw new Error('sample data changed');
  film.timelines[0] = {
    ...timeline,
    tracks: [{ ...track, clips: [{ ...clip, inSeconds: 5, outSeconds: 5 }] }],
  };
  expect(validateProject(film)[0]?.message).toMatch(/out point/);
});
