import { MemoryFs, loadProject } from '@tapestry/core';
import { expect, test } from 'vitest';
import { ProjectService } from './project-service';
import { MAIN_SCRIPT } from './starter';

test('a new folder becomes a project with the example screenplay and its scenes', async () => {
  const fs = new MemoryFs();
  const service = await ProjectService.open(fs);
  const state = service.state();
  expect(state.projectName).toBe('Demo Film');
  expect(state.scriptText).toContain('INT. HARBOR - NIGHT');
  expect(state.scenes.map((s) => s.heading)).toEqual([
    'INT. HARBOR - NIGHT',
    'EXT. FERRY DECK - DAWN',
    'INT. CABIN - DAY',
  ]);
  expect(await loadProject(fs)).toMatchObject({ scenes: state.scenes });
});

test('opening an existing project keeps its data', async () => {
  const fs = new MemoryFs();
  const first = await ProjectService.open(fs);
  await first.createEntity({ kind: 'character', name: 'Maria' });
  const again = await ProjectService.open(fs);
  expect(again.state().entities.map((e) => e.name)).toEqual(['Maria']);
});

test('saving the script keeps scene ids when the text changes around them', async () => {
  const service = await ProjectService.open(new MemoryFs());
  const before = service.state();
  const edited = before.scriptText.replace(
    'EXT. FERRY DECK - DAWN',
    'INT. CABIN - DAY\n\nQuiet.\n\nEXT. FERRY DECK - DAWN',
  );
  const after = await service.saveScript(MAIN_SCRIPT, edited);
  expect(after.scenes).toHaveLength(4);
  expect(after.scenes[0]?.id).toBe(before.scenes[0]?.id);
  expect(after.scenes[2]?.id).toBe(before.scenes[1]?.id);
  expect(after.scenes[3]?.id).toBe(before.scenes[2]?.id);
});

test('script text survives a restart', async () => {
  const fs = new MemoryFs();
  const service = await ProjectService.open(fs);
  await service.saveScript(MAIN_SCRIPT, 'INT. A - DAY\n\nHello.\n');
  const again = await ProjectService.open(fs);
  expect(again.state().scriptText).toBe('INT. A - DAY\n\nHello.\n');
});

test('adding a character makes the names that pointed at nothing resolve', async () => {
  const service = await ProjectService.open(new MemoryFs());
  expect(service.state().scenes[0]?.entityIds).toEqual([]);
  const state = await service.createEntity({
    kind: 'character',
    name: 'Maria',
    description: 'Ferry captain',
  });
  const maria = state.entities[0];
  expect(maria).toMatchObject({ kind: 'character', name: 'Maria', description: 'Ferry captain' });
  expect(state.scenes[0]?.entityIds).toEqual([maria?.id]);
  expect(state.scenes[1]?.entityIds).toEqual([maria?.id]);
});

test('refuses duplicates, blank names and paths outside script/', async () => {
  const service = await ProjectService.open(new MemoryFs());
  await service.createEntity({ kind: 'prop', name: 'Lantern' });
  await expect(service.createEntity({ kind: 'prop', name: 'lantern' })).rejects.toThrow(
    /already exists/,
  );
  await expect(service.createEntity({ kind: 'prop', name: ' ' })).rejects.toThrow(/needs a name/);
  await expect(service.saveScript('../outside.txt', 'x')).rejects.toThrow(/Not a script file/);
  await expect(service.saveScript('project.json', 'x')).rejects.toThrow(/Not a script file/);
});

test('overlapping operations are applied in order and a failure does not block later ones', async () => {
  const service = await ProjectService.open(new MemoryFs());
  const results = await Promise.allSettled([
    service.createEntity({ kind: 'character', name: 'Maria' }),
    service.createEntity({ kind: 'character', name: 'Maria' }),
    service.saveScript(MAIN_SCRIPT, 'INT. A - DAY\n\nMARIA waves.\n'),
    service.createEntity({ kind: 'prop', name: 'Lantern' }),
  ]);
  expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled', 'fulfilled']);
  const state = service.state();
  expect(state.entities.map((e) => e.name)).toEqual(['Maria', 'Lantern']);
  expect(state.scenes[0]?.entityIds).toHaveLength(1);
});

test('the workspace (scene, cursor, folded acts) is remembered across restarts', async () => {
  const fs = new MemoryFs();
  const service = await ProjectService.open(fs);
  expect(service.state().workspace).toEqual({ collapsedActs: [] });
  const sceneId = service.state().scenes[1]?.id;
  await service.saveWorkspace({ activeSceneId: sceneId as never, cursor: 120 });
  await service.saveWorkspace({ collapsedActs: ['Act One'] });
  const again = await ProjectService.open(fs);
  expect(again.state().workspace).toEqual({
    activeSceneId: sceneId,
    cursor: 120,
    collapsedActs: ['Act One'],
  });
  expect(Object.keys(fs.files())).toContain('.tapestry/workspace.json');
});

test('a damaged workspace file never blocks opening, and invalid updates are refused', async () => {
  const fs = new MemoryFs();
  const service = await ProjectService.open(fs);
  await fs.writeText('.tapestry/workspace.json', '{ not json');
  const again = await ProjectService.open(fs);
  expect(again.state().workspace).toEqual({ collapsedActs: [] });
  await expect(again.saveWorkspace({ cursor: -5 })).rejects.toThrow(/Invalid workspace/);
  await expect(service.saveWorkspace({ activeSceneId: 'nonsense' as never })).rejects.toThrow(
    /Invalid workspace/,
  );
});

test('workspace saves do not disturb the project files', async () => {
  const fs = new MemoryFs();
  const service = await ProjectService.open(fs);
  const before = { ...fs.files() };
  await service.saveWorkspace({ cursor: 3 });
  const after = fs.files();
  for (const [path, text] of Object.entries(before)) expect(after[path]).toBe(text);
});
