import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/api';
import type { TapestryApi } from '../shared/api';

/** Typed surface exposed to the renderer as `window.tapestry`; every method is one IPC round trip. */
const api: TapestryApi = {
  platform: process.platform,
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.getState),
  saveScript: (path, text) => ipcRenderer.invoke(IPC_CHANNELS.saveScript, path, text),
  createEntity: (input) => ipcRenderer.invoke(IPC_CHANNELS.createEntity, input),
  saveWorkspace: (update) => ipcRenderer.invoke(IPC_CHANNELS.saveWorkspace, update),
  exportScript: (keepDirections) => ipcRenderer.invoke(IPC_CHANNELS.exportScript, keepDirections),
};

contextBridge.exposeInMainWorld('tapestry', api);
