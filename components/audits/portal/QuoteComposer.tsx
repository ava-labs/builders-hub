"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { AuditorRequestView } from "@/server/services/audits/visibility";
import { formatIsoDate } from "@/components/audits/shared/format";
import { QuoteSummary } from "@/components/audits/portal/QuoteSummary";

interface QuoteComposerProps {
  requestId: string;
  existing: AuditorRequestView["own_quote"];
  windowOpen: boolean;
  deadline: Date | null;
}

/**
 * Three structured numbers keep quotes comparable downstream; the message
 * carries the nuance. Editable until the window closes; the server enforces
 * the same rule (isQuoteWindowOpen), so this state can only ever be cosmetic.
 */
export function QuoteComposer({ requestId, existing, windowOpen, deadline }: QuoteComposerProps) {
  const router = useRouter();
  const editable = windowOpen && existing?.status !== "accepted" && existing?.status !== "not_selected";

  // Decided or closed with a quote on file: the form rests (design iteration
  // 2026-07-31). Closed with no quote needs no dead disabled form either.
  if (!editable && existing) return <QuoteSummary quote={existing} />;
  if (!editable && !existing) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-[#A2AFB2]">
        The quote window closed{deadline ? ` ${formatIsoDate(deadline)}` : ""} without a quote from
        your firm. New requests keep arriving in your inbox.
      </div>
    );
  }
  const [price, setPrice] = useState(existing ? String(existing.price_usd) : "");
  const [weeks, setWeeks] = useState(existing ? String(existing.duration_weeks) : "");
  const [start, setStart] = useState<Date | null>(
    existing ? new Date(existing.earliest_start) : null,
  );
  const [message, setMessage] = useState(existing?.message ?? "");
  const [reaudit, setReaudit] = useState(existing?.reaudit_included ?? false);
  const [busy, setBusy] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const submit = async () => {
    const priceUsd = Number.parseInt(price, 10);
    const durationWeeks = Number.parseInt(weeks, 10);
    if (!priceUsd || priceUsd < 1) return toast.error("Enter a price in whole US dollars.");
    if (!durationWeeks || durationWeeks < 1) return toast.error("Enter the duration in weeks.");
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
          reaudit_included: reaudit,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "We couldn't save your quote.");
        if (res.status === 409) router.refresh();
        return;
      }
      toast.success(body.updated ? "Quote updated." : "Quote sent.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#1F1F1F]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Your quote</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
          Private · project + admins only
        </span>
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
                onChange={(event) => setWeeks(event.target.value)}
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
                  selected={start ?? undefined}
                  onSelect={(date) => setStart(date ?? null)}
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

        <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 dark:border-white/10">
          <label className="text-sm" htmlFor="quote-reaudit">
            Re-audit of fixes included in this price
          </label>
          <Switch
            id="quote-reaudit"
            checked={reaudit}
            onCheckedChange={setReaudit}
            disabled={!editable || busy}
          />
        </div>

        <Button
          disabled={!editable || busy}
          onClick={() => void submit()}
          className="audits-sweep h-11 w-full bg-brand text-white"
        >
          {busy ? <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" /> : null}
          {existing ? "Update quote" : "Send quote"}
        </Button>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {editable
            ? `Editable until the window closes${deadline ? ` ${formatIsoDate(deadline)}` : ""}. Your quote is private to the requesting project and the program team.`
            : existing?.status === "accepted"
              ? "This quote was accepted. The engagement continues off-platform."
              : `The window closed${deadline ? ` ${formatIsoDate(deadline)}` : ""}. Quotes can no longer be edited.`}
        </p>
      </div>
    </div>
  );
}
