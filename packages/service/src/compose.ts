import type {
  Entity,
  GenerationRequest,
  Quality,
  RequestReference,
  Scene,
  Shot,
} from '@tapestry/core';
import { selectReferences } from '@tapestry/providers';
import type { ProviderManifest } from '@tapestry/providers';

/** What the composer turns into a request. */
export interface ComposeInput {
  scene: Scene;
  shot: Shot;
  /** Everything in the cast; the composer picks the ones the shot needs. */
  entities: readonly Entity[];
  /** The provider the request is for: its limits decide which references fit. */
  manifest: ProviderManifest;
  quality: Quality;
  /** Seed for the render; keep it to reproduce a shot, or the draft's seed when making its final. */
  seed: number;
  /** Optional model name to record in the request. */
  model?: string;
}

/** A reference that was left out, and why, so the interface can tell the user. */
export interface DroppedReference {
  path: string;
  reason: string;
}

/** The request for one shot, with what the composer decided on the way. */
export interface ComposedShot {
  request: GenerationRequest;
  /** References that did not fit the provider's limits. */
  dropped: DroppedReference[];
  /** Names of characters, places and props in the shot that have no reference pictures yet. */
  withoutLook: string[];
}

/**
 * The entities a shot needs, most important first: those the shot names itself, then the scene's location and cast.
 * @param scene The scene.
 * @param shot The shot.
 * @param entities The whole cast.
 */
function entitiesFor(scene: Scene, shot: Shot, entities: readonly Entity[]): Entity[] {
  const byId = new Map(entities.map((entity) => [entity.id as string, entity]));
  const ids = [
    ...shot.referenceEntityIds,
    ...(scene.locationId ? [scene.locationId] : []),
    ...scene.entityIds,
  ];
  return [...new Set(ids)].flatMap((id) => byId.get(id) ?? []);
}

/**
 * The paragraph that describes an entity to the model.
 * @param entity The entity.
 */
function describe(entity: Entity): string {
  const detail =
    entity.kind === 'character' && entity.appearance ? entity.appearance : entity.description;
  return detail ? `${entity.name}: ${detail}` : entity.name;
}

/**
 * Turns a shot into a provider-neutral generation request (plan 08, steps 1, 3 and 4): the prompt from the shot's action,
 * direction and camera hint plus the setting and who is in it, and the reference pictures that fit the provider's limits,
 * keeping the most important roles first. Pure: the same inputs always give the same request.
 * @param input The shot, its scene, the cast, the provider and the wanted quality and seed.
 */
export function composeShot(input: ComposeInput): ComposedShot {
  const { scene, shot, manifest } = input;
  const present = entitiesFor(scene, shot, input.entities);
  const lines = [
    shot.action,
    ...(shot.direction ? [`Direction: ${shot.direction}`] : []),
    ...(shot.cameraHint ? [`Camera: ${shot.cameraHint}`] : []),
    `Setting: ${scene.heading}${scene.description ? `. ${scene.description}` : ''}`,
    ...(present.length > 0 ? [`In the shot: ${present.map(describe).join('; ')}`] : []),
  ];
  const candidates: RequestReference[] = present.flatMap((entity) =>
    entity.references
      .filter((ref) => entity.canonicalSheet.includes(ref.path))
      .map(({ path, mediaType, role }) => ({ path, mediaType, role })),
  );
  const { selected, dropped } = selectReferences(candidates, manifest.limits.video ?? {});
  const limit = manifest.limits.video?.maxDurationSeconds;
  const request: GenerationRequest = {
    capability: 'video',
    provider: { providerId: manifest.id, ...(input.model !== undefined && { model: input.model }) },
    prompt: lines.join('\n'),
    references: selected,
    audioInputs: [],
    durationSeconds:
      limit === undefined ? shot.durationSeconds : Math.min(shot.durationSeconds, limit),
    seed: input.seed,
    quality: input.quality,
    extras: {},
  };
  return {
    request,
    dropped: dropped.map(({ reference, reason }) => ({ path: reference.path, reason })),
    withoutLook: present
      .filter(
        (entity) => !entity.references.some((ref) => entity.canonicalSheet.includes(ref.path)),
      )
      .map((entity) => entity.name),
  };
}
