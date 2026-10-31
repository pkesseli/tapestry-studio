import { expect, test } from 'vitest';
import { exportScreenplay } from './export';
import { parseFountain } from './fountain';

const SCRIPT = `Title: Test

INT. HARBOR - NIGHT

MARIA lifts a lantern. [[remember to fix]] Fog.
[[direction: slow push-in, thick fog]]

MARIA
Hello?

/* cut this
   whole block */

[[a private note on its own]]

EXT. DECK - DAWN

Tom waits.
`;

test('removes notes, directions and boneyard and closes the gaps', () => {
  expect(exportScreenplay(SCRIPT)).toBe(
    'Title: Test\n\nINT. HARBOR - NIGHT\n\nMARIA lifts a lantern. Fog.\n\nMARIA\nHello?\n\nEXT. DECK - DAWN\n\nTom waits.\n',
  );
});

test('can keep directions for a copy meant for the crew', () => {
  const kept = exportScreenplay(SCRIPT, { keepDirections: true });
  expect(kept).toContain('[[direction: slow push-in, thick fog]]');
  expect(kept).not.toContain('remember to fix');
  expect(kept).not.toContain('cut this');
});

test('the exported text parses to the same scenes', () => {
  const headings = (text: string) => parseFountain(text).scenes.map((s) => s.heading.text);
  expect(headings(exportScreenplay(SCRIPT))).toEqual(headings(SCRIPT));
});

test('text without notes is unchanged', () => {
  expect(exportScreenplay('INT. A - DAY\n\nHello.\n')).toBe('INT. A - DAY\n\nHello.\n');
});
