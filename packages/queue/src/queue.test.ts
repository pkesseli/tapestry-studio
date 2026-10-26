import { ProviderError, createMockProvider } from '@tapestry/providers';
import type { Provider } from '@tapestry/providers';
import { expect, test } from 'vitest';
import { FrozenArtifactError } from './artifact-store';
import { QueueError } from './transitions';
import type { QueueEvent } from './queue';
import { createHarness, request, variant } from './test-harness';

test('a job goes from draft to rendered and stores hashed artifacts with provenance', async () => {
  const h = createHarness();
  const queue = await h.open();
  const draft = await queue.createDraft(request('image'));
  expect(draft.state).toBe('draft');
  expect(draft.estimate?.notes).toMatch(/Mock/);
  await queue.approve(draft.id);
  await queue.runUntilIdle();

  const job = queue.get(draft.id);
  expect(job?.state).toBe('rendered');
  expect(job?.history.map((entry) => entry.to)).toEqual([
    'draft',
    'approved',
    'queued',
    'running',
    'rendered',
  ]);
  const artifact = await queue.artifacts.load(job?.artifactIds[0] ?? 'art_x');
  expect(artifact?.files[0]?.path).toMatch(/^artifacts\/art_\w+\/image\.png$/);
  expect(artifact?.provenance).toMatchObject({ providerId: 'mock', model: 'mock-image' });
  expect(await queue.artifacts.verify(artifact!)).toBeUndefined();
});

test('accepting freezes the result; un-accepting thaws it and keeps the files', async () => {
  const h = createHarness();
  const queue = await h.open();
  const { id } = await queue.createDraft(request());
  await queue.approve(id);
  await queue.runUntilIdle();
  const artifactId = queue.get(id)!.artifactIds[0]!;

  await queue.accept(id);
  expect((await queue.artifacts.load(artifactId))?.accepted).toBe(true);
  await expect(queue.artifacts.assertWritable(artifactId)).rejects.toBeInstanceOf(
    FrozenArtifactError,
  );
  const accepted = await queue.artifacts.load(artifactId);
  await expect(
    queue.artifacts.create({ ...accepted!, accepted: false }, [
      { mediaType: 'image', fileName: 'image.png', bytes: new Uint8Array([1]) },
    ]),
  ).rejects.toBeInstanceOf(FrozenArtifactError);

  await queue.unaccept(id);
  const thawed = await queue.artifacts.load(artifactId);
  expect(thawed?.accepted).toBe(false);
  expect(await queue.artifacts.verify(thawed!)).toBeUndefined();
});

test('accepting refuses a result whose file changed after generation', async () => {
  const h = createHarness();
  const queue = await h.open();
  const { id } = await queue.createDraft(request());
  await queue.approve(id);
  await queue.runUntilIdle();
  const artifact = await queue.artifacts.load(queue.get(id)!.artifactIds[0]!);
  await h.fs.writeBytes(artifact!.files[0]!.path, new Uint8Array([0]));
  await expect(queue.accept(id)).rejects.toThrow(/changed after it was generated/);
});

test('redo rejects the result and creates a new draft with a different seed, keeping the old files', async () => {
  const h = createHarness();
  const queue = await h.open();
  const { id } = await queue.createDraft({ ...request(), seed: 1 });
  await queue.approve(id);
  await queue.runUntilIdle();
  const next = await queue.redo(id, { prompt: 'a brighter harbor' });
  expect(queue.get(id)?.state).toBe('redone');
  expect(next.state).toBe('draft');
  expect(next.request.prompt).toBe('a brighter harbor');
  expect(next.request.seed).not.toBe(1);
  expect(await h.fs.exists(`artifacts/${queue.get(id)!.artifactIds[0]}/image.png`)).toBe(true);
});

