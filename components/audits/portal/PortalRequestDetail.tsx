"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import type { AuditorRequestView } from "@/server/services/audits/visibility";
import { DEPLOYMENT_TARGET_LABELS, URGENCY_LABELS } from "@/lib/audits/constants";
import type { DeploymentTarget, UrgencyOption } from "@/lib/audits/status";
import { CARD, MONO_LABEL_META, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { CountdownChip } from "@/components/audits/shared/CountdownChip";
import { SpecList, type SpecItem } from "@/components/audits/shared/SpecList";
import { formatIsoDate } from "@/components/audits/shared/format";
import { ContactHandle } from "@/components/audits/shared/ContactHandle";
import { parseAttachments, parseRepos } from "@/components/audits/wizard/types";
import { QuoteComposer } from "@/components/audits/portal/QuoteComposer";
import { DeactivatedBanner } from "@/components/audits/portal/DeactivatedBanner";

const shortRepo = (url: string) => url.replace(/^https?:\/\/(www\.)?github\.com\//i, "");

function buildSpecItems(view: AuditorRequestView): SpecItem[] {
  const repos = parseRepos(view.repos);
  const attachments = parseAttachments(view.attachments);
  const deployment = view.deployment_target
    ? (DEPLOYMENT_TARGET_LABELS[view.deployment_target as DeploymentTarget] ?? view.deployment_target)
    : null;

  return [
    ...(view.services.length > 0
      ? [{ label: "Services", children: view.services.join(" · ") }]
      : []),
    ...(repos.length > 0
      ? [
          {
            label: "Repositories",
            children: (
              <div className="space-y-1">
                {repos.map((repo) => (
                  <p key={repo.url} className="break-all font-mono text-xs">
                    <a href={repo.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      {shortRepo(repo.url)}
                    </a>
                    {repo.ref ? (
                      <span className="text-info dark:text-info-soft"> @ {repo.ref}</span>
                    ) : null}
                  </p>
                ))}
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Private repos: read access granted if your quote is accepted.
                </p>
              </div>
            ),
          },
        ]
      : []),
    {
      label: "Size",
      children: [
        view.nsloc ? `~${view.nsloc.toLocaleString("en-US")} nSLOC` : "size unspecified",
        ...view.languages,
        ...view.frameworks,
      ].join(" · "),
    },
    ...(view.doc_links.length > 0 || attachments.length > 0
      ? [
          {
            label: "Docs",
            children: (
              <div className="space-y-1">
                {view.doc_links.map((link) => (
                  <p key={link} className="break-all font-mono text-xs">
                    <a href={link} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      {link}
                    </a>
                  </p>
                ))}
                {attachments.map((attachment) => (
                  <p key={attachment.url} className="break-all font-mono text-xs">
                    <a href={attachment.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                      {attachment.name}
                    </a>
                  </p>
                ))}
              </div>
            ),
          },
        ]
      : []),
    ...(deployment
      ? [
          {
            label: "Deployment",
            children: `${deployment} · ${view.multichain ? "multi-chain" : "single-chain"}`,
          },
        ]
      : []),
  ];
}

/** Request context left in one definition card, sticky quote form right (design 1d). */
export function PortalRequestDetail({
  view,
  firmActive = true,
}: {
  view: AuditorRequestView;
  /** Deactivated firms read their history; the composer rests (N-4). */
  firmActive?: boolean;
}) {
  const metaLine = [
    ...(view.submitted_at
      ? [`Submitted ${formatIsoDate(view.submitted_at)} by ${view.project_name}`]
      : []),
    ...(view.needed_by ? [`needed by ${formatIsoDate(view.needed_by)}`] : []),
    ...(view.urgency
      ? [URGENCY_LABELS[view.urgency as UrgencyOption] ?? view.urgency]
      : []),
  ].join(" · ");

  return (
    <div className="py-10">
      {firmActive ? null : <DeactivatedBanner />}
      {/* Quiet sentence-case breadcrumb (board :233), not the mono-caps shout. */}
      <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
        <Link
          href="/audits/portal"
          className="underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Inbox
        </Link>{" "}
        / {view.project_name || "Untitled request"}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {view.project_name || "Untitled request"}
        </h1>
        {view.quote_deadline ? (
          // The dot-pill the inbox cards speak in (round-4 A4-B). closed
          // covers early close by acceptance: the deadline timestamp can
          // still be in the future while the window is already shut.
          <CountdownChip
            deadline={view.quote_deadline}
            prefix="Closes"
            palette="portal"
            pill
            closed={!view.window_open}
          />
        ) : (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Window closed</span>
        )}
      </div>
      {metaLine ? <p className={`${MONO_LABEL_META} mt-1.5`}>{metaLine}</p> : null}

      {view.contacts ? (
        <div className="mt-5 rounded-xl border border-emerald-600/30 bg-emerald-500/5 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
              Won · contacts revealed
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Continues off-platform under standardized terms.
            </p>
          </div>
          <p className="mt-2 font-mono text-xs">
            {view.contacts.contact_name} ·{" "}
            <a
              href={`mailto:${view.contacts.contact_email}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-2"
            >
              {view.contacts.contact_email}
            </a>
            {view.contacts.contact_handle ? (
              <>
                {" · "}
                <ContactHandle handle={view.contacts.contact_handle} />
              </>
            ) : null}
            {view.contacts.contact_calendar_url ? (
              <>
                {" · "}
                <a
                  href={view.contacts.contact_calendar_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  book a kickoff call
                </a>
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className={`${CARD} p-5`}>
            {view.description ? (
              <>
                <p className={MONO_LABEL_SM}>Project</p>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {view.description}
                </p>
              </>
            ) : null}
            {view.scope ? (
              <>
                <p className={`${MONO_LABEL_SM} mt-4`}>Scope</p>
                <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {view.scope}
                </p>
              </>
            ) : null}
            <SpecList
              className="mt-4 border-t border-zinc-200 dark:border-white/10"
              items={buildSpecItems(view)}
            />
          </div>
          <p className="mt-3.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" />
            Project contact is revealed only if your quote is accepted. Competing quotes are never
            visible to you.
          </p>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <QuoteComposer
            requestId={view.id}
            existing={view.own_quote}
            windowOpen={view.window_open}
            deadline={view.quote_deadline}
            firmActive={firmActive}
            subsidy={view.subsidy}
          />
        </div>
      </div>
    </div>
  );
}
