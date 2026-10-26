import { z } from 'zod';
import {
  MediaTypeSchema,
  RelativePathSchema,
  Sha256Schema,
  TimestampSchema,
  idSchema,
} from './common';

/** One media file produced by a job, with the hash that proves it has not changed. */
export const ArtifactFileSchema = z.strictObject({
  path: RelativePathSchema,
  mediaType: MediaTypeSchema,
  contentHash: Sha256Schema,
});

/** Everything needed to explain later how an artifact came to be. */
export const ProvenanceSchema = z.strictObject({
  providerId: z.string().min(1),
  model: z.string().min(1),
  modelVersion: z.string().optional(),
  seed: z.int().optional(),
  /** Hash of the complete request, so identical inputs can be recognised. */
  inputsHash: Sha256Schema,
  /** Reference files that were actually sent, after the composer's selection. */
  referencePaths: z.array(RelativePathSchema),
});

/**
 * The result of a job. Once `accepted` is true the files are frozen: nothing may overwrite or regenerate them
 * without an explicit user action (see doc/readme/architecture.md, invariant 2).
 */
export const ArtifactSchema = z.strictObject({
  id: idSchema('art'),
  jobId: idSchema('job'),
  files: z.array(ArtifactFileSchema).min(1),
  accepted: z.boolean(),
  acceptedAt: TimestampSchema.optional(),
  provenance: ProvenanceSchema,
  /** Set on enhanced versions: the accepted artifact this one was derived from. */
  enhancedFromId: idSchema('art').optional(),
  notes: z.string(),
  createdAt: TimestampSchema,
});

export type Artifact = z.infer<typeof ArtifactSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
