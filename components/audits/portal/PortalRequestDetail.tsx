"use client";

import Link from "next/link";
import type { AuditorRequestView } from "@/server/services/audits/visibility";
import { DEPLOYMENT_TARGET_LABELS, URGENCY_LABELS } from "@/lib/audits/constants";
import type { DeploymentTarget, UrgencyOption } from "@/lib/audits/status";
import { CountdownChip } from "@/components/audits/shared/CountdownChip";
import { formatIsoDate } from "@/components/audits/shared/format";
import { parseAttachments, parseRepos } from "@/components/audits/wizard/types";
import { QuoteComposer } from "@/components/audits/portal/QuoteComposer";

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <div className="mt-1.5 text-sm text-zinc-700 dark:text-zinc-300">{children}</div>
    </div>
  );
}

/** Request context left, sticky quote form right (design 1d). */
export function PortalRequestDetail({ view }: { view: AuditorRequestView }) {
  const repos = parseRepos(view.repos);
  const attachments = parseAttachments(view.attachments);
  const deployment = view.deployment_target
    ? (DEPLOYMENT_TARGET_LABELS[view.deployment_target as DeploymentTarget] ?? view.deployment_target)
    : null;
  const metaLine = [
    ...(view.submitted_at
      ? [`Submitted ${formatIsoDate(view.submitted_at)} by ${view.project_name}`]
      : []),
    ...(view.needed_by ? [`needed by ${formatIsoDate(view.needed_by)}`] : []),
    ...(view.urgency
      ? [`urgency: ${URGENCY_LABELS[view.urgency as UrgencyOption] ?? view.urgency}`]
      : []),
  ].join(" · ");

  return (
    <div className="py-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        <Link href="/audits/portal" className="hover:text-zinc-800 dark:hover:text-zinc-200">
          Inbox
        </Link>{" "}
        / {view.project_name || "Untitled request"}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {view.project_name || "Untitled request"}
        </h1>
        {view.window_open && view.quote_deadline ? (
          <CountdownChip deadline={view.quote_deadline} prefix="Closes" palette="portal" />
        ) : (
          <span className="text-sm text-zinc-500 dark:text-zinc-400">Window closed</span>
        )}
      </div>
      {metaLine ? (
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          {metaLine}
        </p>
      ) : null}

      {view.contacts ? (
        <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">
            Won · contacts revealed
          </p>
          <p className="mt-1.5">
            {view.contacts.contact_name} ·{" "}
            <a
              href={`mailto:${view.contacts.contact_email}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-2"
            >
              {view.contacts.contact_email}
            </a>
            {view.contacts.contact_handle ? ` · ${view.contacts.contact_handle}` : ""}
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
          <p className="mt-1.5 text-zinc-600 dark:text-[#A2AFB2]">
            Continues off-platform under standardized terms.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {view.description ? <Section label="Project">{view.description}</Section> : null}
          {view.scope ? (
            <Section label="Scope">
              <span className="whitespace-pre-line">{view.scope}</span>
            </Section>
          ) : null}
          {view.services.length > 0 ? (
            <Section label="Services">{view.services.join(" · ")}</Section>
          ) : null}
          {repos.length > 0 ? (
            <Section label="Repositories">
              <ul className="space-y-1">
                {repos.map((repo) => (
                  <li key={repo.url} className="font-mono text-xs">
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      {repo.url.replace(/^https?:\/\/(www\.)?github\.com\//i, "")}
                    </a>
                    {repo.ref ? <span className="text-zinc-500"> @ {repo.ref}</span> : null}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                Private repos: read access granted if your quote is accepted.
              </p>
            </Section>
          ) : null}
          <Section label="Size">
            {[
              view.nsloc ? `~${view.nsloc.toLocaleString("en-US")} nSLOC` : "size unspecified",
              ...view.languages,
              ...view.frameworks,
            ].join(" · ")}
          </Section>
          {view.doc_links.length > 0 || attachments.length > 0 ? (
            <Section label="Docs">
              <ul className="space-y-1">
                {view.doc_links.map((link) => (
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
            </Section>
          ) : null}
          {deployment ? (
            <Section label="Deployment">
              {deployment} · {view.multichain ? "multi-chain" : "single-chain"}
            </Section>
          ) : null}
          <p className="border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
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
          />
        </div>
      </div>
    </div>
  );
}
