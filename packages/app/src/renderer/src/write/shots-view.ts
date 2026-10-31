import type { Entity, Scene } from '@tapestry/core';
import { planShots, shotKey } from '@tapestry/script';
import type { ParsedScene } from '@tapestry/script';
import type { SceneClip } from '@tapestry/service';

/** The state of a shot as the margin marker and the panel show it. */
export type ShotState = 'not-made' | 'to-review' | 'accepted';

/** A shot of the scene being edited: what the script says, who is in it, and its footage if any. */
export interface ShotView {
  /** Position in the scene, starting at 1. */
  number: number;
  kind: 'action' | 'line';
  /** What the shot shows. */
  action: string;
  /** Guidance from `[[direction: ...]]` notes under the shot. */
  direction?: string;
  durationSeconds: number;
  /** Where the shot's text starts and ends in the screenplay. */
  start: number;
  end: number;
  /** Where new text for after this shot goes: past the shot and any notes written under it. */
  blockEnd: number;
  /** Names of the characters, places and props in the shot. */
  people: string[];
  /** The video made for the shot, if any. */
  clip?: SceneClip;
  state: ShotState;
}

/**
 * Builds the shot views of one scene from the live script and the saved project. Footage is found by the shot's wording,
 * so it stays attached while the text is being edited and before the project has caught up.
 * @param parsed The scene as parsed from the current text.
 * @param saved The same scene as saved in the project (may lag a moment behind the text).
 * @param clips All videos of the project.
 * @param entities The project's cast.
 */
export function shotViews(
  parsed: ParsedScene,
  saved: Scene | undefined,
  clips: readonly SceneClip[],
  entities: readonly Entity[],
): ShotView[] {
  const byId = new Map(entities.map((entity) => [entity.id as string, entity.name]));
  return planShots(parsed).map((planned, index) => {
    const match = saved?.shots.find((shot) => shotKey(shot.action) === planned.key);
    const clip = match ? clips.find((c) => c.shotId === match.id) : undefined;
    return {
      number: index + 1,
      kind: planned.kind,
      action: planned.action,
      ...(planned.direction !== undefined && { direction: planned.direction }),
      durationSeconds: planned.durationSeconds,
      start: planned.range.start,
      end: planned.range.end,
      blockEnd: Math.max(planned.range.end, planned.noteEnd ?? 0),
      people: (match?.referenceEntityIds ?? []).flatMap((id) => byId.get(id) ?? []),
      ...(clip && { clip }),
      state: !clip ? 'not-made' : clip.accepted ? 'accepted' : 'to-review',
    };
  });
}

/**
 * Finds the shot the cursor is in: the last shot that starts at or before it (the first shot when the cursor is above
 * all of them).
 * @param shots Shots of the scene, in order.
 * @param cursor Cursor offset in the text.
 * @returns Index into `shots`, or -1 when the scene has none.
 */
export function activeShotIndex(shots: readonly ShotView[], cursor: number): number {
  if (shots.length === 0) return -1;
  let found = 0;
  shots.forEach((shot, index) => {
    if (shot.start <= cursor) found = index;
  });
  return found;
}
