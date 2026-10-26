import { z } from 'zod';
import { idSchema } from './common';

/** A piece of an artifact placed on a track. */
export const ClipSchema = z.strictObject({
  id: idSchema('clp'),
  /** Must reference an accepted artifact (checked by `validateProject`). */
  artifactId: idSchema('art'),
  /** Where the clip starts on the timeline. */
  startSeconds: z.number().nonnegative(),
  /** Trim: first and last second of the source that are used. */
  inSeconds: z.number().nonnegative(),
  outSeconds: z.number().positive(),
  volume: z.number().min(0).max(4),
  fadeInSeconds: z.number().nonnegative(),
  fadeOutSeconds: z.number().nonnegative(),
});

/** Kind of material a track carries. */
export const TrackKindSchema = z.enum(['video', 'dialogue', 'music', 'sfx']);

/** A lane of clips. */
export const TrackSchema = z.strictObject({
  id: idSchema('trk'),
  kind: TrackKindSchema,
  name: z.string(),
  clips: z.array(ClipSchema),
});

/** An arrangement of accepted clips into a finished film or piece of music. */
export const TimelineSchema = z.strictObject({
  id: idSchema('tln'),
  name: z.string().min(1),
  fps: z.number().positive(),
  tracks: z.array(TrackSchema),
});

export type Clip = z.infer<typeof ClipSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;
