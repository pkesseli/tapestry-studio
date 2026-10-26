import { expect, test } from 'vitest';
import { ProjectFormatError } from './errors';
import { runMigrations } from './migrations';
import type { Migration } from './migrations';

/** Fake migration chain: version 1 stored `title`, version 2 renamed it to `name`, version 3 adds `tags`. */
const chain: Migration[] = [
  {
    from: 1,
    to: 2,
    migrate: (files) => {
      const { title, ...rest } = files['project.json'] as { title: string; schemaVersion: number };
      return { ...files, 'project.json': { ...rest, name: title, schemaVersion: 2 } };
    },
  },
  {
    from: 2,
    to: 3,
    migrate: (files) => ({
      ...files,
      'project.json': { ...(files['project.json'] as object), tags: [], schemaVersion: 3 },
    }),
  },
];

test('applies migrations in order and does not mutate the input', () => {
  const input = { 'project.json': { title: 'Film', schemaVersion: 1 } };
  const output = runMigrations(input, 1, 3, chain);
  expect(output['project.json']).toEqual({ name: 'Film', tags: [], schemaVersion: 3 });
  expect(input['project.json']).toEqual({ title: 'Film', schemaVersion: 1 });
});

test('does nothing when the project is current', () => {
  const input = { 'project.json': { schemaVersion: 3 } };
  expect(runMigrations(input, 3, 3, chain)).toBe(input);
});

test('rejects projects from a newer app', () => {
  expect(() => runMigrations({}, 4, 3, chain)).toThrow(/newer than this app/);
});

test('reports a missing migration step', () => {
  expect(() => runMigrations({}, 1, 3, [chain[1] as Migration])).toThrow(ProjectFormatError);
});
