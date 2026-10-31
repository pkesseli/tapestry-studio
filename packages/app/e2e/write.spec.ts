import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
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
  await expect(window.locator('.m-new', { hasText: 'NORA' }).first()).toBeVisible();
  await expect(window.getByTestId('missing')).toContainText('Nora');
  if (SHOTS) await window.screenshot({ path: join(SHOTS, 'write-start.png') });
  await app.close();
});

test('adding a character from the card turns her mark known and lists her in the cast', async () => {
  const { app, window } = await launch(mkdtempSync(join(tmpdir(), 'tapestry-e2e-')));
  await window.locator('.m-new', { hasText: 'NORA' }).first().click();
  const card = window.getByRole('dialog', { name: 'Add Nora' });
  await expect(card).toBeVisible();
  await card.getByLabel(/A few words about/).fill('Harbor master’s daughter');
  if (SHOTS) await window.screenshot({ path: join(SHOTS, 'write-card.png') });
  await card.getByRole('button', { name: 'Add Nora' }).click();
  await expect(card).toBeHidden();
  await expect(window.locator('.m-ok', { hasText: 'NORA' }).first()).toBeVisible();
  await expect(window.getByRole('complementary', { name: 'In this scene' })).toContainText('Nora');
  if (SHOTS) await window.screenshot({ path: join(SHOTS, 'write-added.png') });
  await app.close();
});

