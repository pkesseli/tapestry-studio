import type { Entity, EntityKind } from '@tapestry/core';
import { normalizeAlias } from '@tapestry/core';
import type { Analysis, Mention, ParsedScene } from '@tapestry/script';
import { sceneTitle } from './format';

/** A scene as the scene list and the side panel see it. */
export interface SceneItem {
  /** Position in the film, starting at 1. */
  number: number;
  /** Short title such as "Harbor, night". */
  title: string;
  /** Offset of the heading in the text. */
  start: number;
  /** Offset where the next scene starts (or the end of the text). */
  end: number;
  /** The scene heading as written, for searching. */
  heading: string;
  /** The act (or part, chapter...) the scene sits under, if the script groups its scenes. */
  act?: string;
  /** Names written in the scene (characters, places, props), for searching. */
  names: string[];
}

/** A known entity that appears in a scene, with how often. */
export interface PresentEntity {
  entity: Entity;
  mentions: number;
}

/** What the side panel shows for one scene. */
export interface SceneContents {
  cast: PresentEntity[];
  places: PresentEntity[];
  things: PresentEntity[];
  /** Names with no entity yet, one per name and kind. */
  missing: { name: string; kind: EntityKind; count: number }[];
}

/**
 * Lists the scenes of the analysed screenplay.
 * @param analysis Result of analysing a screenplay.
 */
export function sceneItems(analysis: Analysis): SceneItem[] {
  const scenes = analysis.fountain?.scenes ?? [];
  return scenes.map((scene, index) => {
    const start = scene.heading.range.start;
    const end = scenes[index + 1]?.heading.range.start ?? analysis.text.length + 1;
    const names = [
      ...new Set(
        analysis.mentions
          .filter((m) => m.range.start >= start && m.range.start < end)
          .map((m) => m.text),
      ),
    ];
    return {
      number: index + 1,
      title: sceneTitle(scene.heading.text, scene.heading.locationName, scene.heading.timeOfDay),
      start,
      end,
      heading: scene.heading.text,
      ...(scene.act !== undefined && { act: scene.act }),
      names,
    };
  });
}

/**
 * Finds the scene the cursor is in. Before the first heading the first scene counts.
 * @param scenes Scenes in order.
 * @param cursor Cursor offset.
 * @returns Index into `scenes`, or -1 when there are none.
 */
export function activeSceneIndex(scenes: readonly SceneItem[], cursor: number): number {
  if (scenes.length === 0) return -1;
  const index = scenes.findIndex((scene) => cursor >= scene.start && cursor < scene.end);
  return index < 0 ? 0 : index;
}

/**
 * Works out who and what appears in a scene.
 * @param scene The scene.
 * @param mentions All mentions of the screenplay.
 * @param entities The project's cast.
 */
export function contentsOf(
  scene: SceneItem,
  mentions: readonly Mention[],
  entities: readonly Entity[],
): SceneContents {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const present = new Map<string, PresentEntity>();
  const missing = new Map<string, SceneContents['missing'][number]>();
  for (const mention of mentions) {
    if (mention.range.start < scene.start || mention.range.start >= scene.end) continue;
    if (mention.status === 'unresolved') {
      const key = `${mention.kind}:${normalizeAlias(mention.text)}`;
      const entry = missing.get(key);
      if (entry) entry.count++;
      else missing.set(key, { name: mention.text, kind: mention.kind, count: 1 });
      continue;
    }
    const id = mention.entityIds[0] as Entity['id'] | undefined;
    const entity = mention.entityIds.length === 1 && id ? byId.get(id) : undefined;
    if (!entity) continue;
    const entry = present.get(entity.id);
    if (entry) entry.mentions++;
    else present.set(entity.id, { entity, mentions: 1 });
  }
  const of = (kind: EntityKind) => [...present.values()].filter((p) => p.entity.kind === kind);
  return {
    cast: of('character'),
    places: of('location'),
    things: of('prop'),
    missing: [...missing.values()],
  };
}

/**
 * Where a scene's own text ends: after its last element and note, but before any act line that follows it. New scenes
 * and lines go here so they land inside the same act.
 * @param scene A parsed scene.
 */
export function sceneContentEnd(scene: ParsedScene): number {
  const content = scene.elements.filter((e) => e.type !== 'section' && e.type !== 'synopsis');
  const ends = [
    scene.heading.range.end,
    ...content.map((e) => e.range.end),
    ...scene.notes.map((n) => n.range.end),
  ];
  return Math.max(...ends);
}
