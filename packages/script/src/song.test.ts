import { expect, test } from 'vitest';
import { inferSectionKind, parseSong } from './song';

test('reads heading settings in any order', () => {
  const [section] = parseSong('## Verse 1 [Am, 8 bars, 90 bpm, 30 sec]\nHello\n').sections;
  expect(section).toMatchObject({
    name: 'Verse 1',
    kind: 'verse',
    bars: 8,
    tempoBpm: 90,
    seconds: 30,
    key: 'Am',
  });
});

test('infers the role of a section from its name', () => {
  const names = ['Verse 2', 'Pre-Chorus', 'Chorus', 'Bridge', 'Intro', 'Outro', 'Tag'];
  expect(names.map(inferSectionKind)).toEqual([
    'verse',
    'pre-chorus',
    'chorus',
    'bridge',
    'intro',
    'outro',
    'other',
  ]);
  expect(inferSectionKind('Solo (guitar)')).toBe('solo');
});

test('assigns singers to the lyrics that follow them until the next @ line', () => {
  const [section] = parseSong('## A\n@Alice\none\n@Bob\ntwo\n').sections;
  expect(section?.lyrics.map((l) => [l.text, l.singer])).toEqual([
    ['one', 'Alice'],
    ['two', 'Bob'],
  ]);
});

test('reads instrument notes, including the silent shorthand', () => {
  const [section] = parseSong('## A\n[guitar: soft, sparse]\n[piano off]\n[bass]\n').sections;
  expect(section?.instruments.map((i) => [i.name, i.direction, i.enabled])).toEqual([
    ['guitar', 'soft, sparse', true],
    ['piano', 'off', false],
    ['bass', '', true],
  ]);
});

test('a singer or instrument range points at the name only', () => {
  const source = '## A\n@Lead singer\n[guitar: soft]\n';
  const [section] = parseSong(source).sections;
  const singer = section?.singers[0]?.range;
  const instrument = section?.instruments[0]?.nameRange;
  expect(singer && source.slice(singer.start, singer.end)).toBe('Lead singer');
  expect(instrument && source.slice(instrument.start, instrument.end)).toBe('guitar');
});

test('warns about unknown settings and text before the first section', () => {
  const doc = parseSong('stray\n## A [loud]\n');
  expect(doc.diagnostics.map((d) => d.message)).toEqual([
    'Text before the first "## Section" heading is ignored',
    'Section setting "loud" is not understood (use e.g. 8 bars, 90 bpm, Am)',
  ]);
});

test('reads the title and ignores comments and blank lines', () => {
  const doc = parseSong('# My Song\n\n## A\n// note\nline\n');
  expect(doc.title).toBe('My Song');
  expect(doc.sections[0]?.lyrics.map((l) => l.text)).toEqual(['line']);
});
