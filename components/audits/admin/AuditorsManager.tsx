"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MONO_LABEL_META, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import type { AdminAuditorRow } from "@/server/services/audits/visibility";
import { formatIsoDate } from "@/components/audits/shared/format";
import {
  AuditorDetailPanel,
  type PanelState,
} from "@/components/audits/admin/AuditorDetailPanel";

const PILL = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium";
const DOT = <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />;

function StatusCell({
  auditor,
  active,
  onResend,
}: {
  auditor: AdminAuditorRow;
  active: boolean;
  onResend: (auditor: AdminAuditorRow) => void;
}) {
  if (!active) {
    return (
      <span className={cn(PILL, "border-zinc-300 text-zinc-500 dark:border-white/15 dark:text-zinc-500")}>
        {DOT}
        Inactive
      </span>
    );
  }
  if (!auditor.first_login_at) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className={cn(PILL, "border-amber-600/35 text-amber-700 dark:border-amber-400/35 dark:text-amber-400")}>
          {DOT}
          Invited {formatIsoDate(auditor.invited_at)}
        </span>
        <button
          type="button"
          className="cursor-pointer text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          onClick={(event) => {
            event.stopPropagation();
            onResend(auditor);
          }}
        >
          resend
        </button>
      </span>
    );
  }
  return (
    <span className={cn(PILL, "border-emerald-600/35 text-emerald-700 dark:border-emerald-400/35 dark:text-emerald-400")}>
      {DOT}
      Active
    </span>
  );
}

/** Whitelist table (design 1c): row click opens the detail panel. */
export function AuditorsManager({ auditors }: { auditors: AdminAuditorRow[] }) {
  const router = useRouter();
  const [panel, setPanel] = useState<PanelState>(null);
  // Optimistic active flips: the switch answers instantly, the server confirms
  // via router.refresh(); an entry expires once props agree with it.
  const [pendingActive, setPendingActive] = useState<Record<string, boolean>>({});

  const effectiveActive = (auditor: AdminAuditorRow) =>
    auditor.id in pendingActive && pendingActive[auditor.id] !== auditor.active
      ? pendingActive[auditor.id]
      : auditor.active;

  const counts = {
    active: auditors.filter((a) => a.active && a.first_login_at).length,
    invited: auditors.filter((a) => a.active && !a.first_login_at).length,
    inactive: auditors.filter((a) => !a.active).length,
  };

  const setActive = async (auditor: AdminAuditorRow, active: boolean) => {
    setPendingActive((prev) => ({ ...prev, [auditor.id]: active }));
    const res = await fetch(`/api/audits/admin/auditors/${auditor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      setPendingActive((prev) => ({ ...prev, [auditor.id]: auditor.active }));
      toast.error(body?.message ?? "That didn't work. Try again.");
      return;
    }
    toast.success(
      active
        ? `${auditor.firm_name} reactivated.`
        : `${auditor.firm_name} deactivated. History and past quotes stay intact.`,
    );
    router.refresh();
  };

  const resend = async (auditor: AdminAuditorRow) => {
    const res = await fetch(`/api/audits/admin/auditors/${auditor.id}/resend-invite`, {
      method: "POST",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) {
      toast.error(body?.message ?? "Resend failed.");
      return;
    }
    toast.success(`OTP invite sent to ${auditor.quote_email}.`);
    router.refresh();
  };

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Auditor whitelist</h2>
          <p className={`${MONO_LABEL_META} mt-1`}>
            {counts.active} active · {counts.invited} invited · {counts.inactive} inactive
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="h-11 md:h-10">
            <a href="/api/audits/admin/auditors/export" target="_self">Export CSV</a>
          </Button>
          {/* The whitelist's primary action carries the brand treatment
              (round-3 M3-A): the page's one red CTA, sweep on hover, and the
              plus pops a quarter turn with it. */}
          <Button
            onClick={() => setPanel({ mode: "add" })}
            className="audits-sweep group h-11 bg-brand text-white md:h-10"
          >
            <Plus
              aria-hidden
              className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90"
            />
            Add auditor
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-200 bg-zinc-50 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.02]">
              <TableHead className={cn(MONO_LABEL_SM, "px-4")}>Firm</TableHead>
              <TableHead className={MONO_LABEL_SM}>Quote contact</TableHead>
              <TableHead className={MONO_LABEL_SM}>Services</TableHead>
              <TableHead className={cn(MONO_LABEL_SM, "text-right")}>Sent</TableHead>
              <TableHead className={cn(MONO_LABEL_SM, "text-right")}>Won</TableHead>
              <TableHead className={MONO_LABEL_SM}>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditors.map((auditor) => (
              <TableRow
                key={auditor.id}
                onClick={() => setPanel({ mode: "edit", auditor })}
                className={cn(
                  "cursor-pointer border-zinc-200 hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/[0.03]",
                  !effectiveActive(auditor) && "opacity-60",
                )}
              >
                <TableCell className="font-medium">{auditor.firm_name}</TableCell>
                <TableCell className="font-mono text-xs">
                  {auditor.quote_email}
                  {auditor.members.length > 0 ? (
                    <span className={`${MONO_LABEL_META} ml-2`}>+{auditor.members.length} team</span>
                  ) : null}
                </TableCell>
                <TableCell className="max-w-56">
                  <span
                    title={auditor.services.join(", ") || undefined}
                    className="block truncate text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    {auditor.services.join(", ") || "·"}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{auditor.sent}</TableCell>
                <TableCell className="text-right tabular-nums">{auditor.won}</TableCell>
                <TableCell className="text-sm" onClick={(event) => event.stopPropagation()}>
                  <span className="flex items-center gap-2.5">
                    <Switch
                      checked={effectiveActive(auditor)}
                      onCheckedChange={(next) => void setActive(auditor, next)}
                      aria-label={`${effectiveActive(auditor) ? "Deactivate" : "Activate"} ${auditor.firm_name}`}
                    />
                    <StatusCell
                      auditor={auditor}
                      active={effectiveActive(auditor)}
                      onResend={(a) => void resend(a)}
                    />
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        Deactivating stops future fan-outs; history and past quotes stay intact.
      </p>

      <AuditorDetailPanel state={panel} onClose={() => setPanel(null)} />
    </div>
  );
}
