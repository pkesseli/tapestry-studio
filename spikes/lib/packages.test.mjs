import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { listPackages, savePackageCsv } from './packages.mjs';

/** A served folder with one package: two rows, a how-to, a comparison sheet and a reference-only folder. */
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'spike-pkg-'));
  const dir = join(root, 'incoming', 'pkg-1');
  mkdirSync(join(dir, 'minimax'), { recursive: true });
  mkdirSync(join(dir, 'plan10'), { recursive: true });
  writeFileSync(
    join(dir, 'ratings.csv'),
    'file,score_1_to_5,notes\nminimax/a.mp4,,\nminimax/b.mp4,,\n',
  );
  writeFileSync(join(dir, 'HOW-TO-RATE.txt'), 'rate it');
  writeFileSync(join(dir, 'minimax', 'sheet.png'), 'x');
  writeFileSync(join(dir, 'plan10', 'reference.png'), 'x');
  return { root, dir };
}

test('a package is listed with its row count, how-to and comparison sheets, but not the reference folder', () => {
  const { root } = setup();
  expect(listPackages(root)).toEqual([
    { dir: 'incoming/pkg-1', rows: 2, howTo: true, sheets: ['minimax/sheet.png'] },
  ]);
  expect(listPackages(mkdtempSync(join(tmpdir(), 'spike-empty-')))).toEqual([]);
});

test('saving keeps the untouched original the first time only', () => {
  const { root, dir } = setup();
  savePackageCsv(root, 'incoming/pkg-1', 'file,score_1_to_5,notes\nminimax/a.mp4,4,nice\n');
  savePackageCsv(root, 'incoming/pkg-1', 'file,score_1_to_5,notes\nminimax/a.mp4,5,better\n');
  expect(readFileSync(join(dir, 'ratings.csv'), 'utf8')).toContain('5,better');
  expect(readFileSync(join(dir, 'ratings.original.csv'), 'utf8')).toBe(
    'file,score_1_to_5,notes\nminimax/a.mp4,,\nminimax/b.mp4,,\n',
  );
});

test('only the ratings file of a real package under incoming can be written', () => {
  const { root } = setup();
  const csv = 'file,score_1_to_5,notes\n';
  expect(() => savePackageCsv(root, '../etc', csv)).toThrow(/not a rating package/);
  expect(() => savePackageCsv(root, 'incoming/../draft-final', csv)).toThrow(
    /not a rating package/,
  );
  expect(() => savePackageCsv(root, 'incoming/pkg-1/minimax', csv)).toThrow(/not a rating package/);
  expect(() => savePackageCsv(root, 'incoming/other', csv)).toThrow(/no ratings.csv/);
  expect(() => savePackageCsv(root, 'incoming/pkg-1', 'oops')).toThrow(/must start with/);
  expect(() => savePackageCsv(root, 'incoming/pkg-1', csv + 'x'.repeat(2 * 1024 * 1024))).toThrow(
    /too large/,
  );
});
