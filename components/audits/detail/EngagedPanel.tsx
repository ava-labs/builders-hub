import type { OwnerRequestDetail } from "@/server/services/audits/visibility";
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { formatIsoDate, formatUsd, weeksLabel } from "@/components/audits/shared/format";
import { ContactHandle } from "@/components/audits/shared/ContactHandle";
import { QuoteDocLink } from "@/components/audits/quotes/QuoteDocLink";
import { parseRepos } from "@/components/audits/wizard/types";

type OwnerQuote = OwnerRequestDetail["quotes"][number];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

function ContactBox({ label, lines }: { label: string; lines: React.ReactNode[] }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 dark:border-white/10 dark:bg-white/[0.03]">
      <p className={MONO_LABEL_SM}>{label}</p>
      <div className="mt-2 space-y-1 font-mono text-xs">{lines}</div>
    </div>
  );
}

/**
 * The engaged state (design 3c): winner card with both-ways contact reveal,
 * subsidy outcome (amount-first) and the archived-quotes card in a right rail.
 */
export function EngagedPanel({
  detail,
  acceptedQuote,
}: {
  detail: OwnerRequestDetail;
  acceptedQuote: OwnerQuote;
}) {
  const otherCount = detail.quotes.length - 1;
  const hasRepos = parseRepos(detail.repos).length > 0;

  const theirLines = [
    acceptedQuote.quote_email ? (
      <a
        key="email"
        href={`mailto:${acceptedQuote.quote_email}`}
        target="_blank"
        rel="noreferrer"
        className="block underline underline-offset-2"
      >
        {acceptedQuote.quote_email}
      </a>
    ) : null,
  ].filter(Boolean) as React.ReactNode[];

  const yourLines = [
    <span key="name" className="block">
      {detail.contact_name} ·{" "}
      <a href={`mailto:${detail.contact_email}`} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        {detail.contact_email}
      </a>
    </span>,
    detail.contact_handle ? (
      <ContactHandle
        key="handle"
        handle={detail.contact_handle}
        className="text-zinc-500 dark:text-zinc-400"
      />
    ) : null,
    detail.contact_calendar_url ? (
      <a
        key="cal"
        href={detail.contact_calendar_url}
        target="_blank"
        rel="noreferrer"
        className="block text-zinc-500 underline underline-offset-2 dark:text-zinc-400"
      >
        kickoff calendar link
      </a>
    ) : null,
  ].filter(Boolean) as React.ReactNode[];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="rounded-xl border-[1.5px] border-zinc-900 bg-white p-5 dark:border-white/70 dark:bg-[#1F1F1F]">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
            {initials(acceptedQuote.firm_name)}
          </span>
          <p className="text-[15px] font-bold">{acceptedQuote.firm_name}</p>
          <span className="rounded-full border border-emerald-600/35 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-emerald-700 dark:border-emerald-400/35 dark:text-emerald-400">
            Your pick
          </span>
          <span className="flex-1" />
          <p className="font-mono text-[19px] font-bold">{formatUsd(acceptedQuote.price_usd)}</p>
        </div>
        <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
          {weeksLabel(acceptedQuote.duration_weeks)} · starts {formatIsoDate(acceptedQuote.earliest_start)}
          {/* The SOW matters most right here, at the off-platform handover
              (round-5 6a); the winner's message stays in the archive below. */}
          {acceptedQuote.deal_doc_url ? (
            <>
              {" · "}
              <QuoteDocLink url={acceptedQuote.deal_doc_url} variant="meta" />
            </>
          ) : null}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ContactBox label="Their contact · revealed to you" lines={theirLines} />
          <ContactBox label="Your contact · shared with them" lines={yourLines} />
        </div>
        <p className="mt-3.5 text-xs text-zinc-500 dark:text-zinc-400">
          The engagement continues off-platform under the program's standardized terms.
          {hasRepos ? " Grant private-repo read access to the firm now." : ""}
        </p>
      </div>

      <div className="space-y-3">
        {detail.subsidy ? (
          <div className={`${CARD} p-4`}>
            <p className={MONO_LABEL_SM}>Subsidy</p>
            {detail.subsidy.state === "approved" ? (
              <>
                <div className="mt-2.5 space-y-1.5 text-sm">
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="text-zinc-600 dark:text-[#A2AFB2]">Program pays</span>
                    <span className="font-mono text-[15px] font-bold">
                      {formatUsd(detail.subsidy.program_amount_usd)}
                    </span>
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {detail.subsidy.pct}% of {formatUsd(acceptedQuote.price_usd)}
                  </p>
                  <p className="flex items-baseline justify-between gap-3">
                    <span className="text-zinc-600 dark:text-[#A2AFB2]">You pay</span>
                    <span className="font-mono font-bold">
                      {formatUsd(detail.subsidy.project_amount_usd)}
                    </span>
                  </p>
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                  Approved by the audit program. Payment is handled off-platform with the firm.
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-600 dark:text-[#A2AFB2]">
                A subsidy was not approved for this engagement.
              </p>
            )}
          </div>
        ) : null}

        {otherCount > 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <p className={MONO_LABEL_SM}>
              The other {otherCount === 1 ? "quote" : `${otherCount} quotes`}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              Archived, read-only. The firms were notified they weren't selected; no reason is
              shared.
            </p>
            <a href="#quote-archive" className="mt-2 inline-block text-xs text-zinc-600 underline underline-offset-2 dark:text-zinc-300">
              View archive ↓
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
