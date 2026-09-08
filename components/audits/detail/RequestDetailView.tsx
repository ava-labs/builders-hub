"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DEPLOYMENT_TARGET_LABELS } from "@/lib/audits/constants";
import type { DeploymentTarget } from "@/lib/audits/status";
import type { OwnerRequestDetail } from "@/server/services/audits/visibility";
import { AUDITS_DIALOG, MONO_LABEL, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { formatIsoDate, formatUsd } from "@/components/audits/shared/format";
import { CollectingBanner } from "@/components/audits/detail/CollectingBanner";
import { EngagedPanel } from "@/components/audits/detail/EngagedPanel";
import { RequestSummary } from "@/components/audits/detail/RequestSummary";
import { QuotesPanel } from "@/components/audits/quotes/QuotesPanel";

function metaStrip(detail: OwnerRequestDetail): string {
  const parts = [
    ...(detail.services.length > 0 ? [detail.services[0]] : []),
    ...(detail.nsloc ? [`~${detail.nsloc.toLocaleString("en-US")} nSLOC`] : []),
    ...(detail.deployment_target
      ? [DEPLOYMENT_TARGET_LABELS[detail.deployment_target as DeploymentTarget] ?? ""]
      : []),
    ...(detail.needed_by ? [`needed by ${formatIsoDate(detail.needed_by)}`] : []),
  ];
  return parts.filter(Boolean).join(" · ");
}

/** Nothing has been sent yet, so the exit from review is editing, not a
    terminal withdrawal: back to draft, resubmit when it is right. */
function ReturnToDraftButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/audits/requests/${requestId}/return-to-draft`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "We couldn't reopen this request for editing.");
        return;
      }
      toast.success("Back in your drafts. Edit and submit it again when you're ready.");
      router.push(`/audits/new?draft=${requestId}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-10">
          Cancel and edit request
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className={AUDITS_DIALOG}>
        <AlertDialogHeader>
          <AlertDialogTitle>Take this request back to drafts?</AlertDialogTitle>
          <AlertDialogDescription>
            It leaves the review queue and becomes an editable draft again. No firm has seen it, so
            nothing is lost. Submit it again whenever you are ready, or delete the draft from My
            requests if you have changed your plans.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Leave it in review</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={() => void cancel()}>
            Back to drafts
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function WithdrawButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const withdraw = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/audits/requests/${requestId}/withdraw`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "We couldn't withdraw this request.");
        return;
      }
      toast.success("Request withdrawn.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-700">
          Withdraw request
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className={AUDITS_DIALOG}>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw this request?</AlertDialogTitle>
          <AlertDialogDescription>
            Firms will no longer be able to quote it, and it cannot be reopened. Quotes already
            received stay visible to you.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep collecting</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={() => void withdraw()}
            className="border border-brand-deep/35 bg-transparent text-brand-deep shadow-none hover:bg-brand-deep/5 dark:border-brand-soft/35 dark:text-brand-soft dark:hover:bg-brand-soft/10"
          >
            Withdraw
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StateCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-white/10 dark:bg-[#1F1F1F]">
      <p className="font-semibold">{title}</p>
      <p className="mt-1.5 text-sm text-zinc-600 dark:text-[#A2AFB2]">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function ReopenButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const reopen = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/audits/requests/${requestId}/reopen`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "We couldn't reopen this request.");
        return;
      }
      toast.success(`Reopened. ${body.auditorCount} firms were notified again.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" disabled={busy} onClick={() => void reopen()} className="h-11 md:h-10">
      Reopen for one more round
    </Button>
  );
}

export function RequestDetailView({
  detail,
  userId,
}: {
  detail: OwnerRequestDetail;
  userId: string;
}) {
  const status = detail.display_status;
  const acceptedQuote = detail.quotes.find((quote) => quote.status === "accepted") ?? null;

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-10">
      <p className={MONO_LABEL}>
        <Link href="/audits" className="hover:text-zinc-800 dark:hover:text-zinc-200">
          Audit requests
        </Link>{" "}
        / {detail.project_name || "Untitled request"}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {detail.project_name || "Untitled request"}
        </h1>
        <StatusBadge status={status} />
        <span className="flex-1" />
        {status === "engaged" && detail.closed_at ? (
          <p className={MONO_LABEL}>Accepted {formatIsoDate(detail.closed_at)}</p>
        ) : null}
      </div>
      {metaStrip(detail) ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {metaStrip(detail)}
        </p>
      ) : null}

      <div className="mt-8 space-y-6">
        {status === "collecting" ? (
          <>
            <CollectingBanner detail={detail} />
            {detail.quotes.length > 0 ? (
              <QuotesPanel
                quotes={detail.quotes}
                userId={userId}
                neededBy={detail.needed_by}
                showAcceptNote
                acceptRequestId={detail.id}
              />
            ) : (
              <StateCard
                title="No quotes yet."
                body="Firms typically respond in the final days of the window. Quotes appear here as they arrive."
              />
            )}
            {/* Hairline-anchored closing row of the quotes block (board R3-B):
                the quiet destructive affordance belongs to the panel, not the void. */}
            <div className="flex justify-end border-t border-zinc-200 pt-3 dark:border-white/10">
              <WithdrawButton requestId={detail.id} />
            </div>
          </>
        ) : null}

        {status === "deciding" ? (
          <>
            {/* Same banner-card anatomy as CollectingBanner (round-4 R4-B):
                the two sibling states speak in one voice. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
              <Clock aria-hidden className="h-4 w-4 shrink-0 text-brand dark:text-brand-soft" />
              <p className="text-sm">
                <span className="font-medium">
                  Window closed
                  {detail.quote_deadline ? ` ${formatIsoDate(detail.quote_deadline)}` : ""}
                </span>{" "}
                <span className="text-zinc-500 dark:text-zinc-400">
                  · quotes visible only to you and program admins
                </span>
              </p>
              <span className="flex-1" />
              <p className={MONO_LABEL_SM}>Pick one to reveal contacts</p>
            </div>
            <QuotesPanel
              quotes={detail.quotes}
              userId={userId}
              neededBy={detail.needed_by}
              showAcceptNote
              acceptRequestId={detail.id}
            />
          </>
        ) : null}

        {status === "engaged" ? (
          acceptedQuote ? (
            <>
              <EngagedPanel detail={detail} acceptedQuote={acceptedQuote} />
              {detail.quotes.length > 1 ? (
                <div id="quote-archive" className="scroll-mt-24 space-y-3">
                  <p className={MONO_LABEL_SM}>Archived quotes · read-only</p>
                  <QuotesPanel quotes={detail.quotes} userId={userId} neededBy={detail.needed_by} />
                </div>
              ) : null}
            </>
          ) : (
            <StateCard
              title="Engaged."
              body="The engagement continues off-platform under standardized terms."
            />
          )
        ) : null}

        {status === "expired" ? (
          <StateCard
            title="The quote window closed without quotes."
            body="This request can be reopened for one more round; every active firm is notified again."
            action={<ReopenButton requestId={detail.id} />}
          />
        ) : null}

        {status === "withdrawn" ? (
          <StateCard
            title="You withdrew this request."
            body="Firms can no longer quote it. Start a new request any time."
          />
        ) : null}

        {status === "pending_review" ? (
          <StateCard
            title="Waiting for the program team to approve it."
            body="Ava Labs reviews every request before it reaches the whitelist, usually within one working day. No firm has been notified yet, and the quote window starts on approval so you lose no time."
            action={<ReturnToDraftButton requestId={detail.id} />}
          />
        ) : null}

        {status === "rejected" ? (
          <StateCard
            title="This request was not approved."
            body="It was not sent to any firm. Contact the program team if you would like to know more, or start a new request with an updated scope."
          />
        ) : null}

        <RequestSummary detail={detail} />
      </div>
    </div>
  );
}
