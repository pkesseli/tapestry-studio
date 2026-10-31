import type { Analysis } from '@tapestry/script';
import type { MenuItem } from '../ContextMenu';
import { actRemoval, sceneRemoval } from './deletions';
import type { Removal } from './deletions';
import { newActAtSceneInsertion, newSceneInsertion } from './insertions';
import type { Insertion } from './insertions';
import type { IndexedScene, SceneGroup } from './scene-groups';
import { sceneContentEnd } from './scenes';
import type { ActItem } from './scenes';

/** What the scene-list menus need from the Write section. */
export interface ListMenuContext {
  text: string;
  analysis: Analysis;
  acts: readonly ActItem[];
  /** Puts an insertion into the editor. */
  insert(insertion: Insertion): void;
  /**
   * Asks the user to confirm a deletion.
   * @param title Heading of the question.
   * @param removal What to delete.
   * @param extra Extra sentence (what stays).
   */
  askDelete(title: string, removal: Removal, extra: string): void;
}

/**
 * Entries of the menu for one scene of the scene list.
 * @param context What the menu needs.
 * @param entry The scene.
 */
export function sceneMenuItems(
  context: ListMenuContext,
  { item, index }: IndexedScene,
): MenuItem[] {
  const { text, analysis, acts, insert, askDelete } = context;
  const parsed = analysis.fountain?.scenes[index];
  const actsBefore = acts.filter((act) => act.start < item.start).length;
  return [
    {
      label: 'Add a scene after this one',
      onSelect: () =>
        insert(newSceneInsertion(text, parsed ? sceneContentEnd(parsed) : text.length)),
    },
    {
      label: 'Start a new act at this scene',
      disabled: item.start !== item.headingStart,
      onSelect: () => insert(newActAtSceneInsertion(item.headingStart, actsBefore)),
    },
    {
      label: 'Delete this scene…',
      danger: true,
      separatorBefore: true,
      onSelect: () =>
        askDelete(
          `Delete scene ${item.number}, ${item.title}?`,
          sceneRemoval(item, text.length),
          '',
        ),
    },
  ];
}

/**
 * Entries of the menu for one act heading of the scene list.
 * @param context What the menu needs.
 * @param group The act and its scenes.
 */
export function actMenuItems(context: ListMenuContext, group: SceneGroup): MenuItem[] {
  const { text, analysis, acts, insert, askDelete } = context;
  const act = group.actItem;
  if (!act) return [];
  const position = acts.indexOf(act);
  const last = group.scenes[group.scenes.length - 1];
  const lastParsed = last ? analysis.fountain?.scenes[last.index] : undefined;
  return [
    {
      label: 'Add a scene to this act',
      onSelect: () =>
        insert(newSceneInsertion(text, lastParsed ? sceneContentEnd(lastParsed) : act.end)),
    },
    {
      label: 'Rename this act',
      onSelect: () =>
        insert({
          offset: text.indexOf(act.name, act.start),
          text: '',
          select: { from: 0, to: act.name.length },
        }),
    },
    {
      label: 'Delete this act, keep its scenes…',
      danger: true,
      separatorBefore: true,
      onSelect: () =>
        askDelete(
          `Delete ${act.name}?`,
          actRemoval(text, acts, position, false),
          'Its scenes stay and join the act above.',
        ),
    },
    {
      label: 'Delete this act and its scenes…',
      danger: true,
      onSelect: () =>
        askDelete(
          `Delete ${act.name} and everything in it?`,
          actRemoval(text, acts, position, true),
          '',
        ),
    },
  ];
}
