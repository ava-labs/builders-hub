import { Fragment } from "react";
import type { AdminRequestDetail } from "@/server/services/audits/visibility";
import {
  DEPLOYMENT_TARGET_LABELS,
  QUOTE_DEADLINE_DEFAULT_DAYS,
  URGENCY_LABELS,
} from "@/lib/audits/constants";
import type { DeploymentTarget, UrgencyOption } from "@/lib/audits/status";
import { toAttachmentLinks } from "@/lib/audits/attachments";
import { isValidHttpUrl } from "@/lib/url-validation";
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { formatIsoDate, lowerFirst } from "@/components/audits/shared/format";
import { SpecList, type SpecItem } from "@/components/audits/shared/SpecList";
import { ContactHandle } from "@/components/audits/shared/ContactHandle";
import { parseRepos } from "@/components/audits/wizard/types";

const LINK = "underline underline-offset-2";
const URL_TEXT = "break-all font-mono text-xs";

/** A link the project typed in. Only a realistic http(s) URL becomes an href;
    anything else a row could hold (another scheme, a value that does not
    parse, a dotless host) stays plain text. */
function ProjectLink({ url }: { url: string }) {
  if (!isValidHttpUrl(url)) return <>{url}</>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={LINK}>
      {url}
    </a>
  );
}

function Dotted({ parts }: { parts: React.ReactNode[] }) {
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? " · " : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Everything the project submitted, for the admin deciding whether it reaches
 * the firms (Joey, 2026-09-28: scope and contact alone were too little to
 * tell a real request from one that wastes the firms' time). The admin read
 * already returns the whole row; this is only its view.
 */
export function SubmissionDetails({ detail }: { detail: AdminRequestDetail }) {
  const repos = parseRepos(detail.repos);
  // Program links, as on the owner's and the firms' pages: a stored blob URL
  // is a bearer token and must not reach the DOM.
  const attachments = toAttachmentLinks(detail.id, detail.attachments);
  const deployment = detail.deployment_target
    ? (DEPLOYMENT_TARGET_LABELS[detail.deployment_target as DeploymentTarget] ??
      detail.deployment_target)
    : null;
  // After approval the quotes card header carries the window. Before it, the
  // approver sees what approval will do: keep the project's date, or start
  // the default window (fanout.ts approveRequestAndFanout).
  const pending = detail.display_status === "pending_review";
  const timeline = [
    ...(detail.needed_by ? [`needed by ${formatIsoDate(detail.needed_by)}`] : []),
    ...(pending
      ? [
          detail.quote_deadline
            ? `quotes close ${formatIsoDate(detail.quote_deadline)}`
            : `quotes close ${QUOTE_DEADLINE_DEFAULT_DAYS} days after approval`,
        ]
      : []),
    ...(detail.urgency
      ? [lowerFirst(URGENCY_LABELS[detail.urgency as UrgencyOption] ?? detail.urgency)]
      : []),
  ];
  // The account that sent the request. The Contact row already carries the
  // name, so a matching one is not printed a second time.
  const sameAccount = detail.user.email.toLowerCase() === detail.contact_email.toLowerCase();
  const accountName =
    detail.user.name &&
    detail.user.name.trim().toLowerCase() !== detail.contact_name.trim().toLowerCase()
      ? detail.user.name
      : null;

  const items: SpecItem[] = [
    ...(detail.website
      ? [
          {
            label: "Website",
            children: (
              <span className={URL_TEXT}>
                <ProjectLink url={detail.website} />
              </span>
            ),
          },
        ]
      : []),
    ...(detail.project_types.length > 0
      ? [{ label: "Project type", children: detail.project_types.join(" · ") }]
      : []),
    ...(deployment
      ? [
          {
            label: "Deployment",
            children: `${deployment} · ${detail.multichain ? "multi-chain" : "single-chain"}`,
          },
        ]
      : []),
    ...(detail.services.length > 0
      ? [{ label: "Services", children: detail.services.join(" · ") }]
      : []),
    ...(repos.length > 0
      ? [
          {
            label: "Repositories",
            children: (
              <div className="space-y-1">
                {repos.map((repo) => (
                  <p key={repo.url} className={URL_TEXT}>
                    <ProjectLink url={repo.url} />
                    {repo.ref ? (
                      <span className="text-zinc-500 dark:text-zinc-400"> @ {repo.ref}</span>
                    ) : null}
                  </p>
                ))}
              </div>
            ),
          },
        ]
      : []),
    {
      label: "Size",
      children: [
        detail.nsloc ? `~${detail.nsloc.toLocaleString("en-US")} nSLOC` : "size unspecified",
        ...detail.languages,
        ...detail.frameworks,
      ].join(" · "),
    },
    ...(detail.doc_links.length > 0 || attachments.length > 0
      ? [
          {
            label: "Docs",
            children: (
              <div className="space-y-1">
                {detail.doc_links.map((link) => (
                  <p key={link} className={URL_TEXT}>
                    <ProjectLink url={link} />
                  </p>
                ))}
                {attachments.map((attachment) => (
                  <p key={attachment.href} className={URL_TEXT}>
                    <a href={attachment.href} target="_blank" rel="noreferrer" className={LINK}>
                      {attachment.name}
                    </a>
                  </p>
                ))}
              </div>
            ),
          },
        ]
      : []),
    ...(timeline.length > 0 ? [{ label: "Timeline", children: timeline.join(" · ") }] : []),
    {
      label: "Contact",
      children: (
        <Dotted
          parts={[
            ...(detail.contact_name ? [detail.contact_name] : []),
            ...(detail.contact_email
              ? [
                  <a key="email" href={`mailto:${detail.contact_email}`} className={LINK}>
                    {detail.contact_email}
                  </a>,
                ]
              : []),
            ...(detail.contact_handle ? [<ContactHandle key="handle" handle={detail.contact_handle} />] : []),
          ]}
        />
      ),
    },
    ...(detail.contact_calendar_url
      ? [
          {
            label: "Calendar",
            children: (
              <span className={URL_TEXT}>
                <ProjectLink url={detail.contact_calendar_url} />
              </span>
            ),
          },
        ]
      : []),
    {
      label: "Builder Hub account",
      children: sameAccount
        ? "Same as the contact"
        : [accountName, detail.user.email].filter(Boolean).join(" · "),
    },
  ];

  return (
    <section className={`${CARD} p-5`}>
      <h2 className={MONO_LABEL_SM}>Submission · as the project sent it</h2>
      {detail.description ? (
        <>
          <p className={`${MONO_LABEL_SM} mt-4`}>Project</p>
          <p className="mt-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {detail.description}
          </p>
        </>
      ) : null}
      {detail.scope ? (
        <>
          <p className={`${MONO_LABEL_SM} mt-4`}>Scope</p>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            {detail.scope}
          </p>
        </>
      ) : null}
      <SpecList className="mt-4 border-t border-zinc-200 dark:border-white/10" items={items} />
    </section>
  );
}
