import type { AuditorRequestView } from "@/server/services/audits/visibility";
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { formatIsoDate, formatUsd } from "@/components/audits/shared/format";

type OwnQuote = NonNullable<AuditorRequestView["own_quote"]>;

const FOOT_BY_STATUS: Record<string, string> = {
  accepted: "This quote was accepted. The engagement continues off-platform.",
  not_selected: "The project chose another provider. Your quote stays private; new requests keep arriving in your inbox.",
};

/**
 * Read-only state of the composer once the request is decided or the window
 * closed: the numbers stay visible, nothing is editable, no CTA.
 */
export function QuoteSummary({ quote }: { quote: OwnQuote }) {
  return (
    <div className={`${CARD} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={MONO_LABEL_SM}>Your quote · window closed</p>
        <StatusBadge kind="quote" status={quote.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-mono text-2xl font-bold">{formatUsd(quote.price_usd)}</p>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-zinc-500 dark:text-zinc-400">
          {quote.duration_weeks} weeks · starts {formatIsoDate(quote.earliest_start)}
        </p>
      </div>
      {quote.reaudit_included ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-400">
          Re-audit of fixes included
        </p>
      ) : null}
      {quote.message ? (
        <p className="mt-3 border-l-2 border-zinc-200 pl-3 text-sm leading-relaxed text-zinc-600 dark:border-white/10 dark:text-[#A2AFB2]">
          {quote.message}
        </p>
      ) : null}
      <p className="mt-4 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
        {FOOT_BY_STATUS[quote.status] ??
          "Quotes can no longer be edited. The project and program admins still see it."}
      </p>
    </div>
  );
}
