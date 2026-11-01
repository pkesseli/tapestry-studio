import type { Scene, Workspace } from '@tapestry/core';
import type { StudioState } from '@tapestry/service';
import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { ScriptEditorHandle } from './ScriptEditor';
import type { SceneItem } from './scenes';

/** How long the cursor must rest before the position is remembered. */
const WORKSPACE_DELAY_MS = 800;

/**
 * Puts the user back where they left off when the app opens, and remembers where they are a moment after the cursor
 * stops moving.
 * @param initial State loaded when the app started.
 * @param scenes Scenes of the script, used to find the saved scene when no cursor was saved.
 * @param editor The script editor.
 * @param cursor Current cursor offset.
 * @param activeSceneId Id of the saved scene the cursor is in, if known.
 * @param saveWorkspace Stores the local, non-film state.
 */
export function useRememberedPlace(
  initial: StudioState,
  scenes: readonly SceneItem[],
  editor: RefObject<ScriptEditorHandle | null>,
  cursor: number,
  activeSceneId: Scene['id'] | undefined,
  saveWorkspace: (patch: Partial<Workspace>) => void,
): void {
  // The saved cursor, or the start of the saved scene.
  useEffect(() => {
    const saved = initial.workspace;
    const byId = initial.scenes.findIndex((scene) => scene.id === saved.activeSceneId);
    const offset = saved.cursor ?? (byId >= 0 ? scenes[byId]?.headingStart : undefined);
    if (offset !== undefined) editor.current?.focusAt(offset);
    // Runs once, with the state the app started with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => saveWorkspace({ cursor, ...(activeSceneId !== undefined && { activeSceneId }) }),
      WORKSPACE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [cursor, activeSceneId, saveWorkspace]);
}
