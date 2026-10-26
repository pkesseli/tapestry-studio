import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveProject } from '@tapestry/core';
import { buildSampleFilm } from '@tapestry/core/testing';
import { NodeFs } from '@tapestry/fs-node';
import { ProviderRegistry, mockProviderDefinition } from '@tapestry/providers';
import { JobQueue } from '@tapestry/queue';
import { expect, test } from 'vitest';
import { headlessBudget, main } from './main';

/** Collects CLI output. */
function capture(env: Record<string, string | undefined> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l), env },
  };
}

/**
 * Creates a project folder holding the sample film with `count` approved mock jobs waiting.
 * @param count Number of queued jobs.
 */
async function projectWithQueuedJobs(
  count: number,
): Promise<{ folder: string; fs: NodeFs; ids: string[] }> {
  const folder = await mkdtemp(join(tmpdir(), 'tapestry-cli-'));
  const fs = new NodeFs(folder);
  await saveProject(fs, { ...buildSampleFilm(), jobs: [], artifacts: [], timelines: [] });
  const registry = new ProviderRegistry();
  registry.register(mockProviderDefinition);
  const queue = await JobQueue.open({ fs, registry });
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const draft = await queue.createDraft({
      capability: 'image',
      provider: { providerId: 'mock' },
      prompt: `shot ${i}`,
      references: [],
      audioInputs: [],
      extras: {},
    });
    await queue.approve(draft.id);
    ids.push(draft.id);
  }
  return { folder, fs, ids };
}

test('`queue run` renders every queued job and writes real files', async () => {
  const { folder, fs, ids } = await projectWithQueuedJobs(2);
  const { io, out, err } = capture();
  expect(await main(['queue', 'run', folder], io)).toBe(0);
  expect(out.at(-1)).toBe('Done: 2 job(s), 0 failed.');
  expect(err).toEqual([]);
  const reopened = await JobQueue.open({ fs, registry: new ProviderRegistry() });
  for (const id of ids) {
    const job = reopened.get(id as never);
    expect(job?.state).toBe('rendered');
    expect(await fs.exists(`artifacts/${job?.artifactIds[0]}/image.png`)).toBe(true);
  }
});

test('reports a folder that is not a project', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'tapestry-empty-'));
  const { io, err } = capture();
  expect(await main(['queue', 'run', folder], io)).toBe(2);
  expect(err[0]).toMatch(/Not found/);
});

test('prints usage for unknown commands', async () => {
  const { io, out } = capture();
  expect(await main(['bogus'], io)).toBe(2);
  expect(out[0]).toMatch(/Usage: tapestry/);
  expect(await main([], capture().io)).toBe(0);
});

test('headless runs only get a budget from TAPESTRY_BUDGET_CAP, never above the project limits', () => {
  const project = { currency: 'EUR', projectCap: 20, perApprovalCap: 5 };
  expect(headlessBudget(project, undefined)).toBeUndefined();
  expect(headlessBudget(project, '8')).toEqual({
    currency: 'EUR',
    projectCap: 8,
    perApprovalCap: 5,
  });
  expect(headlessBudget(project, '50')).toEqual(project);
  expect(headlessBudget(undefined, '3')).toEqual({
    currency: 'USD',
    projectCap: 3,
    perApprovalCap: 3,
  });
  expect(() => headlessBudget(project, 'lots')).toThrow(/non-negative number/);
});
