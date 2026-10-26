import { z } from 'zod';
import { CapabilitySchema, TimestampSchema, idSchema } from './common';

/** Spending limits, enforced by the queue (never by individual provider adapters). */
export const BudgetSchema = z.strictObject({
  /** ISO 4217 currency code, for example "USD". */
  currency: z.string().length(3),
  projectCap: z.number().nonnegative(),
  perApprovalCap: z.number().nonnegative(),
});

/** Project-wide settings. */
export const SettingsSchema = z.strictObject({
  /** Width:height such as "16:9". */
  aspectRatio: z.string().regex(/^\d+:\d+$/),
  fps: z.number().positive(),
  /** Hides advanced controls (provider details, seeds, raw prompts). */
  simpleMode: z.boolean(),
  /** Preferred provider per capability. */
  defaultProviders: z.partialRecord(CapabilitySchema, z.string().min(1)),
});

/** Contents of `project.json`. */
export const ProjectSchema = z.strictObject({
  schemaVersion: z.int().positive(),
  id: idSchema('prj'),
  name: z.string().min(1),
  createdAt: TimestampSchema,
  settings: SettingsSchema,
  budget: BudgetSchema.optional(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Budget = z.infer<typeof BudgetSchema>;
