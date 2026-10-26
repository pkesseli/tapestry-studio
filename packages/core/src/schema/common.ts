import { z } from 'zod';
import { idPattern } from '../ids';
import type { Id, IdPrefix } from '../ids';

/** Version of the on-disk project format. Bump it together with a migration in `migrations.ts`. */
export const SCHEMA_VERSION = 1;

/**
 * Schema for an id of one kind (see {@link IdPrefix}).
 * @param prefix Kind prefix the id must carry.
 */
export function idSchema<P extends IdPrefix>(prefix: P) {
  const pattern = idPattern(prefix);
  return z.custom<Id<P>>((value) => typeof value === 'string' && pattern.test(value), {
    message: `Expected an id starting with "${prefix}_" followed by 26 characters`,
  });
}

/** ISO-8601 UTC timestamp such as `2026-10-26T09:30:00.000Z`. */
export const TimestampSchema = z.iso.datetime();

/** Project-relative file path: forward slashes only, not absolute, no `..` segments. */
export const RelativePathSchema = z
  .string()
  .min(1)
  .refine((path) => !path.startsWith('/') && !path.includes('\\') && !/^[A-Za-z]:/.test(path), {
    message: 'Must be a project-relative path using forward slashes',
  })
  .refine((path) => !path.split('/').includes('..'), { message: 'Must not contain ".."' });

/** Kinds of media the studio handles. */
export const MediaTypeSchema = z.enum(['image', 'video', 'audio']);

/** What a reference file shows or sounds like; providers and the composer use it to pick references. */
export const ReferenceRoleSchema = z.enum([
  'face',
  'body',
  'outfit',
  'mood',
  'place',
  'prop',
  'style',
  'voice-sample',
  'instrument-sample',
  'other',
]);

/** A media file attached to an entity, stored inside the project folder. */
export const FileRefSchema = z.strictObject({
  path: RelativePathSchema,
  mediaType: MediaTypeSchema,
  role: ReferenceRoleSchema,
  note: z.string().optional(),
});

/** Capabilities a provider can offer; one queue serves all of them. */
export const CapabilitySchema = z.enum([
  'video',
  'image',
  'speech',
  'music',
  'sfx',
  'upscale',
  'refine',
]);

/** SHA-256 digest as 64 lowercase hex characters. */
export const Sha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/, 'Expected a lowercase hex SHA-256 digest');

export type FileRef = z.infer<typeof FileRefSchema>;
export type MediaType = z.infer<typeof MediaTypeSchema>;
export type Capability = z.infer<typeof CapabilitySchema>;
