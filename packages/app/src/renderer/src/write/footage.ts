import type { Scene } from '@tapestry/core';
import type { SceneClip } from '@tapestry/service';

/** What the interface shows about the footage of one scene. */
export interface SceneFootage {
  /** Number of shots planned for the scene. */
  shots: number;
  /** The videos that exist, in shot order. */
  clips: SceneClip[];
}

/**
 * Collects the footage of every scene, in the order of the scene list.
 * @param scenes The saved scene for each scene of the script, in script order (`undefined` where none matches yet).
 * @param clips All videos of the project.
 */
export function footageByScene(
  scenes: readonly (Scene | undefined)[],
  clips: readonly SceneClip[],
): SceneFootage[] {
  return scenes.map((scene) => ({
    shots: scene?.shots.length ?? 0,
    clips: scene
      ? clips
          .filter((clip) => clip.sceneId === scene.id)
          .sort((a, b) => a.shotNumber - b.shotNumber)
      : [],
  }));
}

/**
 * One-line summary for the scene list, in the words of doc/readme/ux.md.
 * @param footage Footage of one scene.
 */
export function footageSummary(footage: SceneFootage | undefined): string {
  if (!footage || footage.shots === 0) return 'No shots yet';
  const accepted = footage.clips.filter((clip) => clip.accepted).length;
  const toReview = footage.clips.length - accepted;
  const parts = [`${footage.shots} ${footage.shots === 1 ? 'shot' : 'shots'}`];
  if (accepted > 0) parts.push(`${accepted} accepted`);
  if (toReview > 0) parts.push(`${toReview} to review`);
  if (footage.clips.length === 0) parts.push('none made yet');
  return parts.join(' · ');
}
