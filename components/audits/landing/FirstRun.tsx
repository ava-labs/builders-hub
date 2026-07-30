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
          Zero fees.
        </>
      }
      body="Describe your scope once · every audit firm on the Ava Labs whitelist quotes it. You compare privately and pick one. Run by Ava Labs as a public good."
      action={
        <Link
          href="/audits/new"
          className="inline-flex h-12 items-center rounded-lg bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          Start your first request
        </Link>
      }
      footnote="Typically several quotes within 10 days"
      action2={
        isAdmin || isAuditor ? (
          <span className="flex items-center gap-4">
            {isAuditor ? (
              <Link
                href="/audits/portal"
                className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Auditor portal
              </Link>
            ) : null}
            {isAdmin ? (
              <Link
                href="/audits/admin"
                className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
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
