"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AuditorRequestView } from "@/server/services/audits/visibility";
import { normalizeUrlInput } from "@/types/audits";
import { MAX_QUOTE_WEEKS } from "@/lib/audits/constants";
import { AUDITS_DIALOG, MONO_LABEL_META } from "@/components/audits/shared/classes";
import {
  formatIsoDate,
  formatUsd,
  fromUtcCalendarDate,
  parseWholeNumber,
  toUtcCalendarDate,
  weeksLabel,
} from "@/components/audits/shared/format";
import { QuoteSummary } from "@/components/audits/portal/QuoteSummary";

interface QuoteComposerProps {
  requestId: string;
  existing: AuditorRequestView["own_quote"];
  windowOpen: boolean;
  deadline: Date | null;
  /** Deactivated firms browse read-only; the composer never arms (N-4). */
  firmActive?: boolean;
  /** Approved subsidy on a won request, shown in the resting summary. */
  subsidy?: AuditorRequestView["subsidy"];
}

/**
 * Three structured numbers keep quotes comparable downstream; the message
 * carries the nuance. Editable until the window closes; the server enforces
 * the same rule (isQuoteWindowOpen), so this state can only ever be cosmetic.
 */
export function QuoteComposer({
  requestId,
  existing,
  windowOpen,
  deadline,
  firmActive = true,
  subsidy,
}: QuoteComposerProps) {
  const router = useRouter();
  const editable =
    firmActive &&
    windowOpen &&
    existing?.status !== "accepted" &&
    existing?.status !== "not_selected";

  // Hooks live ABOVE the resting-state returns: `editable` can flip on a
  // mounted composer (window closes, quote gets accepted after a 409 refresh)
  // and an early return before these would change the hook count mid-life.
  const [price, setPrice] = useState(existing ? String(existing.price_usd) : "");
  const [weeks, setWeeks] = useState(existing ? String(existing.duration_weeks) : "");
  const [start, setStart] = useState<Date | null>(
    existing ? new Date(existing.earliest_start) : null,
  );
  const [message, setMessage] = useState(existing?.message ?? "");
  const [dealDoc, setDealDoc] = useState(existing?.deal_doc_url ?? "");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Parsed the same way the save parses it, so the confirm dialog can never
  // quote a different duration than the one about to be written.
  const nextWeeks = parseWholeNumber(weeks);

  // Decided or closed with a quote on file: the form rests (design iteration
  // 2026-07-31). Closed with no quote needs no dead disabled form either.
  if (!editable && existing) return <QuoteSummary quote={existing} subsidy={subsidy} />;
  if (!firmActive && !existing) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-[#A2AFB2]">
        Quoting is disabled while the firm is deactivated. Past quotes stay on record.
      </div>
    );
  }
  if (!editable && !existing) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-[#A2AFB2]">
        The quote window closed{deadline ? ` ${formatIsoDate(deadline)}` : ""} without a quote from
        your firm. New requests keep arriving in your inbox.
      </div>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const submit = async () => {
    // Thousands separators are how people write prices; parsing them by hand
    // is what turned "12,500" into 12.
    const priceUsd = parseWholeNumber(price);
    const durationWeeks = parseWholeNumber(weeks);
    if (!priceUsd || priceUsd < 1) return toast.error("Enter a price in whole US dollars.");
    if (!durationWeeks || durationWeeks < 1) return toast.error("Enter the duration in weeks.");
    // The server caps a quote at a year. Say so here rather than letting the
    // request come back as a bare "Validation failed".
    if (durationWeeks > MAX_QUOTE_WEEKS) {
      return toast.error(`A quote can run at most ${MAX_QUOTE_WEEKS} weeks (one year).`);
    }
    if (!start) return toast.error("Pick the earliest start date.");
    if (!message.trim()) return toast.error("A message to the project is required.");

    setBusy(true);
    try {
      const res = await fetch(`/api/audits/portal/requests/${requestId}/quote`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price_usd: priceUsd,
          duration_weeks: durationWeeks,
          earliest_start: start.toISOString(),
          message: message.trim(),
          deal_doc_url: dealDoc.trim() || null,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "We couldn't save your quote.");
        if (res.status === 409) router.refresh();
        return;
      }
      toast.success(body.updated ? "Quote updated." : "Quote sent.");
      // Back to the inbox, where the card carries "You quoted $X" as durable
      // proof. A toast is the only confirmation a firm gets otherwise, and a
      // missed toast leaves them unsure the quote landed.
      router.push("/audits/portal");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#1F1F1F]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Your quote</h2>
        <span className={MONO_LABEL_META}>Private · project + admins only</span>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="quote-price">
            Price, USD <span className="text-brand">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
              $
            </span>
            <Input
              id="quote-price"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              inputMode="numeric"
              disabled={!editable || busy}
              className="h-11 pl-7"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="quote-weeks">
              Duration <span className="text-brand">*</span>
            </label>
            <div className="relative">
              <Input
                id="quote-weeks"
                value={weeks}
                // inputMode is only a mobile keyboard hint, so letters were
                // typeable on desktop. A duration is digits, nothing else.
                onChange={(event) => setWeeks(event.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                disabled={!editable || busy}
                className="h-11 pr-16"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                weeks
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              Earliest start <span className="text-brand">*</span>
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!editable || busy}
                  className={cn(
                    "h-11 w-full justify-start font-normal",
                    !start && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon aria-hidden className="mr-2 h-4 w-4" />
                  {start ? formatIsoDate(start) : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  // Same calendar-date discipline as the wizard picker: what
                  // the firm picks is the day the project sees.
                  selected={start ? fromUtcCalendarDate(start) : undefined}
                  onSelect={(date) => setStart(date ? toUtcCalendarDate(date) : null)}
                  disabled={(date) => date < today}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="quote-message">
            Message to the project <span className="text-brand">*</span>
          </label>
          <Textarea
            id="quote-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            disabled={!editable || busy}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Team, methodology, what&apos;s included. This carries the nuance the three numbers
            can&apos;t.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="quote-deal-doc">
            Proposal link <span className="font-normal text-muted-foreground">· optional</span>
          </label>
          <Input
            id="quote-deal-doc"
            value={dealDoc}
            onChange={(event) => setDealDoc(event.target.value)}
            // Normalized on blur so a pasted bare domain still resolves.
            onBlur={(event) => setDealDoc(String(normalizeUrlInput(event.target.value)))}
            inputMode="url"
            placeholder="docs.google.com/document/..."
            disabled={!editable || busy}
            className="h-11"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Your own scoping doc or SOW, if you have one. The project sees it beside your quote.
          </p>
        </div>

        {/* Send quote at thumb reach below lg (board 1g); in-card from lg up. */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-4 py-2.5 backdrop-blur dark:border-white/10 dark:bg-[#1F1F1F]/95 lg:static lg:border-t-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none dark:lg:bg-transparent">
          <Button
            disabled={!editable || busy}
            // A first send is what the firm came here to do; REPLACING a
            // price already on the project's desk is the one that deserves a
            // second tap.
            onClick={() => (existing ? setConfirming(true) : void submit())}
            className="audits-sweep h-11 w-full bg-brand text-white"
          >
            {busy ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
            {existing ? "Update quote" : "Send quote"}
          </Button>
        </div>

        {/* Parsed here so the dialog quotes the same number the save will
            send, separators and all. */}
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent className={AUDITS_DIALOG}>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace your quote?</AlertDialogTitle>
              <AlertDialogDescription>
                {existing
                  ? `The project currently sees ${formatUsd(existing.price_usd)} over ${weeksLabel(existing.duration_weeks)}. Saving replaces it with ${formatUsd(parseWholeNumber(price) ?? 0)}${nextWeeks === null ? "" : ` over ${weeksLabel(nextWeeks)}`}.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep the current quote</AlertDialogCancel>
              <AlertDialogAction
                className="bg-brand text-white hover:bg-brand-deep"
                onClick={() => void submit()}
              >
                Replace it
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {editable
            ? `Editable until the window closes${deadline ? ` ${formatIsoDate(deadline)}` : ""}. Your quote is private to the requesting project and the program team.`
            : existing?.status === "accepted"
              ? "This quote was accepted. The engagement continues off-platform."
              : `The window closed${deadline ? ` ${formatIsoDate(deadline)}` : ""}. Quotes can no longer be edited.`}
        </p>
        {/* Clears the fixed mobile CTA bar. */}
        <div aria-hidden className="h-10 lg:hidden" />
      </div>
    </div>
  );
}
