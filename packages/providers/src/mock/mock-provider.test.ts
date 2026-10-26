import { describe, expect, test } from 'vitest';
import type { Capability, GenerationRequest } from '@tapestry/core';
import { describeProviderContract } from '../testing';
import type { Provider, ProviderConfig } from '../types';
import { MOCK_MANIFEST, createMockProvider, createMockStore } from './mock-provider';
import type { MockStore } from './mock-provider';

/**
 * Builds a valid mock request.
 * @param capability What to generate.
 */
const request = (capability: Capability): GenerationRequest => ({
  capability,
  provider: { providerId: 'mock' },
  prompt: `a ${capability} of a harbor at night`,
  references: [{ path: 'entities/characters/a/face.png', mediaType: 'image', role: 'face' }],
  audioInputs: [],
  durationSeconds: 3,
  extras: {},
});

/** Store behind each provider created for the contract run, so `restart` can reuse it. */
const stores = new WeakMap<Provider, MockStore>();

/**
 * Creates a mock provider with its own store and remembers the store.
 * @param config Mock configuration.
 */
function tracked(config: ProviderConfig = {}): Provider {
  const store = createMockStore();
  const provider = createMockProvider(config, store);
  stores.set(provider, store);
  return provider;
}

describeProviderContract('mock', {
  create: () => tracked(),
  createSlow: () => tracked({ pollsUntilDone: 5 }),
  restart: (previous) => createMockProvider({}, stores.get(previous)),
  createFailing: (retryable) => tracked({ failure: retryable ? 'transient' : 'permanent' }),
  request,
  overLimitRequest: () => ({
    ...request('video'),
    durationSeconds: MOCK_MANIFEST.limits.video!.maxDurationSeconds! + 1,
  }),
});

describe('mock provider specifics', () => {
  test('restart keeps jobs when the store is shared', async () => {
    const store = createMockStore();
    const before = createMockProvider({}, store);
    const ref = await before.submit(request('image'), {
      idempotencyKey: 'job-1',
      readFile: async () => new Uint8Array(),
    });
    const after = createMockProvider({}, store);
    expect((await after.poll(ref)).status).toBe('running');
    expect((await after.poll(ref)).status).toBe('succeeded');
  });

  test('is deterministic: the same request gives byte-identical output', async () => {
    const run = async () => {
      const provider = createMockProvider({ pollsUntilDone: 1 });
      const ref = await provider.submit(request('image'), {
        idempotencyKey: 'x',
        readFile: async () => new Uint8Array(),
      });
      const result = await provider.poll(ref);
      return result.status === 'succeeded'
        ? Buffer.from(result.outputs[0]!.bytes).toString('hex')
        : '';
    };
    expect(await run()).toBe(await run());
    expect(await run()).not.toBe('');
  });

  test('different prompts give different images', async () => {
    const make = async (prompt: string) => {
      const provider = createMockProvider({ pollsUntilDone: 1 });
      const ref = await provider.submit(
        { ...request('image'), prompt },
        { idempotencyKey: prompt, readFile: async () => new Uint8Array() },
      );
      const result = await provider.poll(ref);
      return result.status === 'succeeded'
        ? Buffer.from(result.outputs[0]!.bytes).toString('hex')
        : '';
    };
    expect(await make('red barn')).not.toBe(await make('blue ocean'));
  });

  test('produces real media: PNG, WAV and MP4 signatures', async () => {
    const provider = createMockProvider({ pollsUntilDone: 1 });
    const signature = async (capability: Capability): Promise<string> => {
      const ref = await provider.submit(request(capability), {
        idempotencyKey: capability,
        readFile: async () => new Uint8Array(),
      });
      const result = await provider.poll(ref);
      if (result.status !== 'succeeded') throw new Error('not finished');
      return Buffer.from(result.outputs[0]!.bytes.subarray(0, 12)).toString('latin1');
    };
    expect(await signature('image')).toContain('PNG');
    expect(await signature('speech')).toMatch(/^RIFF.{4}WAVE$/s);
    expect(await signature('video')).toContain('ftyp');
  });
});
