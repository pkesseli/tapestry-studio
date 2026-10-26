import type { Id, IdPrefix } from '../ids';
import { SCHEMA_VERSION } from '../schema/common';
import type { ProjectData } from '../storage';

/** Fixed timestamp used by all sample data so fixtures stay byte-stable. */
const T = '2026-10-26T09:00:00.000Z';

/** A SHA-256-shaped digest made of one repeated hex digit; stands in for real file hashes in samples. */
const hash = (digit: string): string => digit.repeat(64);

/**
 * Builds a predictable id for samples: the prefix followed by 25 zeros and one digit.
 * @param prefix Kind prefix.
 * @param n Single digit 0-9 that distinguishes ids of the same kind.
 */
export function sampleId<P extends IdPrefix>(prefix: P, n: number): Id<P> {
  return `${prefix}_${'0'.repeat(25)}${n}`;
}

/** Fields shared by all sample entities that have nothing interesting to say. */
const blank = { aliases: [], description: '', references: [], canonicalSheet: [], notes: '' };

/** A short film with two characters, a location, a prop, a voice, one scene, one finished job and a timeline. */
export function buildSampleFilm(): ProjectData {
  const maria = sampleId('chr', 1);
  const tom = sampleId('chr', 2);
  const voice = sampleId('voc', 1);
  const harbor = sampleId('loc', 1);
  const lantern = sampleId('prp', 1);
  const art = sampleId('art', 1);
  const job = sampleId('job', 1);
  return {
    project: {
      schemaVersion: SCHEMA_VERSION,
      id: sampleId('prj', 1),
      name: 'The Last Ferry',
      createdAt: T,
      settings: {
        aspectRatio: '16:9',
        fps: 24,
        simpleMode: true,
        defaultProviders: { video: 'mock' },
      },
      budget: { currency: 'USD', projectCap: 25, perApprovalCap: 5 },
    },
    scripts: {
      'script/main.fountain':
        'INT. HARBOR - NIGHT\n\nMARIA lifts a lantern.\n\nMARIA\nIs anyone there?\n',
    },
    entities: [
      {
        ...blank,
        kind: 'character',
        id: maria,
        name: 'Maria',
        aliases: ['María'],
        description: 'A ferry captain in her forties.',
        references: [
          {
            path: 'entities/characters/' + maria + '/ref/face.png',
            mediaType: 'image',
            role: 'face',
          },
        ],
        canonicalSheet: ['entities/characters/' + maria + '/ref/face.png'],
        appearance: 'Weathered face, grey braid, yellow raincoat.',
        wardrobe: [],
        voiceId: voice,
      },
      {
        ...blank,
        kind: 'character',
        id: tom,
        name: 'Tom',
        appearance: 'Young deckhand.',
        wardrobe: [],
      },
      {
        ...blank,
        kind: 'location',
        id: harbor,
        name: 'Harbor',
        mood: 'Lonely',
        lighting: 'Sodium lamps and fog',
        timeVariants: [],
      },
      { ...blank, kind: 'prop', id: lantern, name: 'Lantern' },
      {
        ...blank,
        kind: 'voice',
        id: voice,
        name: 'Maria voice',
        language: 'en-US',
        style: 'Low, calm, a little hoarse',
      },
    ],
    scenes: [
      {
        id: sampleId('scn', 1),
        number: 1,
        heading: 'INT. HARBOR - NIGHT',
        locationId: harbor,
        entityIds: [maria, lantern],
        description: 'Maria searches the empty pier.',
        shots: [
          {
            id: sampleId('sht', 1),
            action: 'Maria lifts a lantern and looks into the fog.',
            dialogue: [{ id: sampleId('lin', 1), speakerId: maria, text: 'Is anyone there?' }],
            durationSeconds: 6,
            referenceEntityIds: [maria],
          },
        ],
      },
    ],
    sections: [],
    jobs: [
      {
        id: job,
        state: 'accepted',
        request: {
          capability: 'video',
          provider: { providerId: 'mock' },
          prompt: 'Maria lifts a lantern and looks into the fog.',
          references: [{ path: 'entities/characters/' + maria + '/ref/face.png', role: 'face' }],
          audioInputs: [],
          durationSeconds: 6,
          seed: 7,
          extras: {},
        },
        targetId: sampleId('sht', 1),
        estimate: { cost: 0, seconds: 1, notes: 'Mock provider' },
        actualCost: 0,
        artifactIds: [art],
        history: [
          { at: T, to: 'draft', actor: 'system' },
          { at: T, from: 'draft', to: 'accepted', actor: 'user', note: 'Looks great' },
        ],
        createdAt: T,
        updatedAt: T,
      },
    ],
    artifacts: [
      {
        id: art,
        jobId: job,
        files: [
          { path: 'artifacts/' + art + '/clip.mp4', mediaType: 'video', contentHash: hash('a') },
        ],
        accepted: true,
        acceptedAt: T,
        provenance: {
          providerId: 'mock',
          model: 'mock-video',
          seed: 7,
          inputsHash: hash('b'),
          referencePaths: ['entities/characters/' + maria + '/ref/face.png'],
        },
        notes: '',
        createdAt: T,
      },
    ],
    timelines: [
      {
        id: sampleId('tln', 1),
        name: 'Main cut',
        fps: 24,
        tracks: [
          {
            id: sampleId('trk', 1),
            kind: 'video',
            name: 'Picture',
            clips: [
              {
                id: sampleId('clp', 1),
                artifactId: art,
                startSeconds: 0,
                inSeconds: 0,
                outSeconds: 6,
                volume: 1,
                fadeInSeconds: 0,
                fadeOutSeconds: 0.5,
              },
            ],
          },
        ],
      },
    ],
  };
}

