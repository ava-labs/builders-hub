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
import { AUDITS_DIALOG, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { formatIsoDate, formatUsd, weeksLabel } from "@/components/audits/shared/format";

interface AcceptQuoteDialogProps {
  requestId: string;
  quote: OwnerQuote | null;
  otherCount: number;
  onClose: () => void;
}

/**
 * The decisive moment (design 1j): the facts in a bordered plate, the four
 * consequences with explicit dots, and the red solid appears only here
 * (deliberately without the sweep hover: irreversible, not playful).
 * Below 640px it docks as a bottom sheet.
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

  const facts = quote
    ? [
        { label: "Price", value: formatUsd(quote.price_usd), strong: true },
        { label: "Duration", value: weeksLabel(quote.duration_weeks) },
        { label: "Earliest start", value: formatIsoDate(quote.earliest_start) },
      ]
    : [];

  return (
    <AlertDialog open={quote !== null} onOpenChange={(open) => (!open ? onClose() : null)}>
      <AlertDialogContent
        className={`${AUDITS_DIALOG} max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0`}
      >
        {quote ? (
          <>
            <AlertDialogHeader className="text-left">
              <p className={MONO_LABEL_SM}>Irreversible · read once</p>
              <AlertDialogTitle className="text-[17px] font-bold tracking-[-0.01em]">
                Accept the quote from {quote.firm_name}?
              </AlertDialogTitle>
            </AlertDialogHeader>
            <dl className="rounded-[10px] border border-zinc-200 dark:border-white/[0.16]">
              {facts.map((fact, index) => (
                <div
                  key={fact.label}
                  className={`flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm ${index > 0 ? "border-t border-zinc-200 dark:border-white/[0.08]" : ""}`}
                >
                  <dt className="text-zinc-600 dark:text-[#A2AFB2]">{fact.label}</dt>
                  <dd
                    className={`font-mono text-[13px] text-zinc-900 dark:text-zinc-100 ${fact.strong ? "font-bold" : ""}`}
                  >
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
            <AlertDialogDescription asChild>
              <ul className="space-y-1.5 text-sm text-zinc-600 dark:text-[#A2AFB2]">
                {consequences.map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full bg-zinc-900 dark:bg-zinc-100"
                    />
                    <span className="leading-relaxed">{line}</span>
                  </li>
                ))}
              </ul>
            </AlertDialogDescription>
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
