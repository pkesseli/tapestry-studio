import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launch } from './launch';

/** A fresh project folder. */
const fresh = () => mkdtempSync(join(tmpdir(), 'tapestry-e2e-'));

test('a new act is selected and its scene is the one being worked on', async () => {
  const { app, window } = await launch(fresh());
  await window.getByRole('button', { name: 'Add act' }).click();
  await expect(window.locator('.act-head').last()).toContainText('Act Three');
  const added = window.locator('.scene').last();
  await expect(added).toHaveAttribute('aria-current', 'true');
  await expect(added).toBeInViewport();
  await app.close();
});

test('the Insert menu offers each kind of line and a parenthetical only in spoken lines', async () => {
  const { app, window } = await launch(fresh());
  await window.getByRole('button', { name: 'Insert' }).click();
  const menu = window.getByRole('menu', { name: 'Insert' });
  await expect(menu.getByRole('menuitem')).toHaveCount(8);
  await expect(menu.getByRole('menuitem', { name: /Parenthetical/ })).toBeDisabled();
  await menu.getByRole('menuitem', { name: 'Transition (CUT TO:)' }).click();
  await window.keyboard.type('FADE OUT.');
  await expect(window.locator('.cm-content')).toContainText('FADE OUT.');
  await app.close();
});

test('right-clicking the script opens the same menu at that spot', async () => {
  const { app, window } = await launch(fresh());
  await window.locator('.cm-line', { hasText: 'INT. HARBOR' }).first().click({ button: 'right' });
  const menu = window.getByRole('menu', { name: 'Insert' });
  await expect(menu).toBeVisible();
  await window.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await app.close();
});

test('a scene can be deleted after a question that names what goes with it, and undone', async () => {
  const { app, window } = await launch(fresh());
  await window.getByRole('button', { name: 'Actions for scene 2' }).click();
  await window.getByRole('menuitem', { name: /Delete this scene/ }).click();
  const dialog = window.getByRole('dialog');
  await expect(dialog).toContainText('Ferry deck, dawn');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(window.locator('.scene')).toHaveCount(3);

  await window.getByRole('button', { name: 'Actions for scene 2' }).click();
  await window.getByRole('menuitem', { name: /Delete this scene/ }).click();
  await window.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(window.locator('.scene .bold')).toHaveText(['Harbor, night', 'Cabin, day']);
  await window.locator('.cm-content').press('ControlOrMeta+z');
  await expect(window.locator('.scene')).toHaveCount(3);
  await app.close();
});

test('an act can be deleted with or without its scenes', async () => {
  const project = fresh();
  const { app, window } = await launch(project);
  await window.getByRole('button', { name: 'Actions for Act Two' }).click();
  await window.getByRole('menuitem', { name: 'Delete this act, keep its scenes…' }).click();
  await window.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(window.locator('.act-head')).toHaveText([/Act One/]);
  await expect(window.locator('.scene')).toHaveCount(3);

  await window.getByRole('button', { name: 'Actions for Act One' }).click();
  await window.getByRole('menuitem', { name: 'Delete this act and its scenes…' }).click();
  await window.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(window.locator('.scene')).toHaveCount(0);
  await expect(window.getByText('Saved', { exact: true })).toBeVisible();
  await expect
    .poll(() => readFileSync(join(project, 'script', 'main.fountain'), 'utf8'))
    .not.toContain('HARBOR');
  await app.close();
});

test('an act left with no scene stays in the list and can get a new one', async () => {
  const { app, window } = await launch(fresh());
  await window.getByRole('button', { name: 'Actions for scene 3' }).click();
  await window.getByRole('menuitem', { name: /Delete this scene/ }).click();
  await window.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(window.locator('.act-head')).toHaveText([/Act One/, /Act Two/]);
  await expect(window.getByText('No scenes in this act yet.')).toBeVisible();
  await window.getByRole('button', { name: 'Actions for Act Two' }).click();
  await window.getByRole('menuitem', { name: 'Add a scene to this act' }).click();
  await window.keyboard.type('GARDEN');
  await expect(window.locator('.act').last().locator('.scene .bold')).toHaveText('Garden, day');
  await app.close();
});

test('the shot panel does not edit: its text jumps to the place in the script', async () => {
  const { app, window } = await launch(fresh());
  const panel = window.locator('.shot-card');
  await expect(panel.getByText('Edit in the script')).toHaveCount(0);
  const text = (await panel.locator('.shot-quote .text-jump').innerText()).slice(0, 12);
  await panel.locator('.shot-quote .text-jump').click();
  await window.keyboard.type('ZZ');
  await expect(window.locator('.cm-content')).toContainText(`ZZ${text}`);
  await app.close();
});
