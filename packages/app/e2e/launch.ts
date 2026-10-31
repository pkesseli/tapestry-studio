import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';

/** Folder of the app package (where the built `out/` lives). */
const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Starts the app on a project folder.
 * @param project Folder to open; created from the example screenplay when empty.
 */
export async function launch(project: string): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({
    args: [appDir, '--no-sandbox'],
    env: { ...process.env, TAPESTRY_PROJECT: project },
  });
  const window = await app.firstWindow();
  await window.setViewportSize({ width: 1360, height: 860 });
  await expect(window.getByRole('heading', { name: 'Script' })).toBeVisible();
  return { app, window };
}
