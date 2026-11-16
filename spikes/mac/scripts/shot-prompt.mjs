#!/usr/bin/env node
/**
 * Prints the text prompt every video model gets for one shot: the shot's `prompt` followed by its `direction`, so
 * all candidates in plans 10 and 10b receive exactly the same words.
 *
 *   node spikes/mac/scripts/shot-prompt.mjs S01
 */
import { readFileSync } from 'node:fs';

const shots = JSON.parse(
  readFileSync(new URL('../../draft-final/shots.json', import.meta.url), 'utf8'),
).shots;
const shot = shots.find((s) => s.id === process.argv[2]);
if (!shot) {
  console.error(
    `Unknown shot ${process.argv[2]}; expected one of ${shots.map((s) => s.id).join(', ')}.`,
  );
  process.exit(2);
}
console.log(`${shot.prompt} Direction: ${shot.direction}.`);
