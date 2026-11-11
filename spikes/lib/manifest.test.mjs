import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { readManifest, upsertClip } from './manifest.mjs';

/** A fresh manifest path. */
const file = () => join(mkdtempSync(join(tmpdir(), 'spike-')), 'results', 'manifest.json');

test('clips are added, and a clip with the same id is replaced', () => {
  const path = file();
  upsertClip(path, { id: 'D-S01-normal', shot: 'S01', role: 'draft', file: 'a.mp4' });
  upsertClip(path, {
    id: 'F-S01-A0',
    shot: 'S01',
    role: 'final',
    source: 'D-S01-normal',
    file: 'b.mp4',
  });
  upsertClip(path, { id: 'D-S01-normal', shot: 'S01', role: 'draft', file: 'c.mp4' });
  expect(readManifest(path).clips.map((c) => [c.id, c.file])).toEqual([
    ['F-S01-A0', 'b.mp4'],
    ['D-S01-normal', 'c.mp4'],
  ]);
});

test('a missing manifest is empty', () => {
  expect(readManifest(file())).toEqual({ version: 1, clips: [] });
});

test('bad clips are refused', () => {
  const path = file();
  expect(() => upsertClip(path, { id: 'x', shot: 'S01', role: 'final', file: 'f.mp4' })).toThrow(
    /source draft/,
  );
  expect(() => upsertClip(path, { id: 'x', shot: 'S01', role: 'other', file: 'f.mp4' })).toThrow(
    /role/,
  );
  expect(() => upsertClip(path, { shot: 'S01', role: 'draft', file: 'f.mp4' })).toThrow(/id/);
});
