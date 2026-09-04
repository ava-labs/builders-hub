import { Clock } from "lucide-react";
import type { OwnerRequestDetail } from "@/server/services/audits/visibility";
import { MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { CountdownChip } from "@/components/audits/shared/CountdownChip";
import { formatIsoDate } from "@/components/audits/shared/format";

/** The collecting-state banner (design 3b): wash, red clock, honest counts. */
export function CollectingBanner({ detail }: { detail: OwnerRequestDetail }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
      <Clock aria-hidden className="h-4 w-4 shrink-0 text-brand dark:text-brand-soft" />
      <p className="text-sm">
        {detail.quote_deadline ? (
          <>
            <CountdownChip deadline={detail.quote_deadline} prefix="Window closes" />
            <span className="text-zinc-500 dark:text-zinc-400">
              {" "}
              · {formatIsoDate(detail.quote_deadline)}{" "}
            </span>
          </>
        ) : null}
        <span className="text-zinc-300 dark:text-zinc-600">| </span>
        {detail.fanout_count > 0 ? (
          <>
            <span className="font-medium">
              {detail.quote_count} of {detail.fanout_count}
            </span>{" "}
            <span className="text-zinc-500 dark:text-zinc-400">firms have quoted</span>
          </>
        ) : (
          <span className="text-zinc-500 dark:text-zinc-400">
            sent to <span className="font-medium">0 firms</span> · the whitelist was empty at
            submission
          </span>
        )}
      </p>
      <span className="flex-1" />
      <p className={MONO_LABEL_SM}>
        {detail.fanout_count > 0
          ? "Most quotes land in the final days"
          : "Reopen after expiry re-notifies every active firm"}
      </p>
    </div>
  );
}
