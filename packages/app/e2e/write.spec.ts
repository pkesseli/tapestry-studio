import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect, test } from '@playwright/test';
import { NodeFs } from '@tapestry/fs-node';
import { placeholderVideo } from '@tapestry/providers';
import { ProjectService } from '@tapestry/service';
import type { ElectronApplication, Page } from '@playwright/test';

/** Folder of the app package (where the built `out/` lives). */
const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');

/** When set, screenshots of key moments are written there for human review. */
const SHOTS = process.env['E2E_SCREENSHOT_DIR'];

/**
 * Starts the app on a project folder.
 * @param project Folder to open; created from the example screenplay when empty.
 */
async function launch(project: string): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({
    args: [appDir, '--no-sandbox'],
    env: { ...process.env, TAPESTRY_PROJECT: project },
  });
  const window = await app.firstWindow();
  await window.setViewportSize({ width: 1360, height: 860 });
  await expect(window.getByRole('heading', { name: 'Script' })).toBeVisible();
  return { app, window };
}

test('opens the example screenplay: scenes, unknown names, and the practice-mode band', async () => {
  const { app, window } = await launch(mkdtempSync(join(tmpdir(), 'tapestry-e2e-')));
  await expect(window.getByRole('status')).toContainText('PRACTICE MODE');
  await expect(window.getByRole('button', { name: /Harbor, night/ })).toBeVisible();
  await expect(window.getByRole('button', { name: /Ferry deck, dawn/ })).toBeVisible();
  await expect(window.locator('.m-new', { hasText: 'NORA' })).toBeVisible();
  await expect(window.getByTestId('missing')).toContainText('Nora');
  if (SHOTS) await window.screenshot({ path: join(SHOTS, 'write-start.png') });
  await app.close();
});

test('adding a character from the card turns her mark known and lists her in the cast', async () => {
  const { app, window } = await launch(mkdtempSync(join(tmpdir(), 'tapestry-e2e-')));
  await window.locator('.m-new', { hasText: 'NORA' }).click();
  const card = window.getByRole('dialog', { name: 'Add Nora' });
  await expect(card).toBeVisible();
  await card.getByLabel(/A few words about/).fill('Harbor master’s daughter');
  if (SHOTS) await window.screenshot({ path: join(SHOTS, 'write-card.png') });
  await card.getByRole('button', { name: 'Add Nora' }).click();
  await expect(card).toBeHidden();
  await expect(window.locator('.m-ok', { hasText: 'NORA' })).toBeVisible();
  await expect(window.getByRole('complementary', { name: 'In this scene' })).toContainText('Nora');
  if (SHOTS) await window.screenshot({ path: join(SHOTS, 'write-added.png') });
  await app.close();
});

test('what you type is saved and is still there after a restart', async () => {
  const project = mkdtempSync(join(tmpdir(), 'tapestry-e2e-'));
  const first = await launch(project);
  await first.window.locator('.cm-content').click();
  await first.window.keyboard.press('ControlOrMeta+End');
  await first.window.keyboard.type('\n\nINT. CABIN - DAY\n\nTom warms his hands.\n');
  await expect(first.window.getByRole('button', { name: /Cabin, day/ })).toBeVisible();
  await expect(first.window.getByText('Saved', { exact: true })).toBeVisible();
  await first.app.close();

  const second = await launch(project);
  await expect(second.window.getByRole('button', { name: /Cabin, day/ })).toBeVisible();
  await second.app.close();
});

test('scenes with footage show a filmstrip, and the player steps through the shots in context', async () => {
  const project = mkdtempSync(join(tmpdir(), 'tapestry-e2e-'));
  const service = await ProjectService.open(new NodeFs(project));
  await service.addSampleFootage(
    [1, 2, 3].map((n) => ({ name: `${n}.mp4`, bytes: placeholderVideo() })),
  );
  const { app, window } = await launch(project);

  const scene = window.getByRole('button', { name: /Harbor, night/ });
  await expect(scene).toContainText('3 shots · 1 accepted · 2 to review');
  await expect(scene).toContainText('Sample footage');
  await expect
    .poll(() =>
      window.evaluate(() =>
        [...document.querySelectorAll('.strip video')].every(
          (v) => (v as HTMLVideoElement).videoWidth > 0,
        ),
      ),
    )
    .toBe(true);

  const player = window.locator('.player');
  await expect(player).toContainText('Shot 1 of 3 · Accepted');
  await expect(player.locator('.sample-tag')).toHaveText('SAMPLE');
  await expect(player.getByRole('button', { name: 'Previous shot' })).toBeDisabled();
  await player.getByRole('button', { name: 'Next shot' }).click();
  await expect(player).toContainText('Shot 2 of 3 · Ready to review');
  await player.getByRole('button', { name: 'Previous shot' }).click();
  await expect(player).toContainText('Shot 1 of 3');

  await player.getByRole('button', { name: 'Play whole scene' }).click();
  await expect(player).toContainText('Shot 3 of 3', { timeout: 10_000 });
  if (SHOTS) await window.screenshot({ path: join(SHOTS, 'write-footage.png') });
  await app.close();
});
