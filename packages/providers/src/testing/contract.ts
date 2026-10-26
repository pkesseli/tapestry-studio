import type { Capability, GenerationRequest } from '@tapestry/core';
import { describe, expect, test } from 'vitest';
import { OUTPUT_MEDIA, ProviderError, ProviderManifestSchema } from '../types';
import type { PollResult, Provider } from '../types';

/** What the contract suite needs from the adapter under test. */
export interface ContractFixture {
  /** Creates a provider with fresh state. */
  create(): Provider;
  /** Creates a provider that needs several polls before finishing, so jobs can be cancelled in flight. */
  createSlow(): Provider;
  /** Creates a new instance that sees the jobs of `previous`, simulating an app restart. */
  restart(previous: Provider): Provider;
  /** Creates a provider whose jobs fail, retryably or not. Optional for adapters that cannot simulate failures. */
  createFailing?(retryable: boolean): Provider;
  /** Builds a request that the provider accepts for the capability. */
  request(capability: Capability): GenerationRequest;
  /** Builds a request that exceeds one of the provider's declared limits. */
  overLimitRequest(): GenerationRequest;
}

/** One named rule every adapter must satisfy. Throws (via `expect`) when the adapter breaks it. */
export interface ContractCheck {
  name: string;
  /** Only run when the fixture offers what the check needs. */
  applies?(fixture: ContractFixture): boolean;
  run(fixture: ContractFixture): Promise<void>;
}

/** A project file reader returning empty bytes, enough for providers that do not look at references. */
const readFile = (): Promise<Uint8Array> => Promise.resolve(new Uint8Array());

/**
 * Polls until a job reaches a final status, with a generous bound.
 * @param provider Provider that owns the job.
 * @param ref Job reference.
 */
async function settle(provider: Provider, ref: string): Promise<PollResult> {
  for (let i = 0; i < 50; i++) {
    const result = await provider.poll(ref);
    if (result.status !== 'pending' && result.status !== 'running') return result;
  }
  throw new Error('Job never finished');
}

/**
 * Captures the error a promise rejects with.
 * @param promise Promise expected to reject.
 */
const rejection = (promise: Promise<unknown>): Promise<unknown> =>
  promise.then(
    () => undefined,
    (error: unknown) => error,
  );

/** The rules (see doc/readme/providers.md, "Rules for adding a provider"). */
export const CONTRACT_CHECKS: readonly ContractCheck[] = [
  {
    name: 'has a valid manifest',
    run: async (f) => {
      expect(ProviderManifestSchema.safeParse(f.create().manifest).success).toBe(true);
    },
  },
  {
    name: 'estimates every capability it declares',
    run: async (f) => {
      const provider = f.create();
      for (const capability of provider.manifest.capabilities) {
        const result = provider.estimate(f.request(capability));
        expect(result.ok, `${capability}: ${result.ok ? '' : result.reason}`).toBe(true);
      }
    },
  },
  {
    name: 'rejects requests over its limits with a reason, before any submission',
    run: async (f) => {
      const result = f.create().estimate(f.overLimitRequest());
      expect(result.ok).toBe(false);
      expect(result.ok ? '' : result.reason.length).toBeGreaterThan(0);
    },
  },
  {
    name: 'refuses to submit a request over its limits (permanent error)',
    run: async (f) => {
      const error = await rejection(
        f.create().submit(f.overLimitRequest(), { idempotencyKey: 'k', readFile }),
      );
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).retryable).toBe(false);
    },
  },
  {
    name: 'produces output of the right media type for every capability',
    run: async (f) => {
      const provider = f.create();
      for (const capability of provider.manifest.capabilities) {
        const ref = await provider.submit(f.request(capability), {
          idempotencyKey: capability,
          readFile,
        });
        const result = await settle(provider, ref);
        expect(result.status, capability).toBe('succeeded');
        if (result.status !== 'succeeded') continue;
        expect(result.outputs.length).toBeGreaterThan(0);
        const expected = OUTPUT_MEDIA[capability];
        for (const output of result.outputs) {
          expect(output.bytes.length).toBeGreaterThan(0);
          if (expected !== 'same-as-input') expect(output.mediaType).toBe(expected);
        }
      }
    },
  },
  {
    name: 'submitting twice with the same idempotency key does not duplicate work',
    run: async (f) => {
      const provider = f.create();
      const request = f.request('image');
      const first = await provider.submit(request, { idempotencyKey: 'same', readFile });
      const second = await provider.submit(request, { idempotencyKey: 'same', readFile });
      expect(second).toBe(first);
    },
  },
  {
    name: 'jobs can be polled after a restart',
    run: async (f) => {
      const before = f.create();
      const ref = await before.submit(f.request('image'), { idempotencyKey: 'resume', readFile });
      expect((await settle(f.restart(before), ref)).status).toBe('succeeded');
    },
  },
  {
    name: 'cancelling a running job ends it as cancelled',
    run: async (f) => {
      const provider = f.createSlow();
      const ref = await provider.submit(f.request('video'), { idempotencyKey: 'cancel', readFile });
      await provider.cancel(ref);
      expect((await provider.poll(ref)).status).toBe('cancelled');
    },
  },
  {
    name: 'reports unknown job references as a permanent error',
    run: async (f) => {
      const error = await rejection(f.create().poll('no-such-job'));
      expect(error).toBeInstanceOf(ProviderError);
      expect((error as ProviderError).retryable).toBe(false);
    },
  },
  {
    name: 'maps failures to retryable and permanent',
    applies: (f) => f.createFailing !== undefined,
    run: async (f) => {
      for (const retryable of [true, false]) {
        const provider = f.createFailing?.(retryable);
        if (!provider) return;
        const ref = await provider.submit(f.request('image'), {
          idempotencyKey: `fail-${retryable}`,
          readFile,
        });
        const result = await settle(provider, ref);
        expect(result.status).toBe('failed');
        if (result.status === 'failed') expect(result.error.retryable).toBe(retryable);
      }
    },
  },
];

/**
 * Registers the shared contract tests for a provider adapter. Every adapter must pass them.
 * @param name Display name of the adapter.
 * @param fixture How to create and drive the adapter.
 */
export function describeProviderContract(name: string, fixture: ContractFixture): void {
  describe(`provider contract: ${name}`, () => {
    for (const check of CONTRACT_CHECKS) {
      test.skipIf(check.applies?.(fixture) === false)(check.name, () => check.run(fixture));
    }
  });
}
