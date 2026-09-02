import { z } from "zod";
import { emailSchema } from "@/lib/email";
import {
  DEPLOYMENT_TARGETS,
  SUBSIDY_DECISION_STATES,
  URGENCY_OPTIONS,
} from "@/lib/audits/status";
import {
  AUDIT_FRAMEWORKS,
  AUDIT_LANGUAGES,
  AUDIT_PROJECT_TYPES,
  AUDIT_SERVICES,
  MAX_QUOTE_WEEKS,
} from "@/lib/audits/constants";
import { SUBSIDY_MAX_PCT } from "@/lib/audits/subsidy";

const MAX_NAME = 200;
const MAX_URL = 2048;
const MAX_LONG = 4000;
export const MAX_ATTACHMENT_BYTES = 128 * 1024 * 1024; // 128MB, Areta parity

const trimmed = (max: number) => z.string().trim().max(max);
// Normalize before validating so " A@B.com " both passes and stores lowercased.
// 254 is the RFC mailbox ceiling; anything longer is a row SendGrid would reject.
const normalizedEmail = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
  emailSchema.max(254, "Email is too long"),
);
/**
 * People type "avax.network", not "https://avax.network", and making them
 * type the scheme is pure friction. A value that already carries one is left
 * exactly as written, so http:// stays http://; a half-typed scheme is
 * repaired rather than doubled ("https:/x" becomes https://x, not
 * https://https:/x).
 */
