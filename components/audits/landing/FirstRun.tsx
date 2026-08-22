import Link from "next/link";
import { EmptyState } from "@/components/audits/shared/EmptyState";

/** Signed in, zero requests (design 1f). Copy verbatim. */
export function FirstRun({
  isAdmin = false,
  isAuditor = false,
}: {
  isAdmin?: boolean;
  isAuditor?: boolean;
}) {
  return (
    <EmptyState
      headline={
        <>
          Competitive quotes.
          <br />
          {/* Same brand-word language as the landing hero (round-4 R4-A):
              ink at rest, the recurring red sheen, a red full stop. */}
          <span className="audits-word-fill">Zero fees</span>
          <span className="text-brand">.</span>
        </>
      }
      body="Describe your scope once · every audit firm on the Ava Labs whitelist quotes it. You compare privately and pick one. Run by Ava Labs as a public good."
      action={
        <Link
          href="/audits/new"
          className="audits-sweep inline-flex h-12 items-center rounded-lg bg-brand px-6 text-sm font-semibold text-white transition-colors"
        >
          Start your first request
        </Link>
      }
      footnote="Typically several quotes within 10 days"
      action2={
        isAdmin || isAuditor ? (
          // This empty state IS the home view for pure admins and auditors
          // (they never have requests), so their doors are real buttons.
          <span className="flex flex-wrap items-center justify-center gap-2.5">
            {isAuditor ? (
              <Link
                href="/audits/portal"
                className="inline-flex h-10 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium transition-colors hover:border-zinc-500 dark:border-white/15 dark:hover:border-white/40"
              >
                Auditor portal
              </Link>
            ) : null}
            {isAdmin ? (
              <Link
                href="/audits/admin"
                className="inline-flex h-10 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium transition-colors hover:border-zinc-500 dark:border-white/15 dark:hover:border-white/40"
              >
                Admin dashboard
              </Link>
            ) : null}
          </span>
        ) : null
      }
    />
  );
}
