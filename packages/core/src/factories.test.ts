import { expect, test } from 'vitest';
import { createEntity, createProject } from './factories';
import { MemoryFs } from './fs-port';
import { isId } from './ids';
import { loadProject, saveProject } from './storage';
import type { EntityKind } from './schema/entities';

test.each<[EntityKind, 'chr' | 'loc' | 'prp' | 'voc' | 'ins']>([
  ['character', 'chr'],
  ['location', 'loc'],
  ['prop', 'prp'],
  ['voice', 'voc'],
  ['instrument', 'ins'],
])('creates a valid %s with a matching id', async (kind, prefix) => {
  const entity = createEntity({ kind, name: '  Nora ', description: " Harbor master's daughter " });
  expect(entity).toMatchObject({ kind, name: 'Nora', description: "Harbor master's daughter" });
  expect(isId(entity.id, prefix)).toBe(true);

  const fs = new MemoryFs();
  await saveProject(fs, {
    project: createProject('Test'),
    scripts: {},
    entities: [entity],
    scenes: [],
    sections: [],
    jobs: [],
    artifacts: [],
    timelines: [],
  });
  expect((await loadProject(fs)).entities).toEqual([entity]);
});

test('refuses a blank name', () => {
  expect(() => createEntity({ kind: 'prop', name: '   ' })).toThrow(/needs a name/);
});

test('a new project has defaults and a creation time', () => {
  const project = createProject('Film', new Date('2026-10-28T10:00:00.000Z'));
  expect(project).toMatchObject({
    name: 'Film',
    createdAt: '2026-10-28T10:00:00.000Z',
    settings: { aspectRatio: '16:9', fps: 24, simpleMode: true },
  });
});
