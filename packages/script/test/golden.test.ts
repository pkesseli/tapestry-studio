import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Entity } from '@tapestry/core';
import { buildSampleFilm, buildSampleSong } from '@tapestry/core/testing';
import { expect, test } from 'vitest';
import { analyze, scriptKindOf } from '../src';
import type { Analysis } from '../src';

/** Folder with the sample inputs and their expected summaries. */
const DATA = join(dirname(fileURLToPath(import.meta.url)), 'data');

/** Set `UPDATE_GOLDEN=1` to rewrite the expected summaries; review the diff before committing. */
const UPDATE = process.env['UPDATE_GOLDEN'] === '1';

/** Entities the samples are analysed against: the sample film's, plus the song's with short aliases. */
const ENTITIES: Entity[] = [
  ...buildSampleFilm().entities,
  ...buildSampleSong().entities.map((entity) =>
    entity.name === 'Acoustic guitar'
      ? { ...entity, aliases: ['guitar'] }
      : entity.name === 'Upright piano'
        ? { ...entity, aliases: ['piano'] }
        : entity,
  ),
];

/**
 * Reduces an analysis to a readable summary: structure, mentions with the text they cover, and diagnostics.
 * @param analysis Result of `analyze`.
 */
function summarize(analysis: Analysis) {
  const slice = (r: { start: number; end: number }) => analysis.text.slice(r.start, r.end);
  return {
    title: analysis.song?.title,
    elements: analysis.fountain?.elements.map((e) => ({
      type: e.type,
      text: 'text' in e ? e.text : 'name' in e ? e.name : e.entries,
    })),
    scenes: analysis.fountain?.scenes.map((s) => ({
      heading: s.heading.text,
      sceneNumber: s.heading.sceneNumber,
      location: s.heading.locationName,
      timeOfDay: s.heading.timeOfDay,
      beats: s.beats.map((b) => ({
        action: b.action,
        dialogue: b.dialogue.map(({ range: _r, ...d }) => d),
      })),
    })),
    sections: analysis.song?.sections.map(
      ({ range: _r, nameRange: _n, singers, lyrics, instruments, ...s }) => ({
        ...s,
        singers: singers.map((x) => x.name),
        lyrics: lyrics.map((l) => ({ text: l.text, singer: l.singer })),
        instruments: instruments.map((i) => ({
          name: i.name,
          direction: i.direction,
          enabled: i.enabled,
        })),
      }),
    ),
    mentions: analysis.mentions.map((m) => ({
      text: m.text,
      covers: slice(m.range),
      source: m.source,
      kind: m.kind,
      status: m.status,
    })),
    diagnostics: analysis.diagnostics.map((d) => ({
      covers: slice(d.range),
      severity: d.severity,
      message: d.message,
    })),
  };
}

const inputs = readdirSync(DATA).filter((name) => scriptKindOf(name) !== undefined);

test('there are at least 5 sample screenplays and 2 sample songs', () => {
  expect(inputs.filter((n) => !n.endsWith('.song.md')).length).toBeGreaterThanOrEqual(5);
  expect(inputs.filter((n) => n.endsWith('.song.md')).length).toBeGreaterThanOrEqual(2);
});

test.each(inputs)('%s matches its golden summary', (name) => {
  const text = readFileSync(join(DATA, name), 'utf8');
  const analysis = analyze(scriptKindOf(name) ?? 'fountain', text, ENTITIES);
  const actual = JSON.stringify(summarize(analysis), null, 2) + '\n';
  const goldenPath = join(DATA, `${name}.golden.json`);
  if (UPDATE) writeFileSync(goldenPath, actual);
  expect(actual).toBe(readFileSync(goldenPath, 'utf8'));
});
