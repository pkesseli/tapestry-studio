import { expect, test } from 'vitest';
import type { Capability, GenerationRequest } from '@tapestry/core';
import { MOCK_MANIFEST, createMockProvider, createMockStore } from '../mock/mock-provider';
import type { MockStore } from '../mock/mock-provider';
import type { Provider } from '../types';
import { CONTRACT_CHECKS } from './contract';
import type { ContractFixture } from './contract';

/**
 * Builds a valid request.
 * @param capability What to generate.
 */
const request = (capability: Capability): GenerationRequest => ({
  capability,
  provider: { providerId: 'mock' },
  prompt: 'p',
  references: [],
  audioInputs: [],
  durationSeconds: 3,
  extras: {},
});

/** Fixture for a deliberately broken adapter: it forgets to enforce its own limits and loses jobs on restart. */
const broken: ContractFixture = (() => {
  const stores = new WeakMap<Provider, MockStore>();
  const make = (): Provider => {
    const store = createMockStore();
    const provider: Provider = {
      ...createMockProvider({}, store),
      estimate: () => ({ ok: true, estimate: { notes: 'always fine' } }),
    };
    stores.set(provider, store);
    return provider;
  };
  return {
    create: make,
    createSlow: make,
    restart: () => createMockProvider({}, createMockStore()),
    request,
    overLimitRequest: () => ({
      ...request('video'),
      durationSeconds: (MOCK_MANIFEST.limits.video?.maxDurationSeconds ?? 0) + 1,
    }),
  };
})();

test.each(['rejects requests over its limits', 'jobs can be polled after a restart'])(
  'the contract catches a broken adapter: %s',
  async (fragment) => {
    const check = CONTRACT_CHECKS.find((c) => c.name.includes(fragment));
    expect(check).toBeDefined();
    await expect(check?.run(broken)).rejects.toThrow();
  },
);
