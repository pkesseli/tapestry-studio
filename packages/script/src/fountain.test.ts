import { expect, test } from 'vitest';
import { parseFountain } from './fountain';

/** A small script covering most element types. */
const SCRIPT = `INT. HARBOR - NIGHT

MARIA lifts a lantern.

MARIA (V.O.)
(softly)
Is anyone there?
Hello?

CUT TO:

.BACK AT SEA

> THE END <
`;

test('every text element covers exactly its own text in the source', () => {
  const doc = parseFountain(SCRIPT);
  for (const element of doc.elements) {
    if ('text' in element) {
      expect(SCRIPT.slice(element.range.start, element.range.end), element.type).toContain(
        element.text,
      );
    }
  }
  const cue = doc.elements.find((e) => e.type === 'character');
  expect(cue?.type === 'character' && SCRIPT.slice(cue.nameRange.start, cue.nameRange.end)).toBe(
    'MARIA',
  );
});

test('splits scene headings into place and time of day, including several time words', () => {
  const heading = (text: string) => {
    const element = parseFountain(`\n${text}\n`).scenes[0]?.heading;
    return { place: element?.locationName, time: element?.timeOfDay, number: element?.sceneNumber };
  };
  expect(heading('INT. HOUSE - KITCHEN - CONTINUOUS')).toEqual({
    place: 'HOUSE - KITCHEN',
    time: 'CONTINUOUS',
  });
  expect(heading('EXT. FOREST - DAY - LATER')).toEqual({ place: 'FOREST', time: 'DAY - LATER' });
  expect(heading('INT./EXT. CAR - NIGHT #12A#')).toEqual({
    place: 'CAR',
    time: 'NIGHT',
    number: '12A',
  });
  expect(heading('EXT. PIER')).toEqual({ place: 'PIER' });
  expect(heading('.UNDERWATER')).toEqual({ place: 'UNDERWATER' });
});

test('a forced scene heading does not include its dot', () => {
  const heading = parseFountain('.BACK AT SEA\n').scenes[0]?.heading;
  expect(heading?.text).toBe('BACK AT SEA');
  expect(heading?.range).toEqual({ start: 1, end: 12 });
});

test('groups action and dialogue into beats, merging dialogue lines and keeping parentheticals', () => {
  const [scene] = parseFountain(SCRIPT).scenes;
  expect(scene?.beats).toHaveLength(1);
  expect(scene?.beats[0]?.action).toBe('MARIA lifts a lantern.');
  expect(scene?.beats[0]?.dialogue).toMatchObject([
    { speaker: 'MARIA', text: 'Is anyone there? Hello?', parenthetical: '(softly)' },
  ]);
});

test('reads extensions, dual dialogue marks and forced cues', () => {
  const doc = parseFountain("\nBRICK (cont'd) ^\nHi.\n\n@mcClane\nYo.\n");
  const cues = doc.elements.flatMap((e) => (e.type === 'character' ? [e] : []));
  expect(cues.map((c) => c.name)).toEqual(['BRICK', 'mcClane']);
  expect(cues[0]?.extension).toBe("cont'd");
});

test('hidden notes and boneyard never become text but keep offsets valid', () => {
  const source = 'INT. A - DAY\n\nHe waits. [[remember to fix]] /* gone */ Then leaves.\n';
  const action = parseFountain(source).elements.find((e) => e.type === 'action');
  expect(action?.type === 'action' && action.text.replace(/\s+/g, ' ')).toBe(
    'He waits. Then leaves.',
  );
  expect(
    action?.type === 'action' && source.slice(action.range.start, action.range.start + 8),
  ).toBe('He waits');
});

test('Windows line endings give the same structure and valid offsets', () => {
  const source = SCRIPT.replace(/\n/g, '\r\n');
  const windows = parseFountain(source);
  expect(windows.elements.map((e) => e.type)).toEqual(
    parseFountain(SCRIPT).elements.map((e) => e.type),
  );
  const cue = windows.elements.find((e) => e.type === 'character');
  expect(cue?.type === 'character' && source.slice(cue.nameRange.start, cue.nameRange.end)).toBe(
    'MARIA',
  );
});

test('an uppercase line without dialogue below it is action, not a character', () => {
  const doc = parseFountain('INT. A - DAY\n\nSILENCE FALLS.\n\nThe end.\n');
  expect(doc.elements.map((e) => e.type)).toEqual(['scene-heading', 'action', 'action']);
});

test('parses a title page with continuation lines', () => {
  const doc = parseFountain('Title:\n  _Big Fish_\nAuthor: Me\n\nINT. A - DAY\n');
  expect(doc.preamble[0]).toMatchObject({
    type: 'title-page',
    entries: [
      { key: 'Title', value: '_Big Fish_' },
      { key: 'Author', value: 'Me' },
    ],
  });
});

test('empty and heading-less text parse without error', () => {
  expect(parseFountain('').scenes).toEqual([]);
  expect(parseFountain('Just some action.\n').preamble).toHaveLength(1);
});

test('scenes remember the act (a level-one section) they sit under', () => {
  const doc = parseFountain(
    'INT. A - DAY\n\nBefore any act.\n\n# Act One\n\nINT. B - DAY\n\nOne.\n\n## Sequence\n\nINT. C - DAY\n\nTwo.\n\n# Act Two\n\nINT. D - DAY\n\nThree.\n',
  );
  expect(doc.scenes.map((s) => [s.heading.locationName, s.act])).toEqual([
    ['A', undefined],
    ['B', 'Act One'],
    ['C', 'Act One'],
    ['D', 'Act Two'],
  ]);
  const section = doc.elements.find((e) => e.type === 'section');
  expect(section?.type === 'section' && section.depth).toBe(1);
});
