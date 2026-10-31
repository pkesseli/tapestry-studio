import { normalizeAlias } from '@tapestry/core';
import type { Scene } from '@tapestry/core';
import { alignKeys } from '@tapestry/script';
import type { SceneItem } from './scenes';

/**
 * Key that recognises a scene by its heading: scene number, case and accents are ignored.
 * @param heading Heading text.
 */
const headingKey = (heading: string): string =>
  normalizeAlias(heading.replace(/\s#[^#]+#\s*$/, ''));

/**
 * Finds, for each scene of the text being edited, the same scene in the saved project. They are matched by heading, not
 * by position: the saved project may be a moment behind the text (a scene was just inserted) or ordered differently, and
 * matching by position would hang one scene's shots and footage on another.
 * @param items Scenes of the current text, in order.
 * @param saved Scenes of the saved project.
 * @returns One entry per item: its saved scene, or `undefined` while the project has not caught up.
 */
export function savedScenesFor(
  items: readonly SceneItem[],
  saved: readonly Scene[],
): (Scene | undefined)[] {
  const match = alignKeys(
    saved.map((scene) => headingKey(scene.heading)),
    items.map((item) => headingKey(item.heading)),
  );
  return items.map((_, index) => {
    const found = match[index];
    return found === undefined ? undefined : saved[found];
  });
}