test('what you type is saved and is still there after a restart', async () => {
  const project = mkdtempSync(join(tmpdir(), 'tapestry-e2e-'));
  const first = await launch(project);
  await first.window.locator('.cm-content').click();
  await first.window.keyboard.press('ControlOrMeta+End');
  await first.window.keyboard.type('\n\nINT. LIGHTHOUSE - DAY\n\nTom warms his hands.\n');
  await expect(first.window.getByRole('button', { name: /Lighthouse, day/ })).toBeVisible();
  await expect(first.window.getByText('Saved', { exact: true })).toBeVisible();
  await first.app.close();

  const second = await launch(project);
  await expect(second.window.getByRole('button', { name: /Lighthouse, day/ })).toBeVisible();
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

test('scenes are grouped under acts that fold away, and the list can be searched', async () => {
  const { app, window } = await launch(mkdtempSync(join(tmpdir(), 'tapestry-e2e-')));
  const harbor = window.getByRole('button', { name: /Harbor, night/ });
  const ferry = window.getByRole('button', { name: /Ferry deck, dawn/ });
  const cabin = window.getByRole('button', { name: /Cabin, day/ });
  const actOne = window.getByRole('button', { name: /Act One/ });
  await expect(actOne).toHaveAttribute('aria-expanded', 'true');
  await expect(window.getByRole('button', { name: /Act Two/ })).toBeVisible();
  if (SHOTS) await window.screenshot({ path: join(SHOTS, 'write-acts.png') });

  await actOne.click();
  await expect(actOne).toHaveAttribute('aria-expanded', 'false');
  await expect(harbor).toBeHidden();
  await expect(ferry).toBeHidden();
  await expect(cabin).toBeVisible();

  await window.getByRole('button', { name: 'Collapse all' }).click();
  await expect(cabin).toBeHidden();
  await expect(window.getByRole('button', { name: 'Expand all' })).toBeVisible();
  await window.getByRole('button', { name: 'Expand all' }).click();
  await expect(harbor).toBeVisible();
  await expect(cabin).toBeVisible();
  await actOne.click();
  await expect(harbor).toBeHidden();

  const search = window.getByRole('searchbox', { name: 'Search scenes' });
  await search.fill('nora');
  await expect(harbor).toBeVisible();
  await expect(cabin).toBeVisible();
  await expect(ferry).toBeHidden();
  await search.fill('zzz');
  await expect(window.getByText(/No scenes match/)).toBeVisible();
  await search.fill('');
  await expect(harbor).toBeHidden();
  await app.close();
});

test('the scene you were working on and the folded acts are remembered across restarts', async () => {
  const project = mkdtempSync(join(tmpdir(), 'tapestry-e2e-'));
  const first = await launch(project);
  await first.window.getByRole('button', { name: /Cabin, day/ }).click();
  await first.window.getByRole('button', { name: /Act One/ }).click();
  const workspace = join(project, '.tapestry', 'workspace.json');
  /** True once the workspace file names the scene and the folded act. */
  const remembered = (): boolean => {
    if (!existsSync(workspace)) return false;
    const saved = JSON.parse(readFileSync(workspace, 'utf8')) as {
      activeSceneId?: string;
      collapsedActs?: string[];
    };
    return Boolean(saved.activeSceneId) && Boolean(saved.collapsedActs?.includes('Act One'));
  };
  await expect.poll(remembered, { timeout: 8000 }).toBe(true);
  await first.app.close();

  const second = await launch(project);
  await expect(second.window.getByRole('button', { name: /Cabin, day/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(second.window.getByRole('button', { name: /Harbor, night/ })).toBeHidden();
  await expect(second.window.getByRole('button', { name: /Act One/ })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await second.app.close();
});

test('every shot gets a numbered margin marker, and clicking one shows that shot in the panel', async () => {
  const { app, window } = await launch(mkdtempSync(join(tmpdir(), 'tapestry-e2e-')));
  const marks = window.locator('.shot-mark');
  await expect(marks.first()).toBeVisible();
  await expect(marks.filter({ hasText: /^1$/ })).toHaveCount(3);
  const panel = window.locator('.shot-card');
  await expect(panel).toContainText('Shot 1 of 3 · Not made yet');
  await expect(panel).toContainText('MARIA lifts a LANTERN');
  await marks.filter({ hasText: /^2$/ }).first().click();
  await expect(panel).toContainText('Shot 2 of 3');
  await expect(panel).toContainText('MARIA: Is anyone there?');
  await expect(window.locator('.shot-mark.active')).toHaveText('2');
  await panel.getByRole('button', { name: 'Next shot' }).click();
  await expect(panel).toContainText('Shot 3 of 3');
  if (SHOTS) await window.screenshot({ path: join(SHOTS, 'write-shots.png') });
  await app.close();
});

test('adding a direction writes a note into the script that shows in the panel', async () => {
  const { app, window } = await launch(mkdtempSync(join(tmpdir(), 'tapestry-e2e-')));
  await window.getByRole('button', { name: 'Add direction' }).click();
  await window.keyboard.type('slow push-in, thick fog');
  await expect(window.locator('.note-direction')).toContainText(
    '[[direction: slow push-in, thick fog]]',
  );
  await expect(window.locator('.direction-box')).toContainText('slow push-in, thick fog');
  await expect(window.getByRole('button', { name: 'Add direction' })).toHaveCount(0);
  if (SHOTS) await window.screenshot({ path: join(SHOTS, 'write-direction.png') });
  await app.close();
});

test('exporting the script leaves directions and notes out unless asked to keep them', async () => {
  const project = mkdtempSync(join(tmpdir(), 'tapestry-e2e-'));
  const { app, window } = await launch(project);
  await window.getByRole('button', { name: 'Add direction' }).click();
  await window.keyboard.type('slow push-in');
  await expect(window.locator('.direction-box')).toContainText('slow push-in');

  const out = join(project, 'export.fountain');
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = () => Promise.resolve({ canceled: false, filePath: path });
  }, out);

  await window.getByText('Export script').click();
  await window.getByRole('button', { name: /Clean script/ }).click();
  await expect(window.getByRole('status').filter({ hasText: 'Exported' })).toBeVisible();
  expect(readFileSync(out, 'utf8')).not.toContain('slow push-in');
  expect(readFileSync(out, 'utf8')).toContain('INT. HARBOR - NIGHT');

  await window.getByText('Export script').click();
  await window.getByRole('button', { name: /With directions/ }).click();
  await expect.poll(() => readFileSync(out, 'utf8')).toContain('[[direction: slow push-in]]');
  await app.close();
});

test('a new scene goes after the current one with its place ready to type over', async () => {
  const { app, window } = await launch(mkdtempSync(join(tmpdir(), 'tapestry-e2e-')));
  await window.getByRole('button', { name: 'Add scene' }).click();
  await window.keyboard.type('KITCHEN');
  const titles = window.locator('.scene .bold');
  await expect(titles).toHaveText([
    'Harbor, night',
    'Kitchen, day',
    'Ferry deck, dawn',
    'Cabin, day',
  ]);
  await expect(window.locator('.act-head').first()).toContainText('Act One');
  await expect(window.locator('.act').first().locator('.scene')).toHaveCount(3);
  await app.close();
});

test('a new act comes with a first scene and its name ready to type over', async () => {
  const { app, window } = await launch(mkdtempSync(join(tmpdir(), 'tapestry-e2e-')));
  await window.getByRole('button', { name: 'Add act' }).click();
  await window.keyboard.type('Epilogue');
  await expect(window.locator('.act-head')).toHaveText([/Act One/, /Act Two/, /Epilogue/]);
  await expect(window.locator('.scene .bold').last()).toHaveText('Location, day');
  await app.close();
});

test('a new line goes after the shot and its direction, so the direction stays with its shot', async () => {
  const { app, window } = await launch(mkdtempSync(join(tmpdir(), 'tapestry-e2e-')));
  const panel = window.locator('.shot-card');
  await panel.getByRole('button', { name: 'Add direction' }).click();
  await window.keyboard.type('slow push-in');
  await panel.getByText('Add line').click();
  await panel.getByRole('button', { name: /Dialogue after this shot/ }).click();
  await window.keyboard.type('TOM');
  await expect(panel).toContainText('of 4');
  await window.locator('.shot-mark').filter({ hasText: /^1$/ }).first().click();
  await expect(panel.locator('.direction-box')).toContainText('slow push-in');
  await window.locator('.shot-mark').filter({ hasText: /^2$/ }).first().click();
  await expect(panel).toContainText('TOM: What they say.');
  await expect(panel.locator('.direction-box')).toHaveCount(0);
  if (SHOTS) await window.screenshot({ path: join(SHOTS, 'write-addline.png') });
  await app.close();
});
