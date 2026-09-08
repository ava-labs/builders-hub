import Link from "next/link";
import { BlocksArt } from "@/components/audits/shared/BlocksArt";
import { CARD } from "@/components/audits/shared/classes";
import { formatIsoDateTime } from "@/components/audits/shared/format";

interface SubmissionReceiptProps {
  requestId: string;
  projectName: string;
  submittedAt: Date | null;
  quoteDeadline: Date | null;
}

const shortDate = (date: Date) =>
  date
    .toLocaleDateString("en-US", { month: "short", day: "2-digit" })
    .toUpperCase();

/** The fan-out receipt (design 3a): a bordered card with a dark hero band
 * and a mono-gutter schedule. Doubles as expectation-setting, since the
 * project side gets no emails (Builder Hub is the feed). Copy verbatim. */
export function SubmissionReceipt({
  requestId,
  projectName,
  submittedAt,
  quoteDeadline,
}: SubmissionReceiptProps) {
  // Nothing has been emailed at this point: the approval gate means the
  // program team sees the request before any firm does.
  const timeline = [
    {
      when: "NOW",
      what: "The Ava Labs program team reviews your request, usually within one working day.",
    },
    {
      when: "NEXT",
      what: "Once approved, every whitelisted firm is notified and quotes appear in My requests as they arrive.",
    },
    {
      when: quoteDeadline ? shortDate(new Date(quoteDeadline)) : "THEN",
      what: "You pick one quote; contacts are revealed both ways and the request closes.",
    },
  ];

  return (
    <div className="mx-auto max-w-[640px] py-16">
      <div
        className={`${CARD} animate-in fade-in slide-in-from-bottom-2 overflow-hidden fill-mode-backwards duration-500`}
      >
        {/* Dark hero band, both themes (the 3a brand moment). */}
        <div className="relative overflow-hidden bg-[#121212] px-7 py-8 sm:px-9">
          <BlocksArt variant="corner" palette="plate" className="absolute right-0 top-0" />
          <p className="relative font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#A2AFB2]">
            Request #{requestId.slice(0, 6).toUpperCase()}
            {submittedAt ? ` · submitted ${formatIsoDateTime(submittedAt)}` : ""}
          </p>
          <h1 className="v2-display relative mt-2 text-[26px] text-white">Request submitted.</h1>
          <p className="relative mt-2 max-w-[56ch] text-[13px] leading-relaxed text-[#A2AFB2]">
            {projectName} is queued for review. Every whitelisted firm is notified the moment the
            program team approves it, and nothing is sent before that.
          </p>
        </div>

        <div className="px-7 pb-7 pt-5 sm:px-9">
          {/* 52px mono gutter: NOW / date / THEN scan as a schedule column. */}
          <div className="space-y-2.5">
            {timeline.map((row) => (
              <div key={row.when} className="flex items-baseline gap-2.5">
                <span className="w-[52px] shrink-0 font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                  {row.when}
                </span>
                <span className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {row.what}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link
              href="/audits"
              className="inline-flex h-11 items-center rounded-lg bg-zinc-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Go to my requests
            </Link>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
              No emails to you · check back here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