/** A short song with one voice, two instruments and three sections. */
export function buildSampleSong(): ProjectData {
  const singer = sampleId('voc', 1);
  const guitar = sampleId('ins', 1);
  const piano = sampleId('ins', 2);
  const section = (n: number, name: string, kind: 'verse' | 'chorus' | 'bridge', line: string) => ({
    id: sampleId('sec', n),
    number: n,
    name,
    kind,
    bars: 8,
    tempoBpm: 92,
    key: 'Am',
    lyrics: [{ text: line, voiceId: singer }],
    tracks: [
      {
        instrumentId: guitar,
        role: 'rhythm' as const,
        direction: 'Fingerpicked, sparse',
        enabled: kind !== 'bridge',
      },
      { instrumentId: piano, role: 'pad' as const, direction: 'Soft chords', enabled: true },
    ],
  });
  return {
    project: {
      schemaVersion: SCHEMA_VERSION,
      id: sampleId('prj', 2),
      name: 'Harbor Lights',
      createdAt: T,
      settings: {
        aspectRatio: '1:1',
        fps: 24,
        simpleMode: true,
        defaultProviders: { music: 'mock' },
      },
    },
    scripts: {
      'script/harbor-lights.song.md': '## Verse 1 [8 bars, 92 bpm, Am]\nThe fog rolls in\n',
    },
    entities: [
      {
        ...blank,
        kind: 'voice',
        id: singer,
        name: 'Lead singer',
        style: 'Warm alto',
        language: 'en-US',
      },
      {
        ...blank,
        kind: 'instrument',
        id: guitar,
        name: 'Acoustic guitar',
        family: 'strings',
        timbre: 'Warm',
        role: 'rhythm',
      },
      {
        ...blank,
        kind: 'instrument',
        id: piano,
        name: 'Upright piano',
        family: 'keys',
        timbre: 'Soft, felt',
        role: 'pad',
      },
    ],
    scenes: [],
    sections: [
      section(1, 'Verse 1', 'verse', 'The fog rolls in'),
      section(2, 'Chorus', 'chorus', 'Carry me home'),
      section(3, 'Bridge', 'bridge', 'Hold the light'),
    ],
    jobs: [],
    artifacts: [],
    timelines: [],
  };
}
