import type { DeploymentTarget, UrgencyOption } from "@/lib/audits/status";
import type { AuditAttachment, AuditDraftInput } from "@/types/audits";
import { QUOTE_DEADLINE_DEFAULT_DAYS } from "@/lib/audits/constants";
import { parseWholeNumber } from "@/components/audits/shared/format";

export const WIZARD_STEPS = ["Project", "Scope", "Timeline", "Review"] as const;

export interface AuditWizardValues {
  source_project_id: string | null;
  project_name: string;
  website: string;
  description: string;
  scope: string;
  project_types: string[];
  deployment_target: "" | DeploymentTarget;
  multichain: boolean;
  services: string[];
  repos: { url: string; ref: string }[];
  languages: string[];
  frameworks: string[];
  nsloc: string;
  doc_links: string[];
  attachments: AuditAttachment[];
  needed_by: Date | null;
  quote_deadline: Date | null;
  urgency: "" | UrgencyOption;
  contact_name: string;
  contact_email: string;
  contact_handle: string;
  contact_calendar_url: string;
}

// Which fields each step must pass (against auditSubmitSchema) before
// Continue; the rest of the payload is optional by design.
export const STEP_FIELDS: Record<number, (keyof AuditWizardValues)[]> = {
  0: ["project_name", "website", "description", "deployment_target"],
  1: ["services", "scope"],
  2: ["needed_by"],
  3: ["contact_name", "contact_email"],
};

// Where a server-side validation error should send the user (covers every
// submit-gate field, not only the step-required ones).
export const FIELD_STEP: Record<string, number> = {
  project_name: 0,
  website: 0,
  description: 0,
  project_types: 0,
  deployment_target: 0,
  multichain: 0,
  services: 1,
  scope: 1,
  repos: 1,
  languages: 1,
  frameworks: 1,
  nsloc: 1,
  doc_links: 1,
  attachments: 1,
  needed_by: 2,
  quote_deadline: 2,
  urgency: 2,
  contact_name: 3,
  contact_email: 3,
  contact_handle: 3,
  contact_calendar_url: 3,
};

const DAY = 24 * 60 * 60 * 1000;

export function wizardDefaults(prefill: {
  contact_name: string;
  contact_email: string;
}): AuditWizardValues {
  return {
    source_project_id: null,
    project_name: "",
    website: "",
    description: "",
    scope: "",
    project_types: [],
    deployment_target: "",
    multichain: false,
    services: [],
    repos: [],
    languages: [],
    frameworks: [],
    nsloc: "",
    doc_links: [],
    attachments: [],
    needed_by: null,
    // Pre-filled per design: "Defaulted to +10 days · the recommended window".
    quote_deadline: new Date(Date.now() + QUOTE_DEADLINE_DEFAULT_DAYS * DAY),
    urgency: "",
    contact_name: prefill.contact_name,
    contact_email: prefill.contact_email,
    contact_handle: "",
    contact_calendar_url: "",
  };
}

/** Form values -> the autosave PATCH/POST body (types/audits auditDraftSchema). */
export function toDraftPayload(values: AuditWizardValues): AuditDraftInput {
  // "10,000" is how a human writes it, and firms price off this number, so a
  // separator must not silently make it 10.
  const nsloc = values.nsloc.trim() === "" ? null : parseWholeNumber(values.nsloc);
  return {
    source_project_id: values.source_project_id,
    project_name: values.project_name,
    website: values.website,
    description: values.description,
    scope: values.scope,
    project_types: values.project_types,
    deployment_target: values.deployment_target,
    multichain: values.multichain,
    services: values.services,
    repos: values.repos
      .filter((repo) => repo.url.trim() !== "")
      .map((repo) => ({ url: repo.url, ref: repo.ref })),
    languages: values.languages,
    frameworks: values.frameworks,
    nsloc: Number.isNaN(nsloc) ? null : nsloc,
    doc_links: values.doc_links.filter((link) => link.trim() !== ""),
    attachments: values.attachments,
    needed_by: values.needed_by,
    quote_deadline: values.quote_deadline,
    urgency: values.urgency === "" ? null : values.urgency,
    contact_name: values.contact_name,
    contact_email: values.contact_email,
    contact_handle: values.contact_handle,
    contact_calendar_url: values.contact_calendar_url,
  } as AuditDraftInput;
}

interface DraftRow {
  source_project_id: string | null;
  project_name: string;
  website: string;
  description: string;
  scope: string;
  project_types: string[];
  deployment_target: string;
  multichain: boolean;
  services: string[];
  repos: unknown;
  languages: string[];
  frameworks: string[];
  nsloc: number | null;
  doc_links: string[];
  attachments: unknown;
  needed_by: Date | null;
  quote_deadline: Date | null;
  urgency: string | null;
  contact_name: string;
  contact_email: string;
  contact_handle: string | null;
  contact_calendar_url: string | null;
}

export function parseRepos(value: unknown): { url: string; ref: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is { url?: unknown; ref?: unknown } => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      url: typeof entry.url === "string" ? entry.url : "",
      ref: typeof entry.ref === "string" ? entry.ref : "",
    }))
    .filter((repo) => repo.url !== "");
}

export function parseAttachments(value: unknown): AuditAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is AuditAttachment =>
      Boolean(entry) &&
      typeof entry === "object" &&
      typeof (entry as AuditAttachment).name === "string" &&
      typeof (entry as AuditAttachment).url === "string" &&
      typeof (entry as AuditAttachment).size === "number",
  );
}

/** Stored draft row -> form values, for resuming via /audits/new?draft=<id>. */
export function draftToValues(
  row: DraftRow,
  prefill: { contact_name: string; contact_email: string },
): AuditWizardValues {
  const defaults = wizardDefaults(prefill);
  return {
    ...defaults,
    source_project_id: row.source_project_id,
    project_name: row.project_name,
    website: row.website,
    description: row.description,
    scope: row.scope,
    project_types: row.project_types,
    deployment_target: (row.deployment_target as AuditWizardValues["deployment_target"]) ?? "",
    multichain: row.multichain,
    services: row.services,
    repos: parseRepos(row.repos),
    languages: row.languages,
    frameworks: row.frameworks,
    nsloc: row.nsloc == null ? "" : String(row.nsloc),
    doc_links: row.doc_links,
    attachments: parseAttachments(row.attachments),
    needed_by: row.needed_by ? new Date(row.needed_by) : null,
    quote_deadline: row.quote_deadline ? new Date(row.quote_deadline) : defaults.quote_deadline,
    urgency: (row.urgency as AuditWizardValues["urgency"]) ?? "",
    contact_name: row.contact_name || defaults.contact_name,
    contact_email: row.contact_email || defaults.contact_email,
    contact_handle: row.contact_handle ?? "",
    contact_calendar_url: row.contact_calendar_url ?? "",
  };
}
