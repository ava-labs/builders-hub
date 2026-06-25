import { z } from "zod";

export const MAX_GRANT_BUDGET_USD = 10000;
const MAX_URL = 2048, MAX_LONG = 4000;
const trimString = (v: unknown) => (typeof v === "string" ? v.trim() : v);
const requiredText = (label: string, max: number) => z.preprocess(trimString, z.string().min(1, `${label} is required`).max(max, `${label} too long`));
const urlSchema = z.preprocess(trimString, z.string().min(1, "Link is required").max(MAX_URL).url("Must be a valid URL").refine((v) => /^https?:\/\//i.test(v), "URL must start with http(s)://"));
const optionalUrlSchema = z.preprocess((v) => { if (typeof v !== "string") return v; const t = v.trim(); return t === "" ? undefined : t; }, z.string().max(MAX_URL).url("Must be a valid URL").refine((v) => /^https?:\/\//i.test(v), "URL must start with http(s)://").optional());
const optionalText = (label: string, max: number) => z.preprocess((v) => { if (typeof v !== "string") return v; const t = v.trim(); return t === "" ? undefined : t; }, z.string().max(max, `${label} too long`).optional());

export const miniGrantFormSchema = z.object({
  project_url: urlSchema,
  requested_amount_usd: z.number({ message: "Requested amount is required" }).int("Whole dollars only").min(1, "Must be > 0").max(MAX_GRANT_BUDGET_USD, `Cannot exceed $${MAX_GRANT_BUDGET_USD.toLocaleString()}`),
  summary: requiredText("Summary", MAX_LONG),
  milestones: requiredText("Milestones", MAX_LONG),
  why_grant: requiredText("This field", MAX_LONG),
  additional_url: optionalUrlSchema,
  // Contact information — X profile is mandatory (handle or URL), Telegram optional.
  x_profile: requiredText("X profile", 200),
  telegram: optionalText("Telegram", 100),
});
export type MiniGrantFormData = z.infer<typeof miniGrantFormSchema>;
