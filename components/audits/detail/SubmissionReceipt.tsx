import Link from "next/link";
import { formatIsoDate } from "@/components/audits/shared/format";

interface SubmissionReceiptProps {
  requestId: string;
  projectName: string;
  submittedAt: Date | null;
  quoteDeadline: Date | null;
  fanoutCount: number;
}

const shortDate = (date: Date) =>
  date
    .toLocaleDateString("en-US", { month: "short", day: "2-digit" })
    .toUpperCase();

/** The fan-out receipt (design 3a): doubles as expectation-setting, since the
 * project side gets no emails (Builder Hub is the feed). Copy verbatim. */
export function SubmissionReceipt({
  requestId,
  projectName,
  submittedAt,
  quoteDeadline,
  fanoutCount,
}: SubmissionReceiptProps) {
  const timeline = [
    {
      when: "Now",
      what: "Firms review your scope; quotes appear in My requests as they arrive.",
    },
    {
      when: quoteDeadline ? shortDate(new Date(quoteDeadline)) : "Deadline",
      what: "Quote window closes (10 days). Firms can edit their quotes until then.",
    },
    {
      when: "Then",
      what: "You pick one quote; contacts are revealed both ways and the request closes.",
    },
  ];

  return (
    <div className="mx-auto max-w-xl py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        Request {requestId.slice(0, 6).toUpperCase()}
        {submittedAt ? ` · submitted ${formatIsoDate(submittedAt)}` : ""}
      </p>
      <h1 className="mt-3 text-4xl font-black uppercase tracking-tight text-zinc-950 dark:text-zinc-50">
        Request sent.
      </h1>
      <p className="mt-4 text-base text-zinc-600 dark:text-[#A2AFB2]">
        {projectName} is now in front of all {fanoutCount} whitelisted firms. They were emailed
        just now.
      </p>

      <div className="mt-8 space-y-4 border-l border-zinc-200 pl-5 dark:border-white/10">
        {timeline.map((row) => (
          <div key={row.when}>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {row.when}
            </p>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{row.what}</p>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <Link
          href="/audits"
          className="inline-flex h-11 items-center rounded-lg bg-zinc-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Go to my requests
        </Link>
      </div>

      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
        No emails to you · check back here
      </p>
    </div>
  );
}
