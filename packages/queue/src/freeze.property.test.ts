import type { Id } from '@tapestry/core';
import { expect, test } from 'vitest';
import { QueueError } from './transitions';
import { createHarness, request } from './test-harness';

/**
 * Small deterministic random number generator, so a failing sequence can be reproduced from its seed.
 * @param seed Starting value.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('no sequence of operations ever changes the files of an accepted artifact', async () => {
  let acceptedObservations = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const random = mulberry32(seed);
    const h = createHarness({ config: { pollsUntilDone: 2 } });
    const queue = await h.open({ concurrency: { mock: 3 } });
    /** Content hash seen for each artifact at the moment it was accepted. */
    const frozen = new Map<Id<'art'>, string>();
    const pick = <T>(items: T[]): T | undefined => items[Math.floor(random() * items.length)];
    const jobsIn = (state: string) => queue.list().filter((job) => job.state === state);

    for (let step = 0; step < 40; step++) {
      const action = Math.floor(random() * 8);
      try {
        if (action === 0)
          await queue.createDraft(request(random() < 0.5 ? 'image' : 'speech', `p${step}`));
        else if (action === 1) await queue.approve(pick(jobsIn('draft'))?.id ?? 'job_x');
        else if (action <= 3) await queue.tick();
        else if (action === 4) await queue.accept(pick(jobsIn('rendered'))?.id ?? 'job_x');
        else if (action === 5) await queue.unaccept(pick(jobsIn('accepted'))?.id ?? 'job_x');
        else if (action === 6) await queue.redo(pick(jobsIn('rendered'))?.id ?? 'job_x');
        else await queue.cancel(pick([...jobsIn('queued'), ...jobsIn('running')])?.id ?? 'job_x');
      } catch (error) {
        if (!(error instanceof QueueError)) throw error;
      }

      for (const job of queue.list()) {
        for (const artifactId of job.artifactIds) {
          const artifact = await queue.artifacts.load(artifactId);
          if (!artifact) continue;
          if (artifact.accepted) {
            acceptedObservations++;
            expect(
              await queue.artifacts.verify(artifact),
              `seed ${seed} step ${step}`,
            ).toBeUndefined();
            frozen.set(artifactId, artifact.files.map((f) => f.contentHash).join());
          } else {
            frozen.delete(artifactId);
          }
          if (frozen.has(artifactId)) {
            expect(artifact.files.map((f) => f.contentHash).join()).toBe(frozen.get(artifactId));
          }
        }
      }
    }
  }
  expect(acceptedObservations).toBeGreaterThan(100);
});
