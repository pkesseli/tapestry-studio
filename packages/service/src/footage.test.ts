import { MemoryFs, loadProject } from '@tapestry/core';
import { expect, test } from 'vitest';
import { ProjectService } from './project-service';
import { MAIN_SCRIPT } from './starter';

/** Two tiny stand-in videos. */
const clips = [
  { name: 'a.mp4', bytes: new Uint8Array([1, 2, 3]) },
  { name: 'b.mp4', bytes: new Uint8Array([4, 5, 6]) },
];

test('scenes without shots get shots, jobs, artifacts and video files', async () => {
  const fs = new MemoryFs();
  const service = await ProjectService.open(fs);
  const state = await service.addSampleFootage(clips);

  expect(state.scenes.map((scene) => scene.shots.length)).toEqual([3, 3]);
  expect(state.scenes[0]?.shots[1]?.action).toBe('MARIA: Is anyone there?');
  expect(state.clips.length).toBe(state.scenes.reduce((n, s) => n + s.shots.length, 0));
  for (const clip of state.clips) expect(await fs.readBytes(clip.path)).toHaveLength(3);
  expect(state.clips.every((clip) => clip.sample)).toBe(true);

  const perScene = state.scenes.map((s) => state.clips.filter((c) => c.sceneId === s.id));
  for (const sceneClips of perScene) {
    expect(sceneClips[0]?.accepted).toBe(true);
    expect(sceneClips.slice(1).every((c) => !c.accepted)).toBe(true);
  }
});

test('the footage is valid project data and survives a restart and script edits', async () => {
  const fs = new MemoryFs();
  const service = await ProjectService.open(fs);
  const before = await service.addSampleFootage(clips);
  const reloaded = await loadProject(fs);
  expect(reloaded.jobs).toHaveLength(before.clips.length);
  expect(reloaded.artifacts.filter((a) => a.accepted)).toHaveLength(before.scenes.length);

  const edited = before.scriptText.replace('INT. HARBOR - NIGHT', 'INT. OLD HARBOR - NIGHT');
  const after = await service.saveScript(MAIN_SCRIPT, edited);
  expect(after.clips.map((c) => c.shotId)).toEqual(before.clips.map((c) => c.shotId));

  const again = await ProjectService.open(fs);
  expect(again.state().clips).toHaveLength(before.clips.length);
});

test('adding footage twice does not add shots to scenes that already have them', async () => {
  const service = await ProjectService.open(new MemoryFs());
  const first = await service.addSampleFootage(clips);
  const second = await service.addSampleFootage(clips);
  expect(second.clips).toHaveLength(first.clips.length);
});

test('adding no clips changes nothing', async () => {
  const service = await ProjectService.open(new MemoryFs());
  expect((await service.addSampleFootage([])).clips).toEqual([]);
});
