import { AliasIndex, newId, normalizeAlias } from '@tapestry/core';
import type { Entity, Id, Instrument, Scene, Section } from '@tapestry/core';
import { alignKeys } from './align';
import type { FountainDocument } from './fountain';
import type { SongDocument } from './song';
import type { Mention } from './types';

/** Creates ids for new units; tests inject a deterministic one. */
export interface IdSource {
  scene(): Id<'scn'>;
  section(): Id<'sec'>;
}

/** Ids from the platform generator. */
const DEFAULT_IDS: IdSource = { scene: () => newId('scn'), section: () => newId('sec') };

/**
 * Key used to recognise a scene across edits: its heading without scene number, case and accents.
 * @param heading Heading text.
 */
const headingKey = (heading: string): string =>
  normalizeAlias(heading.replace(/\s#[^#]+#\s*$/, ''));

/**
 * Builds the scenes of a screenplay from its text. Scenes keep their id and their user-edited shots across edits:
 * a scene is recognised by its heading (see `alignKeys`), so reordering, inserting and lightly renaming scenes all
 * preserve ids. Everything derivable from the text (heading, place, who is present, description) is refreshed.
 * @param doc Parsed screenplay.
 * @param mentions Mentions found in it (from `detectFountainMentions`).
 * @param previous Scenes derived from the previous version of the text.
 * @param ids Source of ids for new scenes.
 */
export function deriveScenes(
  doc: FountainDocument,
  mentions: readonly Mention[],
  previous: readonly Scene[],
  ids: IdSource = DEFAULT_IDS,
): Scene[] {
  const match = alignKeys(
    previous.map((scene) => headingKey(scene.heading)),
    doc.scenes.map((scene) => headingKey(scene.heading.text)),
  );
  return doc.scenes.map((parsed, index) => {
    const old = match[index] === undefined ? undefined : previous[match[index] as number];
    const start = parsed.heading.range.start;
    const next = doc.scenes[index + 1]?.heading.range.start ?? Infinity;
    const inScene = mentions.filter(
      (m) => m.status === 'resolved' && m.range.start >= start && m.range.start < next,
    );
    const location = inScene.find((m) => m.source === 'scene-heading');
    const present = inScene.filter((m) => m.source !== 'scene-heading').flatMap((m) => m.entityIds);
    return {
      id: old?.id ?? ids.scene(),
      number: index + 1,
      heading: parsed.heading.text.replace(/\s#[^#]+#\s*$/, ''),
      ...(location?.entityIds[0] !== undefined && {
        locationId: location.entityIds[0] as Id<'loc'>,
      }),
      entityIds: [...new Set(present)] as Scene['entityIds'],
      description: parsed.beats
        .map((beat) => beat.action)
        .filter(Boolean)
        .join('\n\n'),
      shots: old?.shots ?? [],
    };
  });
}

/**
 * Builds the sections of a song from its text, keeping ids across edits like {@link deriveScenes}. Instrument lines in
 * the text win for the instruments they mention; arrangement entries for other instruments (made in the arrangement
 * grid) and the film scene a section scores are kept from the previous version.
 * @param doc Parsed song.
 * @param entities The project's entities, to resolve singers and instruments.
 * @param previous Sections derived from the previous version of the text.
 * @param ids Source of ids for new sections.
 */
export function deriveSections(
  doc: SongDocument,
  entities: readonly Entity[],
  previous: readonly Section[],
  ids: IdSource = DEFAULT_IDS,
): Section[] {
  const index = new AliasIndex(entities);
  const match = alignKeys(
    previous.map((section) => normalizeAlias(section.name)),
    doc.sections.map((section) => normalizeAlias(section.name)),
  );
  const find = <K extends Entity['kind']>(
    name: string,
    kind: K,
  ): Extract<Entity, { kind: K }> | undefined => {
    const found = index.resolve(name).filter((entity) => entity.kind === kind);
    return found.length === 1 ? (found[0] as Extract<Entity, { kind: K }>) : undefined;
  };
  return doc.sections.map((parsed, i) => {
    const old = match[i] === undefined ? undefined : previous[match[i] as number];
    const fromText = parsed.instruments.flatMap((note) => {
      const instrument: Instrument | undefined = find(note.name, 'instrument');
      return instrument
        ? [
            {
              instrumentId: instrument.id,
              role: instrument.role,
              direction: note.direction,
              enabled: note.enabled,
            },
          ]
        : [];
    });
    const kept = (old?.tracks ?? []).filter(
      (track) => !fromText.some((t) => t.instrumentId === track.instrumentId),
    );
    return {
      id: old?.id ?? ids.section(),
      number: i + 1,
      name: parsed.name,
      kind: parsed.kind,
      ...(parsed.bars !== undefined && { bars: parsed.bars }),
      ...(parsed.seconds !== undefined && { seconds: parsed.seconds }),
      ...(parsed.tempoBpm !== undefined && { tempoBpm: parsed.tempoBpm }),
      ...(parsed.key !== undefined && { key: parsed.key }),
      lyrics: parsed.lyrics.map((lyric) => {
        const voice = lyric.singer === undefined ? undefined : find(lyric.singer, 'voice');
        return { text: lyric.text, ...(voice && { voiceId: voice.id }) };
      }),
      tracks: [...kept, ...fromText],
      ...(old?.scoresSceneId !== undefined && { scoresSceneId: old.scoresSceneId }),
    };
  });
}
