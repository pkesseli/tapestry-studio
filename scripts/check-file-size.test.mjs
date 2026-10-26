import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { findOversizeFiles } from './check-file-size.mjs';

test('reports only files over the limit and ignores node_modules', () => {
  const root = mkdtempSync(join(tmpdir(), 'size-'));
  mkdirSync(join(root, 'src'));
  mkdirSync(join(root, 'node_modules'));
  writeFileSync(join(root, 'src', 'small.ts'), 'a\n'.repeat(10));
  writeFileSync(join(root, 'src', 'big.ts'), 'a\n'.repeat(500));
  writeFileSync(join(root, 'node_modules', 'big.js'), 'a\n'.repeat(500));
  expect(findOversizeFiles(root, 400)).toEqual([{ file: join('src', 'big.ts'), lines: 501 }]);
});
