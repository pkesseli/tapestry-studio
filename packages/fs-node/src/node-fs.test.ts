import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { NodeFs } from './node-fs';

/** Creates an empty temporary project folder. */
const tempFs = async (): Promise<{ fs: NodeFs; dir: string }> => {
  const dir = await mkdtemp(join(tmpdir(), 'tapestry-fs-'));
  return { fs: new NodeFs(dir), dir };
};

test('writes atomically, creating parent folders, and leaves no temp files', async () => {
  const { fs, dir } = await tempFs();
  await fs.writeText('a/b/c.json', '{}\n');
  expect(await fs.readText('a/b/c.json')).toBe('{}\n');
  expect(await readdir(join(dir, 'a', 'b'))).toEqual(['c.json']);
});

test('lists sorted entries and treats a missing folder as empty', async () => {
  const { fs } = await tempFs();
  await fs.writeText('x/2.json', '');
  await fs.writeText('x/1.json', '');
  await fs.writeText('x/sub/3.json', '');
  expect(await fs.list('x')).toEqual([
    { name: '1.json', isDirectory: false },
    { name: '2.json', isDirectory: false },
    { name: 'sub', isDirectory: true },
  ]);
  expect(await fs.list('missing')).toEqual([]);
});

test('exists and remove behave, and remove ignores missing files', async () => {
  const { fs } = await tempFs();
  await fs.writeText('f.txt', 'hi');
  expect(await fs.exists('f.txt')).toBe(true);
  await fs.remove('f.txt');
  await fs.remove('f.txt');
  expect(await fs.exists('f.txt')).toBe(false);
});

test('refuses paths that escape the project folder', async () => {
  const { fs } = await tempFs();
  await expect(fs.readText('../outside.txt')).rejects.toThrow(/escapes/);
  await expect(fs.writeText('../outside.txt', 'x')).rejects.toThrow(/escapes/);
});
