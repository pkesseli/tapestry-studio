import { expect, test } from 'vitest';
import { checkPackage } from './check-deps.mjs';

test('accepts a package that follows the dependency direction', () => {
  const manifest = { dependencies: { '@tapestry/core': 'workspace:*' } };
  const sources = { 'a.ts': "import { x } from '@tapestry/core';" };
  expect(checkPackage('queue', manifest, sources)).toEqual([]);
});

test('rejects core importing another internal package', () => {
  const violations = checkPackage('core', {}, { 'a.ts': "import { x } from '@tapestry/queue';" });
  expect(violations).toHaveLength(1);
});

test('rejects an undeclared dependency in package.json', () => {
  const manifest = { dependencies: { '@tapestry/app': 'workspace:*' } };
  expect(checkPackage('queue', manifest, {})).toHaveLength(1);
});

test('rejects Node and Electron imports in pure packages only', () => {
  const sources = { 'a.ts': "import { readFile } from 'node:fs'; import 'electron';" };
  expect(checkPackage('script', {}, sources)).toHaveLength(2);
  expect(checkPackage('queue', {}, sources)).toEqual([]);
});

test('rejects packages missing from the allow-list', () => {
  expect(checkPackage('mystery', {}, {})).toHaveLength(1);
});
