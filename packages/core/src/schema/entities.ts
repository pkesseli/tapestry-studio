import { z } from 'zod';
import { FileRefSchema, RelativePathSchema, idSchema } from './common';

/** Fields every entity (anything the script can refer to) has. */
const entityBase = {
  /** Display name; also matched against the script. */
  name: z.string().min(1),
  /** Other names the script may use for this entity (nicknames, spellings). */
  aliases: z.array(z.string().min(1)),
  description: z.string(),
  /** All attached reference media. */
  references: z.array(FileRefSchema),
  /** Paths (subset of `references`) of the approved set injected into every generation: the canonical sheet. */
  canonicalSheet: z.array(RelativePathSchema),
  notes: z.string(),
};

/** A named variation of an entity (a costume, a time of day). */
export const VariantSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string(),
  references: z.array(FileRefSchema),
});

/** A person or creature in the story. */
export const CharacterSchema = z.strictObject({
  ...entityBase,
  kind: z.literal('character'),
  id: idSchema('chr'),
  appearance: z.string(),
  wardrobe: z.array(VariantSchema),
  /** Voice used for this character's dialogue and singing. */
  voiceId: idSchema('voc').optional(),
});

/** A place where scenes happen. */
export const LocationSchema = z.strictObject({
  ...entityBase,
  kind: z.literal('location'),
  id: idSchema('loc'),
  mood: z.string(),
  lighting: z.string(),
  timeVariants: z.array(VariantSchema),
});

/** An object that matters visually. */
export const PropSchema = z.strictObject({
  ...entityBase,
  kind: z.literal('prop'),
  id: idSchema('prp'),
});

/** A speaking or singing voice, shared by film dialogue and music vocals. */
export const VoiceSchema = z.strictObject({
  ...entityBase,
  kind: z.literal('voice'),
  id: idSchema('voc'),
  /** BCP-47 language tag such as `en-US`. */
  language: z.string().optional(),
  /** Free-text description of timbre, range and delivery. */
  style: z.string(),
  /** Provider-specific voice identifier, when a hosted voice is used instead of a sample. */
  providerVoice: z
    .strictObject({ providerId: z.string().min(1), voiceId: z.string().min(1) })
    .optional(),
});

/** Role an instrument plays in an arrangement. */
export const InstrumentRoleSchema = z.enum([
  'lead',
  'rhythm',
  'pad',
  'bass',
  'drums',
  'percussion',
  'fx',
  'other',
]);

/** An instrument or sound source used in music and scores. */
export const InstrumentSchema = z.strictObject({
  ...entityBase,
  kind: z.literal('instrument'),
  id: idSchema('ins'),
  /** Instrument family, for example "strings" or "synth". */
  family: z.string(),
  /** Free-text description of the sound. */
  timbre: z.string(),
  role: InstrumentRoleSchema,
});

/** Any entity, discriminated by `kind`. */
export const EntitySchema = z.discriminatedUnion('kind', [
  CharacterSchema,
  LocationSchema,
  PropSchema,
  VoiceSchema,
  InstrumentSchema,
]);

/** Id of any entity: a character, location, prop, voice or instrument. */
export const EntityIdSchema = z.union([
  idSchema('chr'),
  idSchema('loc'),
  idSchema('prp'),
  idSchema('voc'),
  idSchema('ins'),
]);

/** Folder (below `entities/`) that holds each kind of entity. */
export const ENTITY_FOLDERS = {
  character: 'characters',
  location: 'locations',
  prop: 'props',
  voice: 'voices',
  instrument: 'instruments',
} as const;

export type Character = z.infer<typeof CharacterSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type Prop = z.infer<typeof PropSchema>;
export type Voice = z.infer<typeof VoiceSchema>;
export type Instrument = z.infer<typeof InstrumentSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type EntityKind = Entity['kind'];
