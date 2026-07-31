"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { SUBSIDY_MAX_PCT, SUBSIDY_PCT_STEP } from "@/lib/audits/subsidy";
import { BlocksArt } from "@/components/audits/shared/BlocksArt";
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { formatUsd } from "@/components/audits/shared/format";

interface SubsidyWorksheetProps {
  requestId: string;
  firmName: string;
  priceUsd: number;
  latest: { state: string; pct: number; program_amount_usd: number; decided_at: Date } | null;
}

/**
 * The brand-tone moment (design 1b): caps statement over ONE framed
 * instrument · pick / dollar-primary control / program share on the red wash /
 * project share. Red stays on exactly two things, the slider accent and the
 * approve CTA. Decisions are append-only; a new one supersedes the last at
 * read time.
 */
export function SubsidyWorksheet({ requestId, firmName, priceUsd, latest }: SubsidyWorksheetProps) {
  const router = useRouter();
  // The exact dollar amount is the source of truth (Federico 2026-07-30);
  // slider and percent are two views onto it.
  const cap = Math.floor((priceUsd * SUBSIDY_MAX_PCT) / 100);
  const [amount, setAmount] = useState(
    latest?.state === "approved" ? Math.min(cap, latest.program_amount_usd) : 0,
  );
  const [busy, setBusy] = useState(false);
  const pct = priceUsd > 0 ? Math.round((amount / priceUsd) * 100) : 0;
  const setFromPct = (nextPct: number) =>
    setAmount(Math.min(cap, Math.round((priceUsd * nextPct) / 100)));

  const decide = async (state: "approved" | "declined") => {
    setBusy(true);
    try {
      const res = await fetch(`/api/audits/admin/requests/${requestId}/subsidy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, program_amount_usd: amount }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "We couldn't record the decision.");
        return;
      }
      toast.success(state === "approved" ? `Approved a ${pct}% subsidy.` : "Subsidy declined.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${CARD} relative overflow-hidden p-5`}>
      <BlocksArt size="sm" variant="corner" className="absolute right-0 top-0" />
      <p className={MONO_LABEL_SM}>Subsidy worksheet</p>
      <p className="v2-display mt-2 max-w-[16ch] text-lg text-zinc-950 dark:text-zinc-50">
        The program can pay up to 75%.
      </p>

      {latest ? (
        <p className="mt-3 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
          Latest decision: {latest.state}
          {latest.state === "approved"
            ? ` ${formatUsd(latest.program_amount_usd)} (${latest.pct}%)`
            : ""}{" "}
          · a new decision supersedes it.
        </p>
      ) : null}

      {/* One framed instrument (board 1b): every number lives in these rows. */}
      <div className="mt-4 overflow-hidden rounded-[10px] border border-zinc-200 dark:border-white/10">
        <div className="flex items-baseline justify-between gap-3 px-3.5 py-2.5 text-sm">
          <span className="text-zinc-600 dark:text-[#A2AFB2]">Project&apos;s pick</span>
          <span className="font-mono text-[13px] font-semibold">
            {firmName} · {formatUsd(priceUsd)}
          </span>
        </div>

        <div className="border-t border-zinc-200 px-3.5 py-3 dark:border-white/[0.08]">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm text-zinc-600 dark:text-[#A2AFB2]" htmlFor="subsidy-amount">
              Program pays · type or drag
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-zinc-500">$</span>
              <Input
                id="subsidy-amount"
                value={String(amount)}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value.replaceAll(",", ""), 10);
                  setAmount(Number.isNaN(next) ? 0 : Math.max(0, Math.min(cap, next)));
                }}
                inputMode="numeric"
                aria-label="Program amount in US dollars"
                className="h-9 w-24 px-2 text-right font-mono font-semibold tabular-nums"
              />
              <Input
                value={String(pct)}
                onChange={(event) => {
                  const next = Number.parseInt(event.target.value, 10);
                  setFromPct(
                    Number.isNaN(next) ? 0 : Math.max(0, Math.min(SUBSIDY_MAX_PCT, next)),
                  );
                }}
                inputMode="numeric"
                aria-label="Program share percentage"
                className="h-9 w-12 px-2 text-right font-mono tabular-nums"
              />
              <span className="text-sm text-zinc-500">%</span>
            </div>
          </div>
          <Slider
            value={[pct]}
            onValueChange={(value) => setFromPct(value[0] ?? 0)}
            max={SUBSIDY_MAX_PCT}
            step={SUBSIDY_PCT_STEP}
            aria-label="Program share percentage"
            className="mt-3 [&_[data-slot=slider-range]]:bg-brand [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 max-md:[&_[role=slider]]:h-11 max-md:[&_[role=slider]]:w-11"
          />
          <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            <span>0%</span>
            <span>25</span>
            <span>50</span>
            <span className="text-zinc-900 dark:text-zinc-100">Cap 75%</span>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Any share up to the cap · the split below updates as you drag.
          </p>
        </div>

        <div className="flex items-baseline justify-between gap-3 border-t border-zinc-200 bg-brand/5 px-3.5 py-2.5 text-sm dark:border-white/[0.08]">
          <span className="text-zinc-600 dark:text-[#A2AFB2]">Program pays</span>
          <span className="font-mono text-base font-bold tabular-nums">{formatUsd(amount)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm dark:border-white/[0.08] dark:bg-white/[0.02]">
          <span className="text-zinc-600 dark:text-[#A2AFB2]">Project pays</span>
          <span className="font-mono text-base font-bold tabular-nums">
            {formatUsd(priceUsd - amount)}
          </span>
        </div>
      </div>
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        Cap: {formatUsd(cap)} ({SUBSIDY_MAX_PCT}% of the accepted price).
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <Button
          disabled={busy}
          onClick={() => void decide("approved")}
          className="audits-sweep h-11 bg-brand text-white"
        >
          Approve {formatUsd(amount)} ({pct}%)
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => void decide("declined")}>
          Decline subsidy
        </Button>
      </div>

      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Logged with your name on the request activity trail. The payment itself happens
        off-platform.
      </p>
    </div>
  );
}
