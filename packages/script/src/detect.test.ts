import type { Entity } from '@tapestry/core';
import { buildSampleFilm } from '@tapestry/core/testing';
import { expect, test } from 'vitest';
import { detectFountainMentions } from './detect';
import { parseFountain } from './fountain';

/** The sample film's characters, location, prop and voice. */
const entities: Entity[] = buildSampleFilm().entities;

/**
 * Detects mentions in a screenplay.
 * @param source Screenplay text.
 * @param known Entities to resolve against.
 */
function detect(source: string, known: Entity[] = entities) {
  return detectFountainMentions(parseFountain(source), known).map((m) => ({
    text: m.text,
    covers: source.slice(m.range.start, m.range.end),
    kind: m.kind,
    status: m.status,
    source: m.source,
  }));
}

test('resolves characters, places and props that exist, in any case and with accents', () => {
  const found = detect('INT. HARBOR - NIGHT\n\nMARÍA lifts a LANTERN.\n\nmaria\nHi.\n');
  expect(found.map((m) => [m.covers, m.status, m.kind])).toEqual([
    ['HARBOR', 'resolved', 'location'],
    ['MARÍA', 'resolved', 'character'],
    ['LANTERN', 'resolved', 'prop'],
  ]);
});

test('lower-case cues are not characters, so they produce no mention', () => {
  expect(
    detect('INT. A - DAY\n\nmaria\nHi.\n').filter((m) => m.source === 'character-cue'),
  ).toEqual([]);
});

test('unknown names are suggested as the right kind', () => {
  const found = detect('EXT. DOCK - DAY\n\nNORA ties a ROPE to the post.\n\nNORA\nReady.\n', []);
  expect(found.map((m) => [m.covers, m.kind, m.status, m.source])).toEqual([
    ['DOCK', 'location', 'unresolved', 'scene-heading'],
    ['NORA', 'character', 'unresolved', 'action'],
    ['ROPE', 'prop', 'unresolved', 'action'],
    ['NORA', 'character', 'unresolved', 'character-cue'],
  ]);
});

test('a capitalised word later in a sentence is a prop unless it is a known cue name', () => {
  const found = detect('INT. A - DAY\n\nHe hands NORA the KEY.\n\nNORA\nThanks.\n', []);
  expect(found.filter((m) => m.source === 'action').map((m) => [m.covers, m.kind])).toEqual([
    ['NORA', 'character'],
    ['KEY', 'prop'],
  ]);
});

test('stop words, sounds and camera directions are not names', () => {
  const found = detect('INT. A - DAY\n\nTHE DOOR slams. BANG. SUDDENLY a CRASH. FADE IN.\n', []);
  expect(found.map((m) => m.covers)).toEqual(['A', 'DOOR']);
});

test('two entities with the same alias make the mention ambiguous', () => {
  const [maria, tom] = entities;
  if (maria?.kind !== 'character' || tom?.kind !== 'character') throw new Error('sample changed');
  const twins = [maria, { ...tom, aliases: ['Maria'] }];
  const found = detect('INT. A - DAY\n\nMARIA\nHi.\n', twins);
  expect(found.find((m) => m.source === 'character-cue')?.status).toBe('ambiguous');
});

test('multi-word names are one mention', () => {
  const found = detect('INT. A - DAY\n\nThe OLD MAN waits.\n', []);
  expect(found.map((m) => m.covers)).toContain('OLD MAN');
});

test('a name only resolves to entities of an allowed kind', () => {
  const voice = entities.find((e) => e.kind === 'voice');
  if (!voice) throw new Error('sample changed');
  const found = detect('INT. A - DAY\n\nMARIA VOICE\nHi.\n', [voice]);
  expect(found.find((m) => m.source === 'character-cue')?.status).toBe('unresolved');
});
