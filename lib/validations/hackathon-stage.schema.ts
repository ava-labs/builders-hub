import { z } from 'zod';
import { SubmitFormFieldType } from '@/types/hackathon-stage';

/**
 * Zod schema for `HackathonStage` and its nested types.
 *
 * SECURITY: This schema is the single source of truth for validating stage
 * data before it is written to the database.  It strictly mirrors the
 * TypeScript types in `types/hackathon-stage.ts` and uses `.strip()` (the
 * Zod default for objects) to silently drop any unknown keys, preventing
 * schema-injection attacks where a caller supplies extra fields that could
 * propagate through the JSON column into unintended behaviour.
 *
 * Validation is applied in `server/services/hackathons.ts` inside both
 * `createHackathon` and `updateHackathon` before the Prisma call.
 *
 * NOTE: The `type` discriminator on each field schema uses
 * `z.literal(SubmitFormFieldType.X)` (enum member) rather than
 * `z.literal('x')` (plain string) so that Zod's inferred output type matches
 * the TypeScript enum type exactly and avoids assignability errors.
 */

// ---------------------------------------------------------------------------
// CardComponent
// ---------------------------------------------------------------------------
const cardItemSchema = z.object({
  icon: z.string(),
  title: z.string(),
  description: z.string(),
});

const cardComponentSchema = z.object({
  type: z.literal('cards'),
  cards: z.array(cardItemSchema),
});

// ---------------------------------------------------------------------------
// TagsComponent
// ---------------------------------------------------------------------------
const tagItemSchema = z.object({
  icon: z.string(),
  title: z.string(),
  description: z.string(),
});

const tagsComponentSchema = z.object({
  type: z.literal('tags'),
  title: z.string(),
  description: z.string(),
  tags: z.array(tagItemSchema),
});

// ---------------------------------------------------------------------------
// StageComponent discriminated union
// ---------------------------------------------------------------------------
const stageComponentSchema = z.discriminatedUnion('type', [
  cardComponentSchema,
  tagsComponentSchema,
]);

// ---------------------------------------------------------------------------
// SubmitFormField variants
// ---------------------------------------------------------------------------
const textFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.Text),
  label: z.string().min(1),
  placeholder: z.string(),
  description: z.string(),
  required: z.boolean(),
  maxCharacters: z.number().nullable(),
  predefinedField: z.boolean().optional(),
});

const linkFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.Link),
  label: z.string().min(1),
  placeholder: z.string(),
  description: z.string(),
  maxLinks: z.number().optional(),
  required: z.boolean(),
  predefinedField: z.boolean().optional(),
});

const chipsFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.Chips),
  label: z.string().min(1),
  description: z.string(),
  required: z.boolean(),
  chips: z.array(z.string()),
  predefinedField: z.boolean().optional(),
});

const multiSelectFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.MultiSelect),
  label: z.string().min(1),
  description: z.string().nullable().optional(),
  placeholder: z.string(),
  required: z.boolean(),
  options: z.array(z.string()),
  maxSelections: z.number().nullable().optional(),
  predefinedField: z.boolean().optional(),
});

const booleanFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.Boolean),
  label: z.string().min(1),
  description: z.string(),
  required: z.boolean(),
  predefinedField: z.boolean().optional(),
});

const imageFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal(SubmitFormFieldType.Image),
  label: z.string().min(1),
  description: z.string(),
  required: z.boolean(),
  maxImages: z.number().optional(),
  maxSizeMb: z.number().optional(),
  predefinedField: z.boolean().optional(),
});

const submitFormFieldSchema = z.discriminatedUnion('type', [
  textFieldSchema,
  linkFieldSchema,
  chipsFieldSchema,
  multiSelectFieldSchema,
  booleanFieldSchema,
  imageFieldSchema,
]);

// ---------------------------------------------------------------------------
// StageSubmitForm
// ---------------------------------------------------------------------------
const stageSubmitFormSchema = z.object({
  fields: z.array(submitFormFieldSchema),
});

// ---------------------------------------------------------------------------
// YYYY-MM-DD date string
// ---------------------------------------------------------------------------
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date in YYYY-MM-DD format');

// ---------------------------------------------------------------------------
// HackathonStage
// ---------------------------------------------------------------------------
export const hackathonStageSchema = z.object({
  /** Non-empty human-readable label (max 100 chars). */
  label: z.string().min(1).max(100),
  /** Stage start date in YYYY-MM-DD format. */
  date: dateStringSchema,
  /** Submission deadline in YYYY-MM-DD format. */
  deadline: dateStringSchema,
  component: stageComponentSchema.optional(),
  submitForm: stageSubmitFormSchema.optional(),
  formLocked: z.boolean().optional(),
});

export type HackathonStageInput = z.infer<typeof hackathonStageSchema>;

/** Validates an array of stages; returns a Zod SafeParseReturnType. */
export const hackathonStagesArraySchema = z.array(hackathonStageSchema);
