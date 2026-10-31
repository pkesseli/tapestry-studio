import type { Analysis } from '@tapestry/script';
import type { MenuItem } from '../ContextMenu';
import {
  newActInsertion,
  newDirectionInsertion,
  newLineInsertion,
  newNoteInsertion,
  newParentheticalInsertion,
  newSceneInsertion,
  newTransitionInsertion,
} from './insertions';
import type { Insertion } from './insertions';
import { activeSceneIndex, sceneContentEnd } from './scenes';
import type { SceneItem } from './scenes';
import { activeShotIndex } from './shots-view';
import type { ShotView } from './shots-view';

/** Everything the Insert menu needs to know about the script. */
export interface InsertContext {
  text: string;
  analysis: Analysis;
  scenes: readonly SceneItem[];
  /** Shots of each scene, same order as `scenes`. */
  shotsByScene: readonly (readonly ShotView[])[];
}

/**
 * Where new dialogue or action goes for a cursor position, and who has spoken so far.
 * @param context The script.
 * @param pos Cursor offset.
 */
export function insertionPoint(context: InsertContext, pos: number) {
  const { text, analysis, scenes, shotsByScene } = context;
  const index = activeSceneIndex(scenes, pos);
  const parsed = analysis.fountain?.scenes[index];
  const shots = shotsByScene[index] ?? [];
  const shot = shots[activeShotIndex(shots, pos)];
  const sceneEnd = parsed ? sceneContentEnd(parsed) : text.length;
  const blockEnd = shot?.blockEnd ?? sceneEnd;
  const speakers = (parsed?.beats ?? [])
    .flatMap((beat) => beat.dialogue)
    .filter((line) => line.range.end <= blockEnd)
    .map((line) => line.speaker);
  return { shot, sceneEnd, blockEnd, speakers };
}

/**
 * The entries of the Insert menu (button and right-click menu) for a cursor position. Entries that make no sense there,
 * such as a parenthetical outside spoken lines, are returned disabled.
 * @param context The script.
 * @param pos Cursor offset.
 * @param insert Puts an insertion into the editor.
 */
export function insertMenuItems(
  context: InsertContext,
  pos: number,
  insert: (insertion: Insertion) => void,
): MenuItem[] {
  const { text, analysis } = context;
  const { shot, sceneEnd, blockEnd, speakers } = insertionPoint(context, pos);
  const acts = (analysis.fountain?.elements ?? []).filter(
    (element) => element.type === 'section' && element.depth === 1,
  ).length;
  const lineBreak = shot ? text.indexOf('\n', shot.start) : -1;
  const cueEnd = lineBreak < 0 ? text.length : lineBreak;
  return [
    { label: 'Scene', onSelect: () => insert(newSceneInsertion(text, sceneEnd)) },
    { label: 'Act, at the end', onSelect: () => insert(newActInsertion(text, acts)) },
    {
      label: 'Dialogue line',
      separatorBefore: true,
      onSelect: () => insert(newLineInsertion(text, blockEnd, 'dialogue', speakers)),
    },
    {
      label: 'Parenthetical (how a line is said)',
      disabled: shot?.kind !== 'line',
      onSelect: () => insert(newParentheticalInsertion(cueEnd)),
    },
    {
      label: 'Action',
      onSelect: () => insert(newLineInsertion(text, blockEnd, 'action', speakers)),
    },
    {
      label: 'Transition (CUT TO:)',
      onSelect: () => insert(newTransitionInsertion(text, blockEnd)),
    },
    {
      label: 'Direction for this shot',
      separatorBefore: true,
      disabled: !shot || shot.direction !== undefined,
      onSelect: () => insert(newDirectionInsertion(blockEnd)),
    },
    { label: 'Private note', onSelect: () => insert(newNoteInsertion(blockEnd)) },
  ];
}
