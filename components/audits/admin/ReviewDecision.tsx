"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";

/**
 * The approval gate's one control. Until an admin approves here, the request
 * has no delivery rows and no firm has heard about it, which is the whole
 * point: the whitelist cannot be spammed by whatever gets submitted.
 */
export function ReviewDecision({
  requestId,
  fanoutTarget,
}: {
  requestId: string;
  /** Active firms that will be notified the moment this is approved. */
  fanoutTarget: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const decide = async (decision: "approve" | "reject") => {
    setBusy(decision);
    try {
      const res = await fetch(`/api/audits/admin/requests/${requestId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          decision === "reject" ? { decision, reason: reason.trim() || undefined } : { decision },
        ),
      });
      const payload = (await res.json()) as {
        success: boolean;
        message?: string;
        auditorCount?: number;
        emailFailures?: number;
      };
      if (!res.ok || !payload.success) {
        toast.error(payload.message ?? "We couldn't record the decision.");
        return;
      }
      if (decision === "approve") {
        const count = payload.auditorCount ?? 0;
        toast.success(
          count > 0
            ? `Approved · notified ${count} firm${count === 1 ? "" : "s"}.`
            : "Approved. No active firms on the whitelist, so nobody was notified.",
        );
      } else {
        toast.success("Request rejected. Nothing was sent to any firm.");
      }
      router.refresh();
    } catch {
      toast.error("We couldn't record the decision.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`${CARD} p-5`}>
      <p className={MONO_LABEL_SM}>Needs approval</p>
      <h3 className="v2-display mt-2 text-[19px] uppercase leading-snug text-zinc-950 dark:text-zinc-50">
        Nothing is sent
        <br />
        until you approve.
      </h3>
      <p className="mt-2.5 text-sm leading-relaxed text-zinc-600 dark:text-[#A2AFB2]">
        {fanoutTarget > 0
          ? `Approving notifies ${fanoutTarget} active firm${fanoutTarget === 1 ? "" : "s"} and starts the quote window from now.`
          : "There are no active firms on the whitelist, so approving opens the request without notifying anyone."}
      </p>

      {rejecting ? (
        <div className="mt-4">
          <label
            htmlFor="reject-reason"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Reason <span className="font-normal text-muted-foreground">· admin-side only</span>
          </label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            className="mt-1.5"
            placeholder="Why this request should not fan out. The project never sees this."
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        {rejecting ? (
          <>
            <Button
              variant="outline"
              className="h-10 border-brand-deep/40 text-brand-deep hover:bg-brand/5 dark:border-brand-soft/40 dark:text-brand-soft"
              disabled={busy !== null}
              onClick={() => void decide("reject")}
            >
              {busy === "reject" ? (
                <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm rejection
            </Button>
            <Button
              variant="ghost"
              className="h-10"
              disabled={busy !== null}
              onClick={() => setRejecting(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              className="audits-sweep h-10 bg-brand text-white"
              disabled={busy !== null}
              onClick={() => void decide("approve")}
            >
              {busy === "approve" ? (
                <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Approve and notify
            </Button>
            <Button
              variant="ghost"
              className="h-10 text-zinc-600 dark:text-zinc-400"
              disabled={busy !== null}
              onClick={() => setRejecting(true)}
            >
              Reject
            </Button>
          </>
        )}
      </div>

      <p className="mt-3.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        Logged with your name on the request activity trail.
      </p>
    </div>
  );
}
