import { buildSampleFilm } from '@tapestry/core/testing';
import { expect, test } from 'vitest';
import { analyze } from '../src';

/** Lines on a printed screenplay page; a 120-page script is about 6,600 lines. */
const LINES_PER_PAGE = 55;

/** Builds a synthetic screenplay of the given length with scenes, action, cues and dialogue. */
function longScript(pages: number): string {
  const lines: string[] = [];
  for (let scene = 0; lines.length < pages * LINES_PER_PAGE; scene++) {
    lines.push('', `INT. LOCATION ${scene} - NIGHT`, '');
    lines.push(
      'MARIA crosses the room carrying a LANTERN. TOM watches the DOOR close behind her.',
      '',
    );
    for (let line = 0; line < 4; line++) {
      lines.push(
        line % 2 === 0 ? 'MARIA' : 'TOM (O.S.)',
        '(quietly)',
        'We should not be here at this hour.',
        'Nobody will know.',
        '',
      );
    }
    lines.push('Rain taps the window. A clock ticks somewhere in the dark house.', '');
  }
  return lines.join('\n');
}

test('analysing a 120-page screenplay takes well under 20 ms', () => {
  const text = longScript(120);
  const entities = buildSampleFilm().entities;
  expect(text.split('\n').length).toBeGreaterThan(6000);
  analyze('fountain', text, entities);
  const timings: number[] = [];
  for (let run = 0; run < 15; run++) {
    const start = performance.now();
    analyze('fountain', text, entities);
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  const median = timings[Math.floor(timings.length / 2)] ?? Infinity;
  console.log(`120-page analysis: median ${median.toFixed(1)} ms`);
  expect(median).toBeLessThan(20);
});