test('illegal operations are refused with a QueueError', async () => {
  const queue = await createHarness().open();
  const { id } = await queue.createDraft(request());
  await expect(queue.accept(id)).rejects.toBeInstanceOf(QueueError);
  await expect(queue.redo(id)).rejects.toBeInstanceOf(QueueError);
  await queue.cancel(id);
  await expect(queue.approve(id)).rejects.toBeInstanceOf(QueueError);
  await expect(queue.cancel('job_00000000000000000000000000')).rejects.toThrow(/Unknown job/);
});

test('requests over the provider limits are refused at draft time', async () => {
  const queue = await createHarness().open();
  await expect(queue.createDraft({ ...request('video'), durationSeconds: 99 })).rejects.toThrow(
    /at most 15 seconds/,
  );
});

test('higher priority runs first, and a local provider runs one job at a time', async () => {
  const h = createHarness({ config: { pollsUntilDone: 3 } });
  const queue = await h.open();
  const low = await queue.createDraft(request('image', 'low'));
  const high = await queue.createDraft(request('image', 'high'), { priority: 5 });
  await queue.approve(low.id);
  await queue.approve(high.id);

  await queue.tick();
  expect(queue.get(high.id)?.state).toBe('running');
  expect(queue.get(low.id)?.state).toBe('queued');
  await queue.runUntilIdle();
  expect(queue.get(low.id)?.state).toBe('rendered');
});

test('concurrency can be raised per provider', async () => {
  const h = createHarness({ config: { pollsUntilDone: 3 } });
  const queue = await h.open({ concurrency: { mock: 2 } });
  const ids = [
    await queue.createDraft(request('image', 'a')),
    await queue.createDraft(request('image', 'b')),
  ];
  for (const job of ids) await queue.approve(job.id);
  await queue.tick();
  expect(ids.map((j) => queue.get(j.id)?.state)).toEqual(['running', 'running']);
});

test('jobs survive a restart: polling resumes with the stored provider reference', async () => {
  const h = createHarness({ config: { pollsUntilDone: 3 } });
  const before = await h.open();
  const { id } = await before.createDraft(request());
  await before.approve(id);
  await before.tick();
  expect(before.get(id)?.state).toBe('running');

  const after = await h.open();
  expect(after.get(id)?.remoteRef).toBe(before.get(id)?.remoteRef);
  await after.runUntilIdle();
  expect(after.get(id)?.state).toBe('rendered');
  expect(h.store.jobs.size).toBe(1);
});

test('a job that crashed before saving its provider reference is queued again without duplicating work', async () => {
  const h = createHarness({ config: { pollsUntilDone: 2 } });
  const before = await h.open();
  const { id } = await before.createDraft(request());
  await before.approve(id);
  await before.tick();
  const running = before.get(id)!;
  const { remoteRef: _lost, ...withoutRef } = running;
  await h.fs.writeText(`jobs/${id}.json`, JSON.stringify(withoutRef));

  const after = await h.open();
  expect(after.get(id)?.state).toBe('queued');
  await after.runUntilIdle();
  expect(after.get(id)?.state).toBe('rendered');
  expect(h.store.jobs.size).toBe(1);
});

/**
 * Provider whose first `failures` submissions fail with a retryable error.
 * @param failures How many submissions fail before one succeeds.
 */
const flaky = (failures: number) => (store: Parameters<typeof variant>[0]) => {
  let seen = 0;
  return variant(store, (mock: Provider) => ({
    submit: (req, ctx) =>
      seen++ < failures
        ? Promise.reject(new ProviderError('Server busy', true))
        : mock.submit(req, ctx),
  }));
};

test('retryable failures are retried with doubling back-off, then succeed', async () => {
  const h = createHarness({ definition: flaky(2), config: { pollsUntilDone: 1 } });
  const queue = await h.open({ backoffBaseSeconds: 2 });
  const { id } = await queue.createDraft(request());
  await queue.approve(id);
  const start = h.clock.ms;

  await queue.tick();
  expect(queue.get(id)).toMatchObject({ state: 'queued', attempts: 1 });
  expect(Date.parse(queue.get(id)!.retryAt!) - start).toBe(2000);
  await queue.tick();
  expect(queue.get(id)?.attempts).toBe(1);

  await queue.runUntilIdle();
  const finished = queue.get(id)!;
  expect(finished.state).toBe('rendered');
  expect(finished.attempts).toBe(2);
  expect(h.clock.ms - start).toBeGreaterThanOrEqual(2000 + 4000);
});

