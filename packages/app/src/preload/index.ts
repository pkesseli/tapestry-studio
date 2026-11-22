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
  makeShot: (shotId, quality) => ipcRenderer.invoke(IPC_CHANNELS.makeShot, shotId, quality),
  makeFinal: (draftJobId) => ipcRenderer.invoke(IPC_CHANNELS.makeFinal, draftJobId),
  acceptTake: (jobId) => ipcRenderer.invoke(IPC_CHANNELS.acceptTake, jobId),
  anotherTake: (jobId) => ipcRenderer.invoke(IPC_CHANNELS.anotherTake, jobId),
  onChange: (listener) => {
    const handler = (): void => listener();
    ipcRenderer.on(IPC_CHANNELS.changed, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.changed, handler);
  },
};

contextBridge.exposeInMainWorld('tapestry', api);
