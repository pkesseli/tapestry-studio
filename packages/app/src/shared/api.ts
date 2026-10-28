import type { NewEntityInput } from '@tapestry/core';
import type { StudioState } from '@tapestry/service';

/** Names of the IPC channels between the renderer and the main process. One per use case. */
export const IPC_CHANNELS = {
  getState: 'studio:get-state',
  saveScript: 'studio:save-script',
  createEntity: 'studio:create-entity',
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
}
