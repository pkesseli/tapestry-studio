#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderReport } from './lib/report-format.mjs';
import { readRuns } from './lib/runs.mjs';

/** The `spikes/mac/` folder. */
const MAC = join(dirname(fileURLToPath(import.meta.url)), 'mac');

/**
 * Reads a JSON file, or returns a fallback when it does not exist.
 * @param {string} file Path.
 * @param {unknown} fallback Value for a missing file.
 */
const readJson = (file, fallback) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;

const results = join(MAC, 'results');
const text = renderReport({
  system: readJson(join(results, 'system.json'), null),
  candidates: readJson(join(MAC, 'candidates.json'), { candidates: [] }).candidates,
  runs: readRuns(join(results, 'runs.jsonl')),
  findings: readJson(join(results, 'findings.json'), {}),
});
writeFileSync(join(results, 'results.md'), text);
console.log(text);