export const normalizeUrlInput = (value: unknown) => {
  if (typeof value !== "string") return value;
  const raw = value.trim();
  if (raw === "" || /:\/\//.test(raw)) return raw;
  const bare = raw.replace(/^(https?:)?\/*/i, "");
  return bare === "" ? raw : `https://${bare}`;
};

const httpsUrl = z.preprocess(
  normalizeUrlInput,
  trimmed(MAX_URL)
    .min(1, "Link is required")
    .refine((v) => /^https?:\/\//i.test(v), "URL must start with http(s)://"),
);
// z.coerce.date() would coerce null to 1970-01-01 (a valid Date), silently
// passing a missing required date. Map nullish to undefined so it fails as
// "required" instead.
const requiredDate = (message: string) =>
  z.preprocess((v) => v ?? undefined, z.coerce.date({ message }));

const repoDraftSchema = z.strictObject({
  url: trimmed(MAX_URL),
  ref: trimmed(MAX_NAME).optional().default(""),
});

const attachmentSchema = z.strictObject({
  name: trimmed(300).min(1),
  url: trimmed(MAX_URL).min(1),
  size: z.number().int().min(0).max(MAX_ATTACHMENT_BYTES),
});
export type AuditAttachment = z.infer<typeof attachmentSchema>;

/**
 * Autosave payload for a draft. Deliberately permissive: length caps, correct
 * types and chip membership only, NO format validation, so a half-typed URL
 * or email can never fail an autosave. `auditSubmitSchema` is the single
 * completeness gate. strictObject so a payload can never smuggle status,
 * user_id or any other column through the PATCH.
 */
export const auditDraftSchema = z.strictObject({
  source_project_id: trimmed(MAX_NAME).nullable().optional(),
  project_name: trimmed(MAX_NAME).optional(),
  website: trimmed(MAX_URL).optional(),
  description: trimmed(MAX_LONG).optional(),
  scope: trimmed(MAX_LONG).optional(),
  project_types: z.array(z.enum(AUDIT_PROJECT_TYPES)).max(AUDIT_PROJECT_TYPES.length).optional(),
  deployment_target: z.enum(DEPLOYMENT_TARGETS).or(z.literal("")).optional(),
  multichain: z.boolean().optional(),
  services: z.array(z.enum(AUDIT_SERVICES)).max(AUDIT_SERVICES.length).optional(),
  repos: z.array(repoDraftSchema).max(20).optional(),
  languages: z.array(z.enum(AUDIT_LANGUAGES)).max(AUDIT_LANGUAGES.length).optional(),
  frameworks: z.array(z.enum(AUDIT_FRAMEWORKS)).max(AUDIT_FRAMEWORKS.length).optional(),
  nsloc: z.number().int().min(0).max(100_000_000).nullable().optional(),
  doc_links: z.array(trimmed(MAX_URL)).max(20).optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
  needed_by: z.coerce.date().nullable().optional(),
  quote_deadline: z.coerce.date().nullable().optional(),
  urgency: z.enum(URGENCY_OPTIONS).nullable().optional(),
  contact_name: trimmed(MAX_NAME).optional(),
  contact_email: trimmed(320).optional(),
  contact_handle: trimmed(100).nullable().optional(),
  contact_calendar_url: trimmed(MAX_URL).nullable().optional(),
});
export type AuditDraftInput = z.infer<typeof auditDraftSchema>;

/**
 * The completeness gate, re-validated server-side against the stored row
 * inside the submit transaction (never trusting the client). Unknown row
 * columns are stripped, listed ones must hold. quote_deadline may be absent:
 * submission defaults it to +10 days.
 */
export const auditSubmitSchema = z.object({
  project_name: trimmed(MAX_NAME).min(1, "Project name is required"),
  website: httpsUrl,
  description: trimmed(MAX_LONG).min(10, "Description needs at least 10 characters"),
  scope: trimmed(MAX_LONG).min(10, "Scope needs at least 10 characters"),
  deployment_target: z.enum(DEPLOYMENT_TARGETS, { message: "Pick a deployment target" }),
  services: z.array(z.enum(AUDIT_SERVICES)).min(1, "Pick at least one service"),
  repos: z
    .array(z.object({ url: httpsUrl, ref: trimmed(MAX_NAME).optional().default("") }))
    .max(20)
    .optional()
    .default([]),
  doc_links: z.array(httpsUrl).max(20).optional().default([]),
  needed_by: requiredDate("Pick the latest completion date"),
  quote_deadline: z.coerce.date().nullable().optional(),
  contact_name: trimmed(MAX_NAME).min(1, "Contact name is required"),
  contact_email: normalizedEmail,
  contact_calendar_url: httpsUrl.nullable().optional().or(z.literal("").transform(() => null)),
});
export type AuditSubmitData = z.infer<typeof auditSubmitSchema>;

export const auditQuoteSchema = z.strictObject({
  price_usd: z.number().int().min(1, "Price is required").max(100_000_000),
  duration_weeks: z.number().int().min(1).max(MAX_QUOTE_WEEKS),
  earliest_start: requiredDate("Pick the earliest start date"),
  message: trimmed(MAX_LONG).min(1, "A message to the project is required"),
  // The firm's own proposal, scoping doc or SOW. Optional, and normalized so
  // a pasted "docs.google.com/..." still resolves.
  deal_doc_url: httpsUrl.nullable().optional().or(z.literal("").transform(() => null)),
});
export type AuditQuoteInput = z.infer<typeof auditQuoteSchema>;

/**
 * Submission carries the consent explicitly rather than reading a stored
 * flag: consent is given at the moment of sending, so it is re-affirmed on
 * every submit and the server stamps the time itself.
 */
export const submitRequestSchema = z.strictObject({
  contact_consent: z.literal(true, {
    message: "Confirm that your contact details can be shared with the audit firms",
  }),
});

export const acceptQuoteSchema = z.strictObject({
  quoteId: z.string().min(1),
});

// Amount-based (Federico 2026-07-30): admins think in dollar figures like
// $2,500, so the exact program amount is what travels; the 75%-of-price cap
// is enforced in the service where the accepted price is known.
export const subsidyDecisionSchema = z.strictObject({
  state: z.enum(SUBSIDY_DECISION_STATES),
  program_amount_usd: z.number().int().min(0),
  note: trimmed(2000).optional(),
});
export type SubsidyDecisionInput = z.infer<typeof subsidyDecisionSchema>;

// The gate that keeps the whitelist from being spammed: an admin approves a
// submission before any firm hears about it. The reason is admin-side trail
// context on a rejection, never shown to the project.
export const requestReviewSchema = z.strictObject({
  decision: z.enum(["approve", "reject"]),
  reason: trimmed(2000).optional(),
});
export type RequestReviewInput = z.infer<typeof requestReviewSchema>;

export const auditorCreateSchema = z.strictObject({
  firm_name: trimmed(MAX_NAME).min(1, "Firm name is required"),
  quote_email: normalizedEmail,
  services: z.array(z.enum(AUDIT_SERVICES)).max(AUDIT_SERVICES.length).optional().default([]),
  attio_ref: trimmed(MAX_NAME).optional(),
});
export type AuditorCreateInput = z.infer<typeof auditorCreateSchema>;

export const auditorUpdateSchema = z.strictObject({
  firm_name: trimmed(MAX_NAME).min(1).optional(),
  services: z.array(z.enum(AUDIT_SERVICES)).max(AUDIT_SERVICES.length).optional(),
  active: z.boolean().optional(),
});
export type AuditorUpdateInput = z.infer<typeof auditorUpdateSchema>;

export const auditorMemberCreateSchema = z.strictObject({
  email: normalizedEmail,
});
export type AuditorMemberCreateInput = z.infer<typeof auditorMemberCreateSchema>;

export const adminRequestFiltersSchema = z.object({
  // Must track DISPLAY_REQUEST_STATUSES: a value missing here fails
  // validation and the filter silently does nothing.
  status: z
    .enum([
      "draft",
      "pending_review",
      "rejected",
      "collecting",
      "deciding",
      "engaged",
      "expired",
      "withdrawn",
    ])
    .optional(),
  subsidy: z.enum(["none", "approved", "declined"]).optional(),
  deadline_before: z.coerce.date().optional(),
  deadline_after: z.coerce.date().optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});
export type AdminRequestFilters = z.infer<typeof adminRequestFiltersSchema>;
