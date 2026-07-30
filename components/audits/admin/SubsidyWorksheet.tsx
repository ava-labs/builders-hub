"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { SUBSIDY_MAX_PCT, SUBSIDY_PCT_STEP } from "@/lib/audits/subsidy";
import { formatUsd } from "@/components/audits/shared/format";

interface SubsidyWorksheetProps {
  requestId: string;
  firmName: string;
  priceUsd: number;
  latest: { state: string; pct: number; decided_at: Date } | null;
}

/**
 * The brand-tone moment (design 1b): caps statement, red slider capped at
 * 75, live program/project split. Decisions are append-only; a new one
 * supersedes the last at read time.
 */
export function SubsidyWorksheet({ requestId, firmName, priceUsd, latest }: SubsidyWorksheetProps) {
  const router = useRouter();
  // The exact dollar amount is the source of truth (Federico 2026-07-30);
  // slider and percent are two views onto it.
  const cap = Math.floor((priceUsd * SUBSIDY_MAX_PCT) / 100);
  const [amount, setAmount] = useState(
    latest?.state === "approved" ? Math.min(cap, Math.round((priceUsd * latest.pct) / 100)) : 0,
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
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-white/10 dark:bg-[#1F1F1F]">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        Subsidy worksheet
      </p>
      <p className="mt-2 text-xl font-black uppercase leading-tight tracking-tight">
        The program can pay
        <br />
        up to 75%.
      </p>
      <p className="mt-3 text-sm text-zinc-600 dark:text-[#A2AFB2]">
        Project&apos;s pick · <span className="font-medium">{firmName}</span> ·{" "}
        {formatUsd(priceUsd)}
      </p>

      {latest ? (
        <p className="mt-2 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-white/5 dark:text-zinc-400">
          Latest decision: {latest.state}
          {latest.state === "approved" ? ` ${latest.pct}%` : ""} · a new decision supersedes it.
        </p>
      ) : null}

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-600 dark:text-[#A2AFB2]">
            Program share · drag or type
          </p>
          <div className="flex items-center gap-1">
            <Input
              value={String(pct)}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value, 10);
                setFromPct(Number.isNaN(next) ? 0 : Math.max(0, Math.min(SUBSIDY_MAX_PCT, next)));
              }}
              inputMode="numeric"
              aria-label="Program share percentage"
              className="h-9 w-14 px-2 text-right text-base font-semibold tabular-nums text-brand dark:text-brand-soft"
            />
            <span className="text-lg font-semibold text-brand dark:text-brand-soft">%</span>
          </div>
        </div>
        <Slider
          value={[pct]}
          onValueChange={(value) => setFromPct(value[0] ?? 0)}
          max={SUBSIDY_MAX_PCT}
          step={SUBSIDY_PCT_STEP}
          aria-label="Program share percentage"
          className="mt-3 [&_[data-slot=slider-range]]:bg-brand [&_[role=slider]]:h-5 [&_[role=slider]]:w-5"
        />
        <div className="mt-1.5 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
          <span>0%</span>
          <span>25</span>
          <span>50</span>
          <span>Cap 75%</span>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Any share up to the cap · the split below updates as you drag.
        </p>
      </div>

      <dl className="mt-4 space-y-1.5 border-t border-zinc-200 pt-4 text-sm dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-zinc-600 dark:text-[#A2AFB2]">Program pays</dt>
          <dd className="flex items-center gap-1">
            <span className="text-zinc-500">$</span>
            <Input
              value={String(amount)}
              onChange={(event) => {
                const next = Number.parseInt(event.target.value.replaceAll(",", ""), 10);
                setAmount(Number.isNaN(next) ? 0 : Math.max(0, Math.min(cap, next)));
              }}
              inputMode="numeric"
              aria-label="Program amount in US dollars"
              className="h-9 w-24 px-2 text-right font-semibold tabular-nums"
            />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-600 dark:text-[#A2AFB2]">Project pays</dt>
          <dd className="font-semibold tabular-nums">{formatUsd(priceUsd - amount)}</dd>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Cap: {formatUsd(cap)} ({SUBSIDY_MAX_PCT}% of the accepted price).
        </p>
      </dl>

      <div className="mt-5 flex flex-col gap-2">
        <Button
          disabled={busy}
          onClick={() => void decide("approved")}
          className="h-11 bg-brand text-white hover:bg-brand-deep"
        >
          Approve {formatUsd(amount)} subsidy
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
