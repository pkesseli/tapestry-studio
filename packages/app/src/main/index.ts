import { join } from 'node:path';
import { BrowserWindow, app } from 'electron';

/**
 * Opens the main application window. The renderer is sandboxed with context isolation: it reaches the machine
 * only through the typed API that the preload script exposes (see `src/preload`).
 */
function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Tapestry Studio',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
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

void app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
