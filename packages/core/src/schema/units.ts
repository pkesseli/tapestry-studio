import { z } from 'zod';
import { idSchema } from './common';
import { EntityIdSchema, InstrumentRoleSchema } from './entities';

/** One spoken line inside a shot. */
export const DialogueLineSchema = z.strictObject({
  id: idSchema('lin'),
  speakerId: idSchema('chr'),
  /** Voice override; defaults to the speaker's own voice. */
  voiceId: idSchema('voc').optional(),
  text: z.string(),
  parenthetical: z.string().optional(),
});

/** One generated take of a scene: a single clip as far as the provider is concerned. */
export const ShotSchema = z.strictObject({
  id: idSchema('sht'),
  action: z.string(),
  dialogue: z.array(DialogueLineSchema),
  cameraHint: z.string().optional(),
  /** Guidance from `[[direction: ...]]` notes in the script (camera, mood, light); sent to the video model. */
  direction: z.string().optional(),
  /** Target length in seconds; must not exceed the provider's maximum clip length. */
  durationSeconds: z.number().positive(),
  /** Entities to prefer as references for this shot, ahead of the scene's defaults. */
  referenceEntityIds: z.array(EntityIdSchema),
});

/** A film scene: heading, who and what is in it, and its shots. */
export const SceneSchema = z.strictObject({
  id: idSchema('scn'),
  /** Position in the film, starting at 1. */
  number: z.int().positive(),
  heading: z.string(),
  locationId: idSchema('loc').optional(),
  /** All entities present, in addition to the location. */
  entityIds: z.array(EntityIdSchema),
  description: z.string(),
  shots: z.array(ShotSchema),
});

/** Structural role of a song section. */
export const SectionKindSchema = z.enum([
  'intro',
  'verse',
  'pre-chorus',
  'chorus',
  'bridge',
  'solo',
  'outro',
  'other',
]);

/** One line of lyrics, optionally sung by a specific voice. */
export const LyricLineSchema = z.strictObject({
  text: z.string(),
  voiceId: idSchema('voc').optional(),
});

/** What one instrument does inside a section. */
export const ArrangementTrackSchema = z.strictObject({
  instrumentId: idSchema('ins'),
  role: InstrumentRoleSchema,
  /** Natural-language direction such as "sparse, enters on the second bar". */
  direction: z.string(),
  enabled: z.boolean(),
});

/** A part of a song or score: the music counterpart of a scene. */
export const SectionSchema = z.strictObject({
  id: idSchema('sec'),
  /** Position in the piece, starting at 1. */
  number: z.int().positive(),
  name: z.string().min(1),
  kind: SectionKindSchema,
  bars: z.int().positive().optional(),
  seconds: z.number().positive().optional(),
  tempoBpm: z.number().positive().optional(),
  /** Musical key such as "Am". */
  key: z.string().optional(),
  lyrics: z.array(LyricLineSchema),
  tracks: z.array(ArrangementTrackSchema),
  /** When set, this section is the score for that film scene. */
  scoresSceneId: idSchema('scn').optional(),
});

export type DialogueLine = z.infer<typeof DialogueLineSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type SectionKind = z.infer<typeof SectionKindSchema>;
