import { z } from "zod";

export const researchAreas = [
  "Area 1: Cryptoasset Pricing and Valuation (e.g., theoretical models, monetary policy, pricing implications of staking)",
  "Area 2: Validator Economics and Network Security (e.g., optimal validation levels, economics of staking, validator reward mechanisms)",
  "Interdisciplinary (Addresses both areas or bridges economic theory with protocol design)",
  "Other",
] as const;

export const MAX_BUDGET_USD = 50000;

const MAX_URL_LENGTH = 2048;
const MAX_SHORT_TEXT_LENGTH = 200;
const MAX_LONG_TEXT_LENGTH = 4000;

const trimString = (value: unknown) => (typeof value === "string" ? value.trim() : value);

const requiredText = (label: string, max: number) =>
  z.preprocess(
    trimString,
    z
      .string()
      .min(1, `${label} is required`)
      .max(max, `${label} must be ${max} characters or less`),
  );

const optionalText = (label: string, max: number) =>
  z.preprocess((value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }, z.string().max(max, `${label} must be ${max} characters or less`).optional());

const urlSchema = z.preprocess(
  trimString,
  z
    .string()
    .min(1, "Link is required")
    .max(MAX_URL_LENGTH, `URL must be ${MAX_URL_LENGTH} characters or less`)
    .url("Must be a valid URL (e.g. https://drive.google.com/...)")
    .refine((v) => /^https?:\/\//i.test(v), "URL must start with http:// or https://"),
);

const optionalUrlSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z
  .string()
  .max(MAX_URL_LENGTH, `URL must be ${MAX_URL_LENGTH} characters or less`)
  .url("Must be a valid URL (e.g. https://drive.google.com/...)")
  .refine(
    (v) => /^https?:\/\//i.test(v),
    "URL must start with http:// or https://",
  )
  .optional());

export const formSchema = z
  .object({
    lead_full_name: requiredText("Lead researcher name", 120),
    email: z.preprocess(
      trimString,
      z
        .string()
        .email("Valid email is required")
        .max(320, "Email must be 320 characters or less"),
    ),
    affiliation: requiredText("Affiliation", 160),
    proposal_title: requiredText("Proposal title", MAX_SHORT_TEXT_LENGTH),
    primary_research_area: z.enum(researchAreas, { message: "Select a research area" }),
    primary_research_area_other: optionalText("Research area", 160),
    budget_usd: z
      .number({ message: "Budget is required" })
      .int("Whole dollars only")
      .min(1, "Budget must be greater than 0")
      .max(MAX_BUDGET_USD, `Budget cannot exceed $${MAX_BUDGET_USD.toLocaleString()}`),
    proposal_url: urlSchema,
    lead_cv_url: urlSchema,
    co_investigators: optionalText("Co-investigators", MAX_LONG_TEXT_LENGTH),
    co_investigator_cvs_url: optionalUrlSchema,
    exclusivity_agreement: z
      .boolean()
      .refine((v) => v === true, "Agreement is required for submission"),
  })
  .superRefine((data, ctx) => {
    if (data.primary_research_area === "Other" && !data.primary_research_area_other?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primary_research_area_other"],
        message: "Please describe your research area",
      });
    }
  });

export type ResearchProposalFormData = z.infer<typeof formSchema>;
