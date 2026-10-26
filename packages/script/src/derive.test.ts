import type { Entity, Id, Scene, Section } from '@tapestry/core';
import { buildSampleFilm, buildSampleSong, sampleId } from '@tapestry/core/testing';
import { expect, test } from 'vitest';
import { analyze } from './analyze';
import { deriveScenes, deriveSections } from './derive';
import type { IdSource } from './derive';

/** Deterministic ids: scn_…10, scn_…11, … so tests can tell old from new. */
function ids(): IdSource {
  let scene = 10;
  let section = 10;
  return {
    scene: () => sampleId('scn', scene++ % 10) as Id<'scn'>,
    section: () => sampleId('sec', section++ % 10) as Id<'sec'>,
  };
}

const film = buildSampleFilm();
const song = buildSampleSong();

/**
 * Derives scenes from a screenplay text.
 * @param text Screenplay.
 * @param previous Scenes from the previous version of the text.
 */
function scenesOf(text: string, previous: Scene[] = []): Scene[] {
  const analysis = analyze('fountain', text, film.entities);
  return deriveScenes(analysis.fountain!, analysis.mentions, previous, ids());
}

const SCRIPT = `INT. HARBOR - NIGHT

MARIA lifts a LANTERN.

MARIA
Hello?

EXT. FERRY DECK - DAWN

Tom waits.
`;

test('derives scenes with place, people, props and description from the text', () => {
  const [first, second] = scenesOf(SCRIPT);
  expect(first).toMatchObject({
    number: 1,
    heading: 'INT. HARBOR - NIGHT',
    locationId: sampleId('loc', 1),
    description: 'MARIA lifts a LANTERN.',
    shots: [],
  });
  expect(first?.entityIds).toEqual([sampleId('chr', 1), sampleId('prp', 1)]);
  expect(second).toMatchObject({ number: 2, heading: 'EXT. FERRY DECK - DAWN', entityIds: [] });
  expect(second?.locationId).toBeUndefined();
});

test('re-parsing keeps ids and shots when scenes are inserted, reordered or lightly renamed', () => {
  const before = scenesOf(SCRIPT).map((scene, i) => ({
    ...scene,
    id: sampleId('scn', i + 1),
    shots: [film.scenes[0]!.shots[0]!],
  }));
  const [harbor, deck] = before;

  const inserted = scenesOf(
    SCRIPT.replace('EXT. FERRY', 'INT. CABIN - DAY\n\nQuiet.\n\nEXT. FERRY'),
    before,
  );
  expect(inserted.map((s) => s.id)).toEqual([harbor!.id, sampleId('scn', 0), deck!.id]);
  expect(inserted[0]?.shots).toHaveLength(1);
  expect(inserted[1]?.shots).toEqual([]);

  const renamed = scenesOf(SCRIPT.replace('NIGHT', 'DUSK'), before);
  expect(renamed.map((s) => s.id)).toEqual([harbor!.id, deck!.id]);

  const swapped = scenesOf(
    'EXT. FERRY DECK - DAWN\n\nTom waits.\n\nINT. HARBOR - NIGHT\n\nMARIA lifts a LANTERN.\n',
    before,
  );
  expect(swapped.map((s) => s.id)).toEqual([deck!.id, harbor!.id]);
  expect(swapped.map((s) => s.number)).toEqual([1, 2]);
});

test('unknown people are left out until they exist, then picked up on the next derivation', () => {
  const text = 'INT. HARBOR - NIGHT\n\nNORA waves.\n';
  expect(scenesOf(text)[0]?.entityIds).toEqual([]);
  const tom = film.entities[1];
  if (tom?.kind !== 'character') throw new Error('sample data changed');
  const nora: Entity = { ...tom, name: 'Nora', id: sampleId('chr', 5) };
  const analysis = analyze('fountain', text, [...film.entities, nora]);
  const [scene] = deriveScenes(analysis.fountain!, analysis.mentions, [], ids());
  expect(scene?.entityIds).toEqual([sampleId('chr', 5)]);
});

const SONG = `## Verse 1 [8 bars, 92 bpm, Am]
@Lead singer
[guitar: fingerpicked]
The fog rolls in

## Chorus
Carry me home
`;

/** Song entities with short aliases for the instruments. */
const songEntities = song.entities.map((e) =>
  e.name === 'Acoustic guitar' ? { ...e, aliases: ['guitar'] } : e,
);

/**
 * Derives sections from a song text.
 * @param text Song outline.
 * @param previous Sections from the previous version of the text.
 */
function sectionsOf(text: string, previous: Section[] = []): Section[] {
  return deriveSections(analyze('song', text, songEntities).song!, songEntities, previous, ids());
}

test('derives sections with settings, lyrics, singers and arrangement from the text', () => {
  const [verse, chorus] = sectionsOf(SONG);
  expect(verse).toMatchObject({
    number: 1,
    name: 'Verse 1',
    kind: 'verse',
    bars: 8,
    tempoBpm: 92,
    key: 'Am',
    lyrics: [{ text: 'The fog rolls in', voiceId: sampleId('voc', 1) }],
    tracks: [
      {
        instrumentId: sampleId('ins', 1),
        role: 'rhythm',
        direction: 'fingerpicked',
        enabled: true,
      },
    ],
  });
  expect(chorus).toMatchObject({
    number: 2,
    kind: 'chorus',
    lyrics: [{ text: 'Carry me home' }],
    tracks: [],
  });
});

test('re-parsing a song keeps ids, the arrangement grid and the scored scene; text wins where it speaks', () => {
  const [verse] = sectionsOf(SONG);
  const piano = {
    instrumentId: sampleId('ins', 2),
    role: 'pad' as const,
    direction: 'soft',
    enabled: true,
  };
  const stored: Section[] = [
    {
      ...verse!,
      id: sampleId('sec', 1),
      tracks: [...verse!.tracks, piano],
      scoresSceneId: sampleId('scn', 1),
    },
  ];
  const [again] = sectionsOf(SONG.replace('fingerpicked', 'strummed'), stored);
  expect(again?.id).toBe(sampleId('sec', 1));
  expect(again?.scoresSceneId).toBe(sampleId('scn', 1));
  expect(again?.tracks.map((t) => [t.instrumentId, t.direction])).toEqual([
    [sampleId('ins', 2), 'soft'],
    [sampleId('ins', 1), 'strummed'],
  ]);
});
