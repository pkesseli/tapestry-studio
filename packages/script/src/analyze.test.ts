import { buildSampleFilm } from '@tapestry/core/testing';
import { expect, test } from 'vitest';
import {
  analyze,
  completions,
  importScript,
  mentionAt,
  scriptKindOf,
  summarizeUnresolved,
} from './analyze';
import { fdxToFountain } from './fdx';

const entities = buildSampleFilm().entities;

/** A tiny Final Draft document with entities, a parenthetical and a transition. */
const FDX = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Version="5">
  <Content>
    <Paragraph Type="Scene Heading"><Text>INT. HARBOR - NIGHT</Text></Paragraph>
    <Paragraph Type="Action"><Text>Maria &amp; Tom </Text><Text>wait.</Text></Paragraph>
    <Paragraph Type="Character"><Text>Maria</Text></Paragraph>
    <Paragraph Type="Parenthetical"><Text>whispering</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>It&apos;s late.</Text></Paragraph>
    <Paragraph Type="Transition"><Text>CUT TO:</Text></Paragraph>
    <Paragraph Type="Scene Heading"><Text>Under the pier</Text></Paragraph>
  </Content>
</FinalDraft>`;

test('chooses the reader from the file name', () => {
  expect(scriptKindOf('script/main.fountain')).toBe('fountain');
  expect(scriptKindOf('notes.TXT')).toBe('fountain');
  expect(scriptKindOf('script/harbor-lights.song.md')).toBe('song');
  expect(scriptKindOf('README.md')).toBeUndefined();
});

test('finds the mention under the cursor, touching its first and last character', () => {
  const text = 'INT. HARBOR - NIGHT\n\nMARIA waves.\n';
  const analysis = analyze('fountain', text, entities);
  expect(mentionAt(analysis, text.indexOf('HARBOR'))?.text).toBe('HARBOR');
  expect(mentionAt(analysis, text.indexOf('HARBOR') + 6)?.text).toBe('HARBOR');
  expect(mentionAt(analysis, text.indexOf('MARIA') + 2)?.text).toBe('MARIA');
  expect(mentionAt(analysis, text.indexOf('waves'))).toBeUndefined();
});

test('suggests existing entities for a partly typed name', () => {
  expect(completions(entities, 'ma').map((e) => e.name)).toEqual(['Maria', 'Maria voice']);
  expect(completions(entities, 'ma', ['character']).map((e) => e.name)).toEqual(['Maria']);
  expect(completions(entities, 'maría').map((e) => e.name)).toEqual(['Maria', 'Maria voice']);
  expect(completions(entities, '')).toEqual([]);
  expect(completions(entities, 'zzz')).toEqual([]);
});

test('groups unresolved names so each is offered for creation once', () => {
  const text = 'INT. DOCK - DAY\n\nNORA waves.\n\nNORA\nHi.\n\nNORA\nAgain.\n';
  const groups = summarizeUnresolved(analyze('fountain', text, []).mentions);
  expect(groups.map((g) => [g.name, g.kind, g.count])).toEqual([
    ['DOCK', 'location', 1],
    ['NORA', 'character', 3],
  ]);
});

test('ambiguous names are reported as warnings', () => {
  const [maria, tom] = entities;
  if (maria?.kind !== 'character' || tom?.kind !== 'character') throw new Error('sample changed');
  const analysis = analyze('fountain', 'INT. A - DAY\n\nMARIA\nHi.\n', [
    maria,
    { ...tom, aliases: ['Maria'] },
  ]);
  expect(analysis.diagnostics.map((d) => d.message)).toEqual([
    '"MARIA" could be more than one character',
  ]);
});

test('converts Final Draft paragraphs to Fountain', () => {
  expect(fdxToFountain(FDX)).toBe(
    [
      'INT. HARBOR - NIGHT',
      '',
      'Maria & Tom wait.',
      '',
      'MARIA',
      '(whispering)',
      "It's late.",
      '',
      '> CUT TO:',
      '',
      '.UNDER THE PIER',
      '',
    ].join('\n'),
  );
});

test('imports a Final Draft file through the normal analysis', () => {
  const analysis = importScript('draft.fdx', FDX, entities);
  expect(analysis.fountain?.scenes.map((s) => s.heading.text)).toEqual([
    'INT. HARBOR - NIGHT',
    'UNDER THE PIER',
  ]);
  expect(analysis.fountain?.scenes[0]?.beats[0]?.dialogue).toMatchObject([
    { speaker: 'MARIA', text: "It's late.", parenthetical: '(whispering)' },
  ]);
  expect(() => importScript('picture.png', '', entities)).toThrow(/unknown script format/);
});
