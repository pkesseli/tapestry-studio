import { z } from 'zod';
import { CapabilitySchema, RelativePathSchema } from '@tapestry/core';
import type { Capability, Estimate, GenerationRequest, MediaType } from '@tapestry/core';

/** What one provider can do for one capability. Every field is optional: absent means "no known limit". */
export const ProviderLimitsSchema = z.strictObject({
  maxDurationSeconds: z.number().positive().optional(),
  maxImageReferences: z.int().nonnegative().optional(),
  maxVideoReferences: z.int().nonnegative().optional(),
  maxAudioReferences: z.int().nonnegative().optional(),
  /** Cap on references of all media types together. */
  maxTotalReferences: z.int().nonnegative().optional(),
  /** Cap on audio conditioning inputs (`audioInputs`). */
  maxAudioInputs: z.int().nonnegative().optional(),
});

/** One setting a provider needs, rendered as a field in the settings screen. */
export const ConfigFieldSchema = z.strictObject({
  label: z.string().min(1),
  /** `secret` values are stored in the OS keychain, never in the project folder. */
  type: z.enum(['string', 'secret', 'number', 'boolean', 'url']),
  required: z.boolean(),
  description: z.string().optional(),
});

/** Static description of a provider; shown to the user before first use and read by the composer and queue. */
export const ProviderManifestSchema = z.strictObject({
  /** Lower-case identifier, stable across versions. */
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  name: z.string().min(1),
  version: z.string().min(1),
  capabilities: z.array(CapabilitySchema).min(1),
  limits: z.partialRecord(CapabilitySchema, ProviderLimitsSchema),
  config: z.record(z.string(), ConfigFieldSchema),
  /** True when a job can cost money; the queue then requires a budget cap before submitting. */
  paid: z.boolean(),
  /** True when generation runs on the user's own machine. */
  local: z.boolean(),
  /** Link to the terms or model license shown before first use. */
  termsUrl: z.url().optional(),
  pricingHint: z.string().optional(),
});

/** The `plugin.json` of a user-installed provider: a manifest plus the JavaScript module that implements it. */
export const PluginManifestSchema = ProviderManifestSchema.extend({ entry: RelativePathSchema });

export type ProviderLimits = z.infer<typeof ProviderLimitsSchema>;
export type ConfigField = z.infer<typeof ConfigFieldSchema>;
export type ProviderManifest = z.infer<typeof ProviderManifestSchema>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/** User-provided values for a provider's config fields, by field name. Secrets are resolved by the app. */
export type ProviderConfig = Record<string, string | number | boolean>;

/** A file produced by a provider, not yet stored in the project. */
export interface ProviderOutput {
  mediaType: MediaType;
  /** Suggested file name including extension, for example `clip.mp4`. */
  fileName: string;
  bytes: Uint8Array;
}

/** What the provider reports about the model that produced the result, recorded as provenance. */
export interface ModelInfo {
  model: string;
  modelVersion?: string;
  seed?: number;
}

/** Outcome of asking a provider about a submitted job. `succeeded`, `failed` and `cancelled` are final. */
export type PollResult =
  | { status: 'pending' | 'running'; progress?: number }
  | { status: 'succeeded'; outputs: ProviderOutput[]; info: ModelInfo; actualCost?: number }
  | { status: 'failed'; error: { message: string; retryable: boolean } }
  | { status: 'cancelled' };

/** Result of {@link Provider.estimate}: either a forecast or the reason the request cannot run. */
export type EstimateResult = { ok: true; estimate: Estimate } | { ok: false; reason: string };

/** Per-call information the queue gives a provider when submitting. */
export interface SubmitContext {
  /**
   * Stable key (the job id). Submitting twice with the same key must not start the work twice; it returns the same
   * remote reference. This makes retries after crashes or network errors safe.
   */
  idempotencyKey: string;
  /**
   * Reads a project file such as a reference image.
   * @param path Project-relative path.
   */
  readFile(path: string): Promise<Uint8Array>;
}

/** Error raised by providers; `retryable` tells the queue whether trying again can help. */
export class ProviderError extends Error {
  /**
   * @param message Plain-language explanation shown to the user.
   * @param retryable True for transient problems (network, rate limit, busy server).
   */
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

/** A generator the queue can submit work to. Implementations must pass the shared contract tests. */
export interface Provider {
  readonly manifest: ProviderManifest;
  /**
   * Forecasts cost and time, or explains why the request cannot run. Pure: no network access, no side effects.
   * @param request What the user wants generated.
   */
  estimate(request: GenerationRequest): EstimateResult;
  /**
   * Starts a job.
   * @param request What to generate.
   * @param context Idempotency key and file access.
   * @returns A reference that identifies the job at the provider; the queue persists it to resume polling later.
   * @throws {ProviderError} When the request is rejected or the provider is unavailable.
   */
  submit(request: GenerationRequest, context: SubmitContext): Promise<string>;
  /**
   * Checks on a job. Must work with a reference from an earlier run of the app.
   * @param ref Reference returned by {@link Provider.submit}.
   * @throws {ProviderError} When the reference is unknown.
   */
  poll(ref: string): Promise<PollResult>;
  /**
   * Asks the provider to stop a job. Does nothing for finished jobs.
   * @param ref Reference returned by {@link Provider.submit}.
   */
  cancel(ref: string): Promise<void>;
}

/** A provider that can be instantiated with user configuration. */
export interface ProviderDefinition {
  manifest: ProviderManifest;
  /**
   * Creates a provider instance.
   * @param config Values for the manifest's config fields.
   */
  create(config: ProviderConfig): Provider;
}

/** Capability to the media type its output normally has; `upscale` and `refine` depend on their input. */
export const OUTPUT_MEDIA: Record<Capability, MediaType | 'same-as-input'> = {
  image: 'image',
  video: 'video',
  speech: 'audio',
  music: 'audio',
  sfx: 'audio',
  upscale: 'same-as-input',
  refine: 'same-as-input',
};
