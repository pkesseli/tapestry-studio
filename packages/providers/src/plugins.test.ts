import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { MOCK_MANIFEST } from './mock/mock-provider';
import { loadPlugins } from './plugins';

/**
 * Writes a plug-in folder.
 * @param root Plug-in root folder.
 * @param name Plug-in folder name.
 * @param manifest Contents for plugin.json.
 * @param source Contents for index.mjs, or undefined to omit it.
 */
async function writePlugin(
  root: string,
  name: string,
  manifest: object,
  source?: string,
): Promise<void> {
  const folder = join(root, name);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'plugin.json'), JSON.stringify(manifest));
  if (source) await writeFile(join(folder, 'index.mjs'), source);
}

/** Manifest fields shared by the test plug-ins. */
const base = { ...MOCK_MANIFEST, version: '0.1.0', entry: 'index.mjs' };

test('loads valid plug-ins and reports broken ones without failing the rest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'plugins-'));
  const source = 'export default () => ({ manifest: { id: "demo" } });';
  await writePlugin(root, 'good', { ...base, id: 'demo', name: 'Demo' }, source);
  await writePlugin(root, 'bad-manifest', { id: 'Bad Id' }, source);
  await writePlugin(
    root,
    'no-default',
    { ...base, id: 'nodefault', name: 'X' },
    'export const x = 1;',
  );
  await writePlugin(root, 'escape', {
    ...base,
    id: 'escape',
    name: 'Esc',
    entry: '../outside.mjs',
  });
  const { plugins, failures } = await loadPlugins(root);
  expect(plugins.map((p) => p.manifest.id)).toEqual(['demo']);
  expect(plugins[0]?.create({}).manifest.id).toBe('demo');
  expect(failures.map((f) => f.directory.split(/[\\/]/).pop()).sort()).toEqual([
    'bad-manifest',
    'escape',
    'no-default',
  ]);
  expect(failures.find((f) => f.directory.endsWith('escape'))?.reason).toMatch(/Must not contain/);
  expect(failures.find((f) => f.directory.endsWith('no-default'))?.reason).toMatch(
    /default function/,
  );
});

test('a missing plug-in folder is not an error', async () => {
  expect(await loadPlugins(join(tmpdir(), 'does-not-exist-tapestry'))).toEqual({
    plugins: [],
    failures: [],
  });
});
