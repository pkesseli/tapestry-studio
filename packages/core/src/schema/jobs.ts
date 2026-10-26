import { z } from 'zod';
import {
  CapabilitySchema,
  MediaTypeSchema,
  RelativePathSchema,
  ReferenceRoleSchema,
  TimestampSchema,
  idSchema,
} from './common';

/** Lifecycle state of a job; transitions are enforced by the queue (plan 04), not by this schema. */
export const JobStateSchema = z.enum([
  'draft',
  'approved',
  'queued',
  'running',
  'rendered',
  'accepted',
  'enhanced',
  'redone',
  'failed',
  'cancelled',
]);

/** A reference passed to the provider together with the role it plays. */
export const RequestReferenceSchema = z.strictObject({
  path: RelativePathSchema,
  mediaType: MediaTypeSchema,
  role: ReferenceRoleSchema,
});

/**
 * Provider-neutral description of what to generate. Adapters translate it to a concrete model; anything specific to
 * one provider goes into `extras`, namespaced by provider id, never into the shared fields.
 */
export const GenerationRequestSchema = z.strictObject({
  capability: CapabilitySchema,
  /** Provider (and optionally model) chosen for this job. */
  provider: z.strictObject({ providerId: z.string().min(1), model: z.string().min(1).optional() }),
  prompt: z.string(),
  negativePrompt: z.string().optional(),
  references: z.array(RequestReferenceSchema),
  /** Audio files to condition on (dialogue to lip-sync, a melody to follow). */
  audioInputs: z.array(RelativePathSchema),
  durationSeconds: z.number().positive().optional(),
  seed: z.int().optional(),
  width: z.int().positive().optional(),
  height: z.int().positive().optional(),
  fps: z.number().positive().optional(),
  extras: z.record(z.string(), z.json()),
});

/** Cost and time forecast shown before the user approves a job. */
export const EstimateSchema = z.strictObject({
  /** Expected cost in the project's currency; absent for free local runs. */
  cost: z.number().nonnegative().optional(),
  seconds: z.number().nonnegative().optional(),
  notes: z.string(),
});

/** One recorded state change of a job. */
export const JobHistoryEntrySchema = z.strictObject({
  at: TimestampSchema,
  from: JobStateSchema.optional(),
  to: JobStateSchema,
  actor: z.enum(['user', 'system', 'provider']),
  note: z.string().optional(),
});

/** A unit of generation work, persisted so the queue survives restarts. */
export const JobSchema = z.strictObject({
  id: idSchema('job'),
  state: JobStateSchema,
  request: GenerationRequestSchema,
  /** Shot or section this job produces material for. */
  targetId: z.string().optional(),
  estimate: EstimateSchema.optional(),
  /** Hard spending limit approved for this job. */
  budgetCap: z.number().nonnegative().optional(),
  /** Spend recorded after completion. */
  actualCost: z.number().nonnegative().optional(),
  /** Provider's own job reference, used to resume polling after a restart. */
  remoteRef: z.string().optional(),
  artifactIds: z.array(idSchema('art')),
  history: z.array(JobHistoryEntrySchema),
  error: z.strictObject({ message: z.string(), retryable: z.boolean() }).optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export type JobState = z.infer<typeof JobStateSchema>;
export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;
export type Estimate = z.infer<typeof EstimateSchema>;
export type Job = z.infer<typeof JobSchema>;
export type RequestReference = z.infer<typeof RequestReferenceSchema>;
