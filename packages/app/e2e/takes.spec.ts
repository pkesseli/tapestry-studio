import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launch } from './launch';

/** When set, screenshots of key moments are written there for human review. */
const SHOTS = process.env['E2E_SCREENSHOT_DIR'];

/** A fresh project folder. */
const fresh = () => mkdtempSync(join(tmpdir(), 'tapestry-e2e-'));

test('a draft is made in the background, accepted, and its final follows; all of it survives a restart', async () => {
  const project = fresh();
  const first = await launch(project);
  const panel = first.window.locator('.shot-card');
  await expect(panel.getByText('Nothing made yet')).toBeVisible();

  await panel.getByRole('button', { name: 'Make a draft' }).click();
  const takes = panel.locator('.take');
  await expect(takes.first()).toContainText('Ready to review');
  await expect(panel.locator('.quality-tag')).toHaveText('DRAFT');
  await expect(panel.locator('.sample-tag')).toHaveText('SAMPLE');

  await takes.first().getByRole('button', { name: 'Accept' }).click();
  await expect(takes.first()).toContainText('Accepted');

  await panel.getByRole('button', { name: 'Make the final' }).click();
  await expect(takes).toHaveCount(2);
  await expect(takes.nth(1)).toContainText('Ready to review');
  await expect(panel.locator('.quality-tag')).toHaveText('FINAL');
  await expect(takes.nth(1).locator('.chip')).toHaveText('Final');
  if (SHOTS) await first.window.screenshot({ path: join(SHOTS, 'takes.png') });
  await first.app.close();

  const second = await launch(project);
  const again = second.window.locator('.shot-card .take');
  await expect(again).toHaveCount(2);
  await expect(again.first()).toContainText('Accepted');
  await expect(again.nth(1)).toContainText('Ready to review');
  await second.app.close();
});

test('a rejected take is replaced by another attempt that starts at once', async () => {
  const { app, window } = await launch(fresh());
  const panel = window.locator('.shot-card');
  await panel.getByRole('button', { name: 'Make a draft' }).click();
  await expect(panel.locator('.take').first()).toContainText('Ready to review');
  await panel.getByRole('button', { name: 'Try again' }).click();
  // The old take is hidden as replaced; the new one is made and can be reviewed.
  await expect(panel.locator('.take')).toHaveCount(1);
  await expect(panel.locator('.take').first()).toContainText(/Waiting|Making it|Ready to review/);
  await expect(panel.locator('.take').first()).toContainText('Ready to review');
  await app.close();
});
