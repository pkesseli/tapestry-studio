#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readManifest } from './lib/manifest.mjs';
import { renderSummary, summarize } from './lib/summary.mjs';

/** The `spikes/draft-final/` folder. */
const FOLDER = join(dirname(fileURLToPath(import.meta.url)), 'draft-final');
const RESULTS = join(FOLDER, 'results');

/**
 * Reads a JSON file, or returns a fallback when it does not exist.
 * @param {string} file Path.
 * @param {unknown} fallback Value for a missing file.
 */
const readJson = (file, fallback) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;

const ratingsDir = join(RESULTS, 'ratings');
const raters = existsSync(ratingsDir)
  ? readdirSync(ratingsDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(readFileSync(join(ratingsDir, name), 'utf8')))
  : [];
const text = renderSummary(
  summarize({
    manifest: readManifest(join(RESULTS, 'manifest.json')),
    measures: readJson(join(RESULTS, 'measures.json'), {}),
    raters,
    shots: readJson(join(FOLDER, 'shots.json'), { shots: [] }).shots.map((shot) => shot.id),
  }),
);
writeFileSync(join(RESULTS, 'summary.md'), text);
console.log(text);
