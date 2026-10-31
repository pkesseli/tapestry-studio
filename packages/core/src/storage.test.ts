import { expect, test } from 'vitest';
import { ProjectFormatError } from './errors';
import { MemoryFs } from './fs-port';
import { loadProject, saveProject, serializeProject } from './storage';
import { buildSampleFilm, buildSampleSong, sampleId } from './testing';
import { validateProject } from './validate';

test.each([
  ['film', buildSampleFilm],
  ['song', buildSampleSong],
])('sample %s survives a save/load round trip byte for byte', async (_name, build) => {
  const fs = new MemoryFs();
  await saveProject(fs, build());
  const loaded = await loadProject(fs);
  expect(loaded).toEqual(build());
  const second = new MemoryFs();
  await saveProject(second, loaded);
  expect(second.files()).toEqual(fs.files());
});

test('sample projects are internally consistent', () => {
  expect(validateProject(buildSampleFilm())).toEqual([]);
  expect(validateProject(buildSampleSong())).toEqual([]);
});

test('saving removes files of deleted items but keeps scripts', async () => {
  const fs = new MemoryFs();
  const film = buildSampleFilm();
  await saveProject(fs, film);
  await saveProject(fs, { ...film, timelines: [], scripts: {} });
  const paths = Object.keys(fs.files());
  expect(paths.some((p) => p.startsWith('timeline/'))).toBe(false);
  expect(paths).toContain('script/main.fountain');
});

test('invalid data is rejected before anything is written', async () => {
  const fs = new MemoryFs();
  const film = buildSampleFilm();
  const [first] = film.entities;
  if (first?.kind !== 'character') throw new Error('sample data changed');
  film.entities[0] = { ...first, voiceId: 'chr_bad' as never };
  await expect(saveProject(fs, film)).rejects.toThrow(/entity\.json: voiceId/);
  expect(fs.files()).toEqual({});
});

test('errors name the file and the field', async () => {
  const fs = new MemoryFs();
  await saveProject(fs, buildSampleFilm());
  const path = Object.keys(fs.files()).find((p) => p.startsWith('jobs/')) ?? '';
  const job = JSON.parse(await fs.readText(path)) as Record<string, unknown>;
  await fs.writeText(path, JSON.stringify({ ...job, state: 'finished' }));
  const error = await loadProject(fs).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ProjectFormatError);
  expect((error as ProjectFormatError).file).toBe(path);
  expect((error as Error).message).toMatch(/state:/);
});

test('rejects unknown fields instead of silently dropping them', async () => {
  const fs = new MemoryFs();
  await saveProject(fs, buildSampleFilm());
  const project = JSON.parse(await fs.readText('project.json')) as Record<string, unknown>;
  await fs.writeText('project.json', JSON.stringify({ ...project, surprise: true }));
  await expect(loadProject(fs)).rejects.toThrow(/project\.json/);
});

test('rejects a project written by a newer version', async () => {
  const fs = new MemoryFs();
  await saveProject(fs, buildSampleFilm());
  const project = JSON.parse(await fs.readText('project.json')) as Record<string, unknown>;
  await fs.writeText('project.json', JSON.stringify({ ...project, schemaVersion: 99 }));
  await expect(loadProject(fs)).rejects.toThrow(/newer than this app/);
});

test('rejects files stored at the wrong location', async () => {
  const fs = new MemoryFs();
  await saveProject(fs, buildSampleFilm());
  const from = Object.keys(fs.files()).find((p) => p.startsWith('jobs/')) ?? '';
  await fs.writeText('jobs/job_00000000000000000000000009.json', await fs.readText(from));
  await expect(loadProject(fs)).rejects.toThrow(/must be stored at/);
});

test('an empty folder is not a project', async () => {
  await expect(loadProject(new MemoryFs())).rejects.toThrow(/Not found/);
});

test('serialisation is deterministic', () => {
  expect(serializeProject(buildSampleFilm())).toEqual(serializeProject(buildSampleFilm()));
});

test('scenes load in script order, not in the order of their file names', async () => {
  const fs = new MemoryFs();
  const film = buildSampleFilm();
  const [scene] = film.scenes;
  if (!scene) throw new Error('sample data changed');
  const first = { ...scene, id: sampleId('scn', 5), number: 2 };
  const second = { ...scene, id: sampleId('scn', 9), number: 1 };
  await saveProject(fs, { ...film, scenes: [first, second] });
  expect((await loadProject(fs)).scenes.map((s) => s.number)).toEqual([1, 2]);
});
