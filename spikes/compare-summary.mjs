#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMPARE_RULE, tally } from './lib/compare.mjs';

/** The `spikes/draft-final/results/` folder. */
const RESULTS = join(dirname(fileURLToPath(import.meta.url)), 'draft-final', 'results');
const answersDir = join(RESULTS, 'compare');

const { pairs } = JSON.parse(readFileSync(join(RESULTS, 'compare.json'), 'utf8'));
const raters = existsSync(answersDir)
  ? Object.fromEntries(
      readdirSync(answersDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => [
          name.replace(/\.json$/, ''),
          JSON.parse(readFileSync(join(answersDir, name), 'utf8')),
        ]),
    )
  : {};
const result = tally(
  pairs.map((p) => p.shot),
  raters,
);

const lines = [
  '# Direct render against the enlarged draft (blind comparison)',
  '',
  `Rule (proposal): the enlarged draft is a real option when it wins or ties in at least ${COMPARE_RULE.shotsNeeded} of ${pairs.length} shots.`,
  '',
  '| Person | Enlarged draft better | Tie | Direct better | Not answered | Won or tied | Passes |',
  '|---|---|---|---|---|---|---|',
];
for (const [name, r] of Object.entries(result)) {
  lines.push(
    `| ${name} | ${r.upscaled.length} | ${r.tie.length} | ${r.direct.length} | ${r.unanswered.length} | ${r.notWorse} | ${r.passes ? 'yes' : 'no'} |`,
  );
}
for (const [name, r] of Object.entries(result)) {
  if (r.direct.length)
    lines.push('', `Shots where ${name} preferred the direct render: ${r.direct.join(', ')}.`);
  const notes = pairs
    .map((p) => [p.shot, raters[name].answers?.[p.shot]?.note])
    .filter(([, note]) => note);
  if (notes.length) {
    lines.push('', `Notes from ${name}:`, ...notes.map(([shot, note]) => `- ${shot}: ${note}`));
  }
}
const text = `${lines.join('\n')}\n`;
writeFileSync(join(RESULTS, 'compare-summary.md'), text);
console.log(text);
