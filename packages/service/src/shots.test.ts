import { MemoryFs, loadProject } from '@tapestry/core';
import { expect, test } from 'vitest';
import { ProjectService } from './project-service';
import { MAIN_SCRIPT } from './starter';

/** A queue that does not wait between steps, and seeds that count up, so tests are quick and repeatable. */
function fast() {
  let n = 0;
  return {
    queue: { sleep: () => Promise.resolve(), pollIntervalMs: 0 },
    random: () => (++n * 0.1) % 1,
  };
}

/**
 * Opens a project on the mock provider and returns it with the first shot of the first scene.
 * @param fs File system to use, so a test can reopen the same project.
 */
async function open(fs = new MemoryFs()) {
  const service = await ProjectService.open(fs, fast());
  const shot = service.state().scenes[0]?.shots[0];
  if (!shot) throw new Error('starter project changed');
  return { service, shot, fs };
}

test('making a shot queues a draft take that finishes and becomes the shot footage', async () => {
  const { service, shot } = await open();
  const started = await service.makeShot(shot.id);
  expect(started.takes).toHaveLength(1);
  expect(started.takes[0]).toMatchObject({ shotId: shot.id, quality: 'draft', sample: true });
  await service.waitUntilIdle();
  const state = service.state();
  expect(state.takes[0]).toMatchObject({ state: 'rendered', accepted: false });
  expect(state.takes[0]?.path).toMatch(/^artifacts\/art_.*\/clip\.mp4$/);
  expect(state.clips).toHaveLength(1);
  expect(state.clips[0]).toMatchObject({ shotId: shot.id, quality: 'draft', accepted: false });
});

test('the final follows the accepted draft: its seed, its prompt, and a link back to it', async () => {
  const { service, shot } = await open();
  await service.makeShot(shot.id);
  await service.waitUntilIdle();
  const draft = service.state().takes[0];
  if (!draft) throw new Error('no take');
  await expect(service.makeFinal(draft.jobId)).rejects.toThrow(/not been accepted/);
  await service.acceptTake(draft.jobId);
  await service.makeFinal(draft.jobId);
  await service.waitUntilIdle();
  const takes = service.state().takes;
  const final = takes.find((t) => t.quality === 'final');
  expect(final).toMatchObject({ sourceJobId: draft.jobId, state: 'rendered', seed: draft.seed });
  expect(takes.find((t) => t.jobId === draft.jobId)?.accepted).toBe(true);
  // The footage shown is now the final, not the draft.
  expect(service.state().clips[0]).toMatchObject({ quality: 'final' });
});

test('a shot has at most one accepted take per quality', async () => {
  const { service, shot } = await open();
  await service.makeShot(shot.id);
  await service.makeShot(shot.id);
  await service.waitUntilIdle();
  const [first, second] = service.state().takes;
  if (!first || !second) throw new Error('expected two takes');
  await service.acceptTake(first.jobId);
  await expect(service.acceptTake(second.jobId)).rejects.toThrow(
    /already has an accepted draft take/,
  );
});

test('another take replaces a rejected one with a new seed and keeps the old files', async () => {
  const { service, shot } = await open();
  await service.makeShot(shot.id);
  await service.waitUntilIdle();
  const first = service.state().takes[0];
  if (!first) throw new Error('no take');
  await service.anotherTake(first.jobId);
  await service.waitUntilIdle();
  const takes = service.state().takes;
  expect(takes.map((t) => t.state)).toEqual(['redone', 'rendered']);
  expect(takes[1]?.seed).not.toBe(first.seed);
  expect(takes[0]?.path).toBe(first.path);
});

test('saving the script while takes exist never deletes the queue files, and takes survive a restart', async () => {
  const { service, shot, fs } = await open();
  await service.makeShot(shot.id);
  await service.waitUntilIdle();
  const take = service.state().takes[0];
  if (!take) throw new Error('no take');
  await service.saveScript(MAIN_SCRIPT, `${service.state().scriptText}\n`);
  await service.createEntity({ kind: 'character', name: 'Maria' });
  const files = Object.keys(fs.files());
  expect(files).toContain(`jobs/${take.jobId}.json`);
  expect(files.some((f) => f.startsWith('artifacts/') && f.endsWith('/artifact.json'))).toBe(true);
  const project = await loadProject(fs);
  expect(project.jobs.map((j) => j.id)).toEqual([take.jobId]);

  const again = await ProjectService.open(fs, fast());
  expect(again.state().takes[0]).toMatchObject({ jobId: take.jobId, state: 'rendered' });
  expect(again.state().clips).toHaveLength(1);
});

test('listeners hear about background changes', async () => {
  const { service, shot } = await open();
  let heard = 0;
  service.onChange(() => heard++);
  await service.makeShot(shot.id);
  await service.waitUntilIdle();
  expect(heard).toBeGreaterThan(0);
});

test('a shot that no longer exists cannot be made', async () => {
  const { service } = await open();
  await expect(service.makeShot('sht_missing')).rejects.toThrow(/does not exist/);
});
