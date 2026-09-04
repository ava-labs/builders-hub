import { renderAuditEmail } from "@/server/services/audits/emails/template";
import {
  recipientsOf,
  sendToFirm,
  type FirmRecipient,
} from "@/server/services/audits/emails/recipients";
import type { AuditEmailDetail } from "@/server/services/audits/emails/template";
import { PORTAL_URL, portalRequestUrl } from "@/server/services/audits/emails/links";
import { DEPLOYMENT_TARGET_LABELS, URGENCY_LABELS } from "@/lib/audits/constants";
import type { DeploymentTarget, UrgencyOption } from "@/lib/audits/status";

export type FanoutAuditor = FirmRecipient;

export interface FanoutRequest {
  id: string;
  project_name: string;
  quote_deadline: Date | null;
  services: string[];
  nsloc: number | null;
  /** Everything below is what makes the mail triageable without logging in. */
  description?: string;
  scope?: string;
  project_types?: string[];
  languages?: string[];
  frameworks?: string[];
  repo_count?: number;
  deployment_target?: string;
  multichain?: boolean;
  needed_by?: Date | null;
  urgency?: string | null;
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** Scope travels in the mail so a firm can price the job at a glance, but it
    is a forwardable medium: the full text stays behind the portal link. */
const SCOPE_LIMIT = 300;
const clamp = (value: string, limit: number) =>
  value.length > limit ? `${value.slice(0, limit).trimEnd()}…` : value;

const lowerFirst = (value: string) =>
  value.length > 0 ? `${value[0].toLowerCase()}${value.slice(1)}` : value;

function detailRows(request: FanoutRequest): AuditEmailDetail[] {
  const rows: AuditEmailDetail[] = [];

  if (request.services.length > 0) {
    rows.push({ label: "Service", value: request.services.join(" · ") });
  }

  const sizeParts = [
    ...(request.nsloc ? [`~${request.nsloc.toLocaleString("en-US")} nSLOC`] : []),
    ...(request.languages ?? []),
    ...(request.frameworks ?? []),
  ];
  if (sizeParts.length > 0) {
    rows.push({ label: "Size", value: sizeParts.join(" · "), mono: true });
  }

  if (request.repo_count && request.repo_count > 0) {
    rows.push({
      label: "Repositories",
      value: `${request.repo_count} pinned · read access on acceptance`,
      mono: true,
    });
  }

  if (request.deployment_target) {
    const target = DEPLOYMENT_TARGET_LABELS[request.deployment_target as DeploymentTarget];
    if (target) {
      rows.push({
        label: "Deployment",
        value: `${target} · ${request.multichain ? "multi-chain" : "single-chain"}`,
      });
    }
  }

  if (request.needed_by) {
    const urgency = request.urgency
      ? URGENCY_LABELS[request.urgency as UrgencyOption]
      : undefined;
    rows.push({
      label: "Needed by",
      value: [isoDate(request.needed_by), urgency ? lowerFirst(urgency) : null]
        .filter(Boolean)
        .join(" · "),
      mono: true,
    });
  }

  if (request.quote_deadline) {
    rows.push({
      label: "Your window",
      value: `closes ${isoDate(request.quote_deadline)}`,
      mono: true,
      urgent: true,
    });
  }

  return rows;
}

/**
 * The fan-out notice sent to every ACTIVE whitelisted firm once a request is
 * approved. Recipients are ALWAYS the firm's quote email plus its approved
 * teammates (Auditor and AuditorMember rows), never request input. The firm's
 * name means nothing to a reader, so the project name leads
 * at display size and the money question (how much work, what scope, by when)
 * sits in the raised panel. Copy rule: no em dashes anywhere, "·" separates
 * meta. Escaping lives in the shared template.
 */
export async function sendFanoutNotification(
  auditor: FanoutAuditor,
  request: FanoutRequest,
): Promise<void> {
  const subject = `«${request.project_name}» requested an audit on Avalanche Builder Hub`;
  const deadline = request.quote_deadline ? isoDate(request.quote_deadline) : null;
  const requestUrl = portalRequestUrl(request.id);

  const category = request.project_types?.[0];
  const rows = detailRows(request);
  const scope = request.scope?.trim();
  const description = request.description?.trim();

  const metaParts = [
    ...request.services,
    ...(request.nsloc ? [`~${request.nsloc.toLocaleString("en-US")} nSLOC`] : []),
    ...(deadline ? [`quotes close ${deadline}`] : []),
  ];
  const metaLine = metaParts.join(" · ");

  const text = [
    `${request.project_name} requested an audit on Avalanche Builder Hub.`,
    description ? clamp(description, SCOPE_LIMIT) : null,
    scope ? `Scope: ${clamp(scope, SCOPE_LIMIT)}` : null,
    metaLine,
    `Review and quote: ${requestUrl}`,
    "Quotes are private to the requesting project and the program team.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = renderAuditEmail({
    eyebrow: category ? `New audit request · ${category}` : "New audit request",
    title: request.project_name,
    titleLarge: true,
    body: description ? clamp(description, SCOPE_LIMIT) : undefined,
    // Without a scope the panel would be an unlabelled row stack, so it only
    // renders once there is something to read or list.
    panel:
      scope || rows.length > 0
        ? {
            label: scope ? "Scope" : "Request",
            text: scope ? clamp(scope, SCOPE_LIMIT) : undefined,
            rows,
          }
        : undefined,
    cta: { label: "Review and quote", href: requestUrl, variant: "primary" },
    secondaryCta: { label: "All open requests", href: PORTAL_URL, variant: "neutral" },
    footerLines: [
      "Your quote is private to the requesting project and the program team. Other firms never see it.",
      "Your firm is on the Ava Labs whitelist · fan-out notices arrive at every approved address for your firm.",
    ],
  });

  await sendToFirm(recipientsOf(auditor), html, subject, text);
}
