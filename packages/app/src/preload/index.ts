import { contextBridge } from 'electron';

/** Typed surface exposed to the renderer as `window.tapestry`. Grows as features need privileged access. */
const api = {
  /** Name of the host platform, for display only. */
  platform: process.platform,
} as const;

/** Type of `window.tapestry`, shared with the renderer. */
export type TapestryApi = typeof api;

contextBridge.exposeInMainWorld('tapestry', api);
