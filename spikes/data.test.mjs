import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { REQUIRED_KINDS } from './lib/report-format.mjs';

/** The `spikes/` folder. */
const SPIKES = dirname(fileURLToPath(import.meta.url));

/**
 * Reads a JSON file of the spikes folder.
 * @param {string} path Path below `spikes/`.
 */
const read = (path) => JSON.parse(readFileSync(join(SPIKES, path), 'utf8'));

/** Kinds a candidate may have: the required ones plus the extra stages of plan 10b. */
const KINDS = [...Object.keys(REQUIRED_KINDS), 'upscale', 'refine'];

test('candidates have unique ids, a known kind and the fields the report and agents rely on', () => {
  const { candidates } = read('mac/candidates.json');
  expect(new Set(candidates.map((c) => c.id)).size).toBe(candidates.length);
  for (const c of candidates) {
    expect(KINDS, c.id).toContain(c.kind);
    for (const key of ['name', 'runtime', 'why', 'setup', 'licenseCheck', 'tests']) {
      expect(c[key], `${c.id}.${key}`).toBeTruthy();
    }
    expect(Number.isInteger(c.priority), c.id).toBe(true);
    for (const url of c.sources) expect(url, c.id).toMatch(/^https:\/\//);
  }
});

test('the candidate list can satisfy plan 10 acceptance', () => {
  const { candidates } = read('mac/candidates.json');
  for (const [kind, needed] of Object.entries(REQUIRED_KINDS)) {
    expect(candidates.filter((c) => c.kind === kind).length, kind).toBeGreaterThanOrEqual(needed);
  }
});

test('the ten test shots are unique, the smoke set and references exist', () => {
  const { shots, smoke, references } = read('draft-final/shots.json');
  expect(shots).toHaveLength(10);
  expect(new Set(shots.map((s) => s.id)).size).toBe(10);
  for (const id of smoke) expect(shots.map((s) => s.id)).toContain(id);
  const known = references.map((r) => r.id);
  for (const shot of shots) {
    expect(shot.prompt, shot.id).toBeTruthy();
    for (const used of shot.uses) expect(known, `${shot.id} uses ${used}`).toContain(used);
  }
});

test('the MiniMax candidate keeps its warning to read the licence first', () => {
  const { candidates } = read('mac/candidates.json');
  expect(candidates.find((c) => c.id === 'minimax-h3-gguf').licenseCheck).toMatch(
    /HUMAN MUST READ/,
  );
});
