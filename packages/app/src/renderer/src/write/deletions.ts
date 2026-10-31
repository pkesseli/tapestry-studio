import { removalRange } from './insertions';
import type { SceneFootage } from './footage';
import type { ActItem, SceneItem } from './scenes';
import type { ShotView } from './shots-view';

/** A stretch of the script to delete. */
export interface Removal {
  from: number;
  to: number;
}

/** What a deletion would take with it, for the confirmation. */
export interface Impact {
  scenes: number;
  shots: number;
  /** Videos attached to those shots. */
  clips: number;
}

/**
 * The text of a scene: from its heading up to where the next scene (or the act line above it) begins. An act line above
 * the scene stays, so deleting the only scene of an act leaves an empty act.
 * @param scene The scene.
 * @param textLength Length of the whole screenplay.
 */
export function sceneRemoval(scene: SceneItem, textLength: number): Removal {
  return { from: scene.headingStart, to: Math.min(scene.end, textLength) };
}

/**
 * What to delete for an act.
 * @param text The whole screenplay.
 * @param acts All act headings, in order.
 * @param index Position of the act in `acts`.
 * @param withScenes `true` removes everything up to the next act; `false` removes only the act line, so its scenes join
 * the act above (or none).
 */
export function actRemoval(
  text: string,
  acts: readonly ActItem[],
  index: number,
  withScenes: boolean,
): Removal {
  const act = acts[index] as ActItem;
  if (!withScenes) return removalRange(text, act.start, act.end);
  return { from: act.start, to: acts[index + 1]?.start ?? text.length };
}

/**
 * Counts the scenes, shots and videos inside a stretch of the script.
 * @param range The stretch.
 * @param scenes All scenes.
 * @param shots Shots of each scene, same order as `scenes`.
 * @param footage Footage of each scene, same order as `scenes`.
 */
export function impactOf(
  range: Removal,
  scenes: readonly SceneItem[],
  shots: readonly (readonly ShotView[])[],
  footage: readonly SceneFootage[],
): Impact {
  const impact: Impact = { scenes: 0, shots: 0, clips: 0 };
  scenes.forEach((scene, index) => {
    if (scene.headingStart < range.from || scene.headingStart >= range.to) return;
    impact.scenes++;
    impact.shots += shots[index]?.length ?? 0;
    impact.clips += footage[index]?.clips.length ?? 0;
  });
  return impact;
}

/**
 * Words for the confirmation: "2 scenes, 7 shots and 5 videos".
 * @param impact What would be lost.
 */
export function describeImpact(impact: Impact): string {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const parts = [plural(impact.scenes, 'scene')];
  if (impact.shots > 0) parts.push(plural(impact.shots, 'shot'));
  if (impact.clips > 0) parts.push(plural(impact.clips, 'video'));
  return parts.length === 1
    ? (parts[0] as string)
    : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
