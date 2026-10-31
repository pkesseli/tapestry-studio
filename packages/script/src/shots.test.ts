import { expect, test } from 'vitest';
import { parseFountain } from './fountain';
import { planShots } from './shots';

/**
 * Plans the shots of the first scene of a screenplay.
 * @param text Screenplay text.
 */
const plan = (text: string) => planShots(parseFountain(text).scenes[0]!);

const SCRIPT = `INT. HARBOR - NIGHT

MARIA lifts a lantern and peers into the fog.

MARIA
Is anyone there?

NORA (O.S.)
(shouting)
Over here, Captain!

The beam swings toward the voice.
`;

test('plans one shot per action paragraph and one per spoken line, in order', () => {
  const shots = plan(SCRIPT);
  expect(shots.map((s) => [s.kind, s.action])).toEqual([
    ['action', 'MARIA lifts a lantern and peers into the fog.'],
    ['line', 'MARIA: Is anyone there?'],
    ['line', 'NORA: Over here, Captain!'],
    ['action', 'The beam swings toward the voice.'],
  ]);
  expect(shots[1]).toMatchObject({ speaker: 'MARIA', line: 'Is anyone there?' });
});

test('shot ranges point at the text that produced them, in order', () => {
  const shots = plan(SCRIPT);
  expect(SCRIPT.slice(shots[0]!.range.start, shots[0]!.range.end)).toBe(
    'MARIA lifts a lantern and peers into the fog.',
  );
  expect(SCRIPT.slice(shots[3]!.range.start, shots[3]!.range.end)).toBe(
    'The beam swings toward the voice.',
  );
  const starts = shots.map((s) => s.range.start);
  expect(starts).toEqual([...starts].sort((a, b) => a - b));
});

test('durations follow the amount of text and stay within limits', () => {
  const [action, line] = plan(SCRIPT);
  expect(action!.durationSeconds).toBeGreaterThanOrEqual(2);
  expect(line!.durationSeconds).toBeLessThanOrEqual(10);
  expect(plan(`INT. A - DAY\n\n${'word '.repeat(80)}\n`)[0]!.durationSeconds).toBe(10);
  expect(plan('INT. A - DAY\n\nHi.\n')[0]!.durationSeconds).toBe(2);
});

test('direction notes attach to the shot above them, or the first shot when none is above', () => {
  const shots = plan(
    'INT. A - DAY\n\n[[direction: warm light]]\nOne.\n\nTwo.\n[[direction: slow push-in]]\n[[direction: low angle]]\n[[just a reminder]]\n',
  );
  expect(shots.map((s) => s.direction)).toEqual(['warm light', 'slow push-in low angle']);
});

test('a scene with no text plans no shots', () => {
  expect(plan('INT. A - DAY\n')).toEqual([]);
});
