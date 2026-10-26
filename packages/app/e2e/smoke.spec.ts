import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test } from '@playwright/test';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');

test('app window opens and shows the product name', async () => {
  const app = await electron.launch({ args: [appDir, '--no-sandbox'] });
  const window = await app.firstWindow();
  await expect(window.getByRole('heading', { name: 'Tapestry Studio' })).toBeVisible();
  await app.close();
});
