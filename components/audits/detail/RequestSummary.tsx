import type { OwnerRequestDetail } from "@/server/services/audits/visibility";
import { DEPLOYMENT_TARGET_LABELS, URGENCY_LABELS } from "@/lib/audits/constants";
import type { DeploymentTarget, UrgencyOption } from "@/lib/audits/status";
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { formatIsoDate, lowerFirst } from "@/components/audits/shared/format";
import { parseAttachments, parseRepos } from "@/components/audits/wizard/types";

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className={MONO_LABEL_SM}>{label}</p>
      <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{children}</div>
    </div>
  );
}

/** What was sent to the firms, so the request page answers its own questions. */
export function RequestSummary({ detail }: { detail: OwnerRequestDetail }) {
  const repos = parseRepos(detail.repos);
  const attachments = parseAttachments(detail.attachments);
  const deployment = detail.deployment_target
    ? (DEPLOYMENT_TARGET_LABELS[detail.deployment_target as DeploymentTarget] ??
      detail.deployment_target)
    : null;
  const timeline = [
    ...(detail.needed_by ? [`needed by ${formatIsoDate(detail.needed_by)}`] : []),
    ...(detail.quote_deadline ? [`quotes close ${formatIsoDate(detail.quote_deadline)}`] : []),
    ...(detail.urgency
      ? [lowerFirst(URGENCY_LABELS[detail.urgency as UrgencyOption] ?? "")]
      : []),
  ].filter(Boolean);

  return (
    <div className={`${CARD} space-y-4 p-5`}>
      {/* Before approval no firm has received anything, and claiming
          otherwise is the one line that makes the gate look broken. */}
      <p className={MONO_LABEL_SM}>
        {detail.status === "pending_review" || detail.status === "rejected"
          ? "Your request · what firms will receive"
          : "Your request · what every firm received"}
      </p>
      {detail.description ? <SummaryRow label="Project">{detail.description}</SummaryRow> : null}
      {detail.scope ? (
        <SummaryRow label="Scope">
          <span className="whitespace-pre-line">{detail.scope}</span>
        </SummaryRow>
      ) : null}
      {detail.services.length > 0 ? (
        <SummaryRow label="Services">{detail.services.join(" · ")}</SummaryRow>
      ) : null}
      {repos.length > 0 ? (
        <SummaryRow label="Repositories">
          <ul className="space-y-1">
            {repos.map((repo) => (
              <li key={repo.url} className="font-mono text-xs">
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {repo.url}
                </a>
                {repo.ref ? <span className="text-zinc-500"> @ {repo.ref}</span> : null}
              </li>
            ))}
          </ul>
        </SummaryRow>
      ) : null}
      {detail.doc_links.length > 0 || attachments.length > 0 ? (
        <SummaryRow label="Docs">
          <ul className="space-y-1">
            {detail.doc_links.map((link) => (
              <li key={link} className="font-mono text-xs">
                <a
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {link}
                </a>
              </li>
            ))}
            {attachments.map((attachment) => (
              <li key={attachment.url} className="font-mono text-xs">
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {attachment.name}
                </a>
              </li>
            ))}
          </ul>
        </SummaryRow>
      ) : null}
      {deployment ? (
        <SummaryRow label="Deployment">
          {deployment} · {detail.multichain ? "multi-chain" : "single-chain"}
        </SummaryRow>
      ) : null}
      {timeline.length > 0 ? <SummaryRow label="Timeline">{timeline.join(" · ")}</SummaryRow> : null}
      <SummaryRow label="Contact">
        {[detail.contact_name, detail.contact_email, detail.contact_handle]
          .filter(Boolean)
          .join(" · ")}
      </SummaryRow>
    </div>
  );
}
