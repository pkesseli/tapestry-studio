import type { NewEntityInput, Workspace } from '@tapestry/core';
import type { StudioState } from '@tapestry/service';

/** Names of the IPC channels between the renderer and the main process. One per use case. */
export const IPC_CHANNELS = {
  getState: 'studio:get-state',
  saveScript: 'studio:save-script',
  createEntity: 'studio:create-entity',
  saveWorkspace: 'studio:save-workspace',
  exportScript: 'studio:export-script',
} as const;

/**
 * The only way the interface reaches the project. The renderer gets this as `window.tapestry`; the main process
 * answers each call by delegating to `@tapestry/service`. Keep it narrow and free of Electron types so the same
 * contract can later be served to a remote client.
 */
export interface TapestryApi {
  /** Operating system name (`darwin`, `win32`, `linux`), for display of shortcuts. */
  platform: string;
  /** Current state of the open project. */
  getState(): Promise<StudioState>;
  /**
   * Stores new screenplay text.
   * @param path Project-relative script path from the state.
   * @param text Complete new text.
   */
  saveScript(path: string, text: string): Promise<StudioState>;
  /**
   * Adds a character, place or prop.
   * @param input Kind, name and optional description.
   */
  createEntity(input: NewEntityInput): Promise<StudioState>;
  /**
   * Remembers where the user is working (scene, cursor, folded acts). Only the given fields change.
   * @param update Fields to change.
   */
  saveWorkspace(update: Partial<Workspace>): Promise<StudioState>;
  /**
   * Asks where to save a clean copy of the screenplay and writes it there.
   * @param keepDirections Keep `[[direction: ...]]` notes (for the crew); otherwise leave them out.
   * @returns Whether a file was written (false when the user cancelled) and where.
   */
  exportScript(keepDirections: boolean): Promise<{ saved: boolean; path?: string }>;
}
