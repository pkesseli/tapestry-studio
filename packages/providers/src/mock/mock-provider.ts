import type { Capability, GenerationRequest } from '@tapestry/core';
import { checkRequestLimits } from '../limits';
import { ProviderError } from '../types';
import type {
  PollResult,
  Provider,
  ProviderConfig,
  ProviderDefinition,
  ProviderManifest,
  ProviderOutput,
} from '../types';
import { gradientPng, hashString, placeholderVideo, tonedWav } from './media';

/** Generous-but-finite limits that mimic a real model, so reference budgeting is exercised in tests. */
const MOCK_LIMITS = {
  maxDurationSeconds: 15,
  maxImageReferences: 9,
  maxVideoReferences: 3,
  maxAudioReferences: 3,
  maxTotalReferences: 12,
  maxAudioInputs: 3,
};

/** Every capability, so the mock can stand in for any provider. */
const ALL_CAPABILITIES: Capability[] = [
  'video',
  'image',
  'speech',
  'music',
  'sfx',
  'upscale',
  'refine',
];

/** Manifest of the mock provider. */
export const MOCK_MANIFEST: ProviderManifest = {
  id: 'mock',
  name: 'Mock provider',
  version: '1.0.0',
  capabilities: ALL_CAPABILITIES,
  limits: Object.fromEntries(ALL_CAPABILITIES.map((c) => [c, MOCK_LIMITS])),
  config: {
    pollsUntilDone: {
      label: 'Polls until done',
      type: 'number',
      required: false,
      description: 'How many times a job is polled before it finishes (simulates latency).',
    },
    failure: {
      label: 'Simulated failure',
      type: 'string',
      required: false,
      description: '"transient" or "permanent" makes jobs fail after their second poll.',
    },
  },
  paid: false,
  local: true,
};

/** State of one mock job. */
export interface MockJob {
  /** Idempotency key it was submitted with. */
  key: string;
  request: GenerationRequest;
  /** Number of polls so far. */
  polls: number;
  cancelled: boolean;
  /** Polls needed before the job finishes. */
  pollsUntilDone: number;
  /** How the job ends. */
  outcome: 'success' | 'transient' | 'permanent';
}

/** Where the mock keeps its jobs. Sharing one store between two provider instances simulates an app restart. */
export interface MockStore {
  jobs: Map<string, MockJob>;
}

/** Creates an empty in-memory store. */
export function createMockStore(): MockStore {
  return { jobs: new Map() };
}

/**
 * Creates the mock provider: instant, free, deterministic placeholder media of the right kind for every capability.
 * The same request always yields the same output, so tests are repeatable.
 * @param config Optional `pollsUntilDone` (default 2) and `failure` (`transient` or `permanent`).
 * @param store State holder; pass the same store to a second instance to simulate restarting the app.
 */
export function createMockProvider(
  config: ProviderConfig = {},
  store: MockStore = createMockStore(),
): Provider {
  const pollsUntilDone =
    typeof config['pollsUntilDone'] === 'number' ? config['pollsUntilDone'] : 2;
  const failure = config['failure'];
  const outcome = failure === 'transient' || failure === 'permanent' ? failure : 'success';
  return {
    manifest: MOCK_MANIFEST,
    estimate(request) {
      const reason = checkRequestLimits(request, MOCK_MANIFEST);
      if (reason) return { ok: false, reason };
      return {
        ok: true,
        estimate: { cost: 0, seconds: pollsUntilDone, notes: 'Mock provider: placeholder media' },
      };
    },
    submit(request, context) {
      const ref = `mock-${hashString(context.idempotencyKey).toString(16).padStart(8, '0')}`;
      if (store.jobs.has(ref)) return Promise.resolve(ref);
      const reason = checkRequestLimits(request, MOCK_MANIFEST);
      if (reason) return Promise.reject(new ProviderError(reason, false));
      store.jobs.set(ref, {
        key: context.idempotencyKey,
        request,
        polls: 0,
        cancelled: false,
        pollsUntilDone,
        outcome,
      });
      return Promise.resolve(ref);
    },
    poll(ref) {
      const job = store.jobs.get(ref);
      if (!job) return Promise.reject(new ProviderError(`Unknown mock job ${ref}`, false));
      return Promise.resolve(advance(job));
    },
    cancel(ref) {
      const job = store.jobs.get(ref);
      if (job && job.polls < job.pollsUntilDone) job.cancelled = true;
      return Promise.resolve();
    },
  };
}

/**
 * Moves a job one poll forward and reports its status.
 * @param job The job to advance.
 */
function advance(job: MockJob): PollResult {
  if (job.cancelled) return { status: 'cancelled' };
  job.polls++;
  if (job.outcome !== 'success' && job.polls >= 2) {
    const retryable = job.outcome === 'transient';
    return { status: 'failed', error: { message: `Simulated ${job.outcome} failure`, retryable } };
  }
  if (job.polls < job.pollsUntilDone) {
    return { status: 'running', progress: job.polls / job.pollsUntilDone };
  }
  const seed = job.request.seed ?? hashString(job.request.prompt);
  return {
    status: 'succeeded',
    outputs: [render(job.request, seed)],
    info: { model: `mock-${job.request.capability}`, modelVersion: '1', seed },
    actualCost: 0,
  };
}

/**
 * Produces the placeholder file for a request.
 * @param request What was asked for.
 * @param seed Seed that determines colours and tones.
 */
function render(request: GenerationRequest, seed: number): ProviderOutput {
  switch (request.capability) {
    case 'image':
      return { mediaType: 'image', fileName: 'image.png', bytes: gradientPng(seed) };
    case 'speech':
    case 'music':
    case 'sfx': {
      const seconds = Math.min(request.durationSeconds ?? 2, 4);
      return { mediaType: 'audio', fileName: 'audio.wav', bytes: tonedWav(seed, seconds) };
    }
    default:
      return { mediaType: 'video', fileName: 'clip.mp4', bytes: placeholderVideo() };
  }
}

/** The mock provider as a registrable definition. */
export const mockProviderDefinition: ProviderDefinition = {
  manifest: MOCK_MANIFEST,
  create: (config) => createMockProvider(config),
};