test('gives up after the maximum number of attempts and can be retried by the user', async () => {
  const h = createHarness({ definition: flaky(99) });
  const queue = await h.open({ maxAttempts: 3, backoffBaseSeconds: 1 });
  const { id } = await queue.createDraft(request());
  await queue.approve(id);
  await queue.runUntilIdle();
  expect(queue.get(id)).toMatchObject({
    state: 'failed',
    attempts: 3,
    error: { message: 'Server busy', retryable: true },
  });

  await queue.retry(id);
  expect(queue.get(id)).toMatchObject({ state: 'queued', attempts: 0 });
});

test('permanent failures fail immediately', async () => {
  const h = createHarness({ config: { failure: 'permanent' } });
  const queue = await h.open();
  const { id } = await queue.createDraft(request());
  await queue.approve(id);
  await queue.runUntilIdle();
  expect(queue.get(id)).toMatchObject({ state: 'failed', error: { retryable: false } });
});

test('cancelling a running job stops it at the provider', async () => {
  const h = createHarness({ config: { pollsUntilDone: 5 } });
  const queue = await h.open();
  const { id } = await queue.createDraft(request());
  await queue.approve(id);
  await queue.tick();
  await queue.cancel(id);
  expect(queue.get(id)?.state).toBe('cancelled');
  const ref = queue.get(id)!.remoteRef!;
  expect((await createMockProvider({}, h.store).poll(ref)).status).toBe('cancelled');
});

test('subscribers see every state change and an idle notice', async () => {
  const h = createHarness({ config: { pollsUntilDone: 1 } });
  const queue = await h.open();
  const events: QueueEvent[] = [];
  const unsubscribe = queue.subscribe((event) => events.push(event));
  const { id } = await queue.createDraft(request());
  await queue.approve(id);
  await queue.runUntilIdle();
  unsubscribe();
  await queue.cancel((await queue.createDraft(request())).id);

  const states = events.flatMap((e) =>
    e.type === 'job-changed' && e.job.id === id ? [e.job.state] : [],
  );
  expect(states).toEqual(['draft', 'approved', 'queued', 'running', 'rendered']);
  expect(events.at(-1)?.type).toBe('idle');
});

test('paid providers are refused without a budget and respect caps and cancellation', async () => {
  const paid = (store: Parameters<typeof variant>[0]) =>
    variant(store, (mock: Provider) => ({
      manifest: { ...mock.manifest, paid: true, local: false },
      estimate: () => ({ ok: true, estimate: { cost: 3, seconds: 1, notes: 'Paid' } }),
    }));

  const noBudget = await createHarness({ definition: paid }).open();
  const draft = await noBudget.createDraft(request());
  await expect(noBudget.approve(draft.id)).rejects.toThrow(/set a budget/);

  const h = createHarness({
    definition: paid,
    budget: { currency: 'USD', projectCap: 7, perApprovalCap: 4 },
  });
  const queue = await h.open();
  const drafts = [
    await queue.createDraft(request('image', 'a')),
    await queue.createDraft(request('image', 'b')),
    await queue.createDraft(request('image', 'c')),
  ];
  await queue.approve(drafts[0]!.id);
  await queue.approve(drafts[1]!.id);
  expect(queue.spend()).toEqual({ spent: 0, reserved: 6, remaining: 1 });
  await expect(queue.approve(drafts[2]!.id)).rejects.toThrow(/1 left/);

  await queue.cancel(drafts[1]!.id);
  expect(queue.spend().remaining).toBe(4);
  await queue.approve(drafts[2]!.id);
});
