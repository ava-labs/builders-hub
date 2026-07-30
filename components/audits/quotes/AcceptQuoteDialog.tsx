"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { OwnerQuote } from "@/server/services/audits/visibility";
import { formatIsoDate, formatUsd } from "@/components/audits/shared/format";

interface AcceptQuoteDialogProps {
  requestId: string;
  quote: OwnerQuote | null;
  otherCount: number;
  onClose: () => void;
}

/**
 * The decisive moment (design 1j): consequences spelled out before the
 * irreversible action; the red solid appears only here.
 */
export function AcceptQuoteDialog({ requestId, quote, otherCount, onClose }: AcceptQuoteDialogProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (!quote) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/audits/requests/${requestId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "We couldn't accept this quote.");
        router.refresh();
        return;
      }
      toast.success(`Engaged ${body.firm_name}. Contact details are now visible both ways.`);
      onClose();
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const consequences = quote
    ? [
        `Contact details are revealed both ways · you and ${quote.firm_name} connect directly.`,
        otherCount > 0
          ? `This request closes; the ${otherCount} other firm${otherCount === 1 ? " is" : "s are"} notified they weren't selected.`
          : "This request closes.",
        "Program admins see your pick and process any subsidy from here.",
        "The engagement itself continues off-platform under standardized terms.",
      ]
    : [];

  return (
    <AlertDialog open={quote !== null} onOpenChange={(open) => (!open ? onClose() : null)}>
      <AlertDialogContent>
        {quote ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>Accept {quote.firm_name}&apos;s quote?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                    <dt className="text-zinc-500 dark:text-zinc-400">Price</dt>
                    <dd className="text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                      {formatUsd(quote.price_usd)}
                    </dd>
                    <dt className="text-zinc-500 dark:text-zinc-400">Duration</dt>
                    <dd className="text-right text-zinc-900 dark:text-zinc-100">
                      {quote.duration_weeks} weeks
                    </dd>
                    <dt className="text-zinc-500 dark:text-zinc-400">Earliest start</dt>
                    <dd className="text-right font-mono text-xs text-zinc-900 dark:text-zinc-100">
                      {formatIsoDate(quote.earliest_start)}
                    </dd>
                    <dt className="text-zinc-500 dark:text-zinc-400">Re-audit of fixes</dt>
                    <dd className="text-right text-zinc-900 dark:text-zinc-100">
                      {quote.reaudit_included ? "Included" : "Not included"}
                    </dd>
                  </dl>
                  <ul className="mt-4 space-y-1.5 border-t border-zinc-200 pt-3 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">
                    {consequences.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <Button
                disabled={busy}
                onClick={() => void accept()}
                className="bg-brand text-white hover:bg-brand-deep"
              >
                {busy ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
                Accept quote
              </Button>
            </AlertDialogFooter>
          </>
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
