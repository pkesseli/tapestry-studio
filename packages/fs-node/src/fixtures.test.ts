import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryFs, loadProject, saveProject, serializeProject } from '@tapestry/core';
import type { ProjectData } from '@tapestry/core';
import { buildSampleFilm, buildSampleSong } from '@tapestry/core/testing';
import { expect, test } from 'vitest';
import { NodeFs } from './node-fs';

/** Folder holding the committed sample projects. */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../../../fixtures');

/** Set `UPDATE_FIXTURES=1` to regenerate the committed fixtures from the builders in `@tapestry/core/testing`. */
const UPDATE = process.env['UPDATE_FIXTURES'] === '1';

test.each<[string, () => ProjectData]>([
  ['sample-film', buildSampleFilm],
  ['sample-song', buildSampleSong],
])('%s on disk loads, equals its builder and re-saves byte-identically', async (name, build) => {
  const fs = new NodeFs(join(FIXTURES, name));
  if (UPDATE) await saveProject(fs, build());

  const loaded = await loadProject(fs);
  expect(loaded).toEqual(build());

  const memory = new MemoryFs();
  await saveProject(memory, loaded);
  const expectedFiles = { ...serializeProject(loaded), ...loaded.scripts };
  expect(memory.files()).toEqual(expectedFiles);
  for (const [path, text] of Object.entries(expectedFiles)) {
    expect(await readFile(join(FIXTURES, name, path), 'utf8'), path).toBe(text);
  }
});
