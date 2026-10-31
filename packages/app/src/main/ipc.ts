import { ENTITY_FOLDERS, WorkspaceSchema } from '@tapestry/core';
import type { EntityKind, Workspace } from '@tapestry/core';
import type { ProjectService } from '@tapestry/service';
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../shared/api';

/**
 * Checks untrusted IPC input: the renderer is sandboxed but its messages are still validated at the boundary.
 * @param value Anything received over IPC.
 */
function isEntityInput(
  value: unknown,
): value is { kind: EntityKind; name: string; description?: string } {
  if (typeof value !== 'object' || value === null) return false;
  const { kind, name, description } = value as Record<string, unknown>;
  return (
    typeof kind === 'string' &&
    kind in ENTITY_FOLDERS &&
    typeof name === 'string' &&
    (description === undefined || typeof description === 'string')
  );
}

/**
 * Answers the renderer's calls by delegating to the project service.
 * @param service The open project.
 */
export function registerIpc(service: ProjectService): void {
  ipcMain.handle(IPC_CHANNELS.getState, () => service.state());
  ipcMain.handle(IPC_CHANNELS.saveScript, (_event, path: unknown, text: unknown) => {
    if (typeof path !== 'string' || typeof text !== 'string') throw new Error('Invalid script');
    return service.saveScript(path, text);
  });
  ipcMain.handle(IPC_CHANNELS.saveWorkspace, (_event, update: unknown) => {
    const parsed = WorkspaceSchema.partial().safeParse(update);
    if (!parsed.success) throw new Error('Invalid workspace');
    const defined = Object.entries(parsed.data).filter(([, value]) => value !== undefined);
    return service.saveWorkspace(Object.fromEntries(defined) as Partial<Workspace>);
  });
  ipcMain.handle(IPC_CHANNELS.createEntity, (_event, input: unknown) => {
    if (!isEntityInput(input)) throw new Error('Invalid entity');
    return service.createEntity(input);
  });
}
