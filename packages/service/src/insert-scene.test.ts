import { MemoryFs } from '@tapestry/core';
import { expect, test } from 'vitest';
import { ProjectService } from './project-service';
import { MAIN_SCRIPT } from './starter';

/** Two tiny stand-in videos. */
const clips = [
  { name: 'a.mp4', bytes: new Uint8Array([1, 2, 3]) },
  { name: 'b.mp4', bytes: new Uint8Array([4, 5, 6]) },
];

/**
 * Types a heading into the script one character at a time, saving after every keystroke like the app does while
 * someone writes, and returns the state after the last save.
 * @param service The project.
 * @param base Script text before the new scene.
 * @param before Text the new scene goes in front of.
 * @param heading The heading to type, without the INT. prefix.
 */
async function typeScene(service: ProjectService, base: string, before: string, heading: string) {
  let state = service.state();
  for (let length = 0; length <= heading.length; length++) {
    const text = base.replace(
      before,
      `INT. ${heading.slice(0, length) || 'LOCATION'} - DAY\n\n${before}`,
    );
    state = await service.saveScript(MAIN_SCRIPT, text);
  }
  return state;
}

test('adding a scene in the middle keeps the footage of every scene below it', async () => {
  const service = await ProjectService.open(new MemoryFs());
  const before = await service.addSampleFootage(clips);
  expect(before.clips).toHaveLength(9);

  const after = await typeScene(service, before.scriptText, 'EXT. FERRY DECK - DAWN', 'KITCHEN');

  expect(after.scenes).toHaveLength(4);
  expect(after.clips).toHaveLength(9);
  expect(after.clips.map((c) => c.shotId).sort()).toEqual(before.clips.map((c) => c.shotId).sort());
});
