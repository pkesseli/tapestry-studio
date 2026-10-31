import { join } from 'node:path';
import { NodeFs } from '@tapestry/fs-node';
import { ProjectService } from '@tapestry/service';
import { BrowserWindow, app, dialog, protocol } from 'electron';
import { MEDIA_SCHEME } from '../shared/media-url';
import { registerIpc } from './ipc';
import { serveMedia } from './media-protocol';

// The media scheme must be declared before the app is ready; its handler is added once the project is open.
protocol.registerSchemesAsPrivileged([
  {
    scheme: MEDIA_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

/**
 * Folder of the project to open: `TAPESTRY_PROJECT` when set (tests and development), otherwise the default project
 * in the user's documents folder.
 */
function projectFolder(): string {
  return (
    process.env['TAPESTRY_PROJECT'] ??
    join(app.getPath('documents'), 'Tapestry Studio', 'My First Film')
  );
}

/**
 * Opens the main application window. The renderer is sandboxed with context isolation: it reaches the project only
 * through the typed API that the preload script exposes (see `src/shared/api.ts`).
 */
function createWindow(): void {
  const window = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    title: 'Tapestry Studio',
    backgroundColor: '#f5f3ef',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  const devUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devUrl) {
    void window.loadURL(devUrl);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(async () => {
  try {
    const folder = projectFolder();
    registerIpc(await ProjectService.open(new NodeFs(folder)));
    protocol.handle(MEDIA_SCHEME, (request) => serveMedia(folder, request));
  } catch (error) {
    dialog.showErrorBox('Tapestry Studio cannot open your project', (error as Error).message);
    app.quit();
    return;
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
