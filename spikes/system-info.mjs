#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectSystem } from './lib/system.mjs';

/** The `spikes/` folder. */
const SPIKES = dirname(fileURLToPath(import.meta.url));

/** Suites that keep a copy of the machine description next to their results. */
const SUITES = ['mac', 'draft-final'];

const system = collectSystem();
for (const suite of SUITES) {
  const folder = join(SPIKES, suite, 'results');
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, 'system.json'), `${JSON.stringify(system, null, 2)}\n`);
}
console.log(JSON.stringify(system, null, 2));
if (system.platform !== 'darwin')
  console.warn('\nThis is not a Mac: results from it do not answer plan 10.');
const missing = ['ffmpeg', 'ffprobe', 'python3'].filter((tool) => !system.tools[tool]);
if (missing.length)
  console.warn(`\nNot installed yet: ${missing.join(', ')} (see spikes/mac/README.md).`);
