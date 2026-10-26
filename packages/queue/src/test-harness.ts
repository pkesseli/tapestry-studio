import { MemoryFs } from '@tapestry/core';
import type { Budget, Capability, GenerationRequest } from '@tapestry/core';
import {
  MOCK_MANIFEST,
  ProviderRegistry,
  createMockProvider,
  createMockStore,
} from '@tapestry/providers';
import type { MockStore, Provider, ProviderConfig, ProviderDefinition } from '@tapestry/providers';
import { JobQueue } from './queue';
import type { QueueOptions } from './queue';

/** Everything a queue test needs: storage, a controllable clock, and the mock provider's shared state. */
export interface Harness {
  fs: MemoryFs;
  store: MockStore;
  registry: ProviderRegistry;
  /** Current fake time in milliseconds. */
  clock: { ms: number };
  /** Opens (or re-opens, simulating a restart) a queue on the same storage and provider state. */
  open(extra?: Partial<QueueOptions>): Promise<JobQueue>;
}

/**
 * Builds a request for the mock provider.
 * @param capability What to generate.
 * @param prompt Prompt text; also determines the mock's output.
 */
export function request(
  capability: Capability = 'image',
  prompt = 'a harbor at night',
): GenerationRequest {
  return {
    capability,
    provider: { providerId: 'mock' },
    prompt,
    references: [],
    audioInputs: [],
    durationSeconds: 3,
    extras: {},
  };
}

/**
 * Creates a test harness around the mock provider (or a variant of it).
 * @param options.definition Replacement for the registered provider, built from the shared mock store.
 * @param options.budget Project budget handed to every queue.
 * @param options.config Mock configuration, for example `{ pollsUntilDone: 1 }`.
 */
export function createHarness(
  options: {
    definition?: (store: MockStore) => ProviderDefinition;
    budget?: Budget;
    config?: ProviderConfig;
  } = {},
): Harness {
  const fs = new MemoryFs();
  const store = createMockStore();
  const clock = { ms: Date.parse('2026-10-26T10:00:00.000Z') };
  const registry = new ProviderRegistry();
  registry.register(
    options.definition?.(store) ?? {
      manifest: MOCK_MANIFEST,
      create: (config) => createMockProvider({ ...options.config, ...config }, store),
    },
  );
  let seed = 12345;
  return {
    fs,
    store,
    registry,
    clock,
    open: (extra = {}) =>
      JobQueue.open({
        fs,
        registry,
        budget: options.budget,
        now: () => new Date(clock.ms),
        sleep: (ms) => {
          clock.ms += ms;
          return Promise.resolve();
        },
        random: () => {
          seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
          return seed / 2 ** 32;
        },
        pollIntervalMs: 1000,
        ...extra,
      }),
  };
}

/**
 * A provider definition that wraps the mock with a changed manifest and/or behaviour.
 * @param store Shared mock state.
 * @param change Overrides applied on top of the mock provider.
 */
export function variant(
  store: MockStore,
  change: (mock: Provider) => Partial<Provider>,
): ProviderDefinition {
  return {
    manifest: { ...MOCK_MANIFEST, ...change(createMockProvider({}, store)).manifest },
    create: (config) => {
      const mock = createMockProvider(config, store);
      return { ...mock, ...change(mock) };
    },
  };
}
