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
import { cn } from "@/lib/utils";
import type { AdminAuditorRow } from "@/server/services/audits/visibility";
import { formatIsoDate } from "@/components/audits/shared/format";
import {
  AuditorDetailPanel,
  type PanelState,
} from "@/components/audits/admin/AuditorDetailPanel";

function StatusCell({
  auditor,
  onResend,
}: {
  auditor: AdminAuditorRow;
  onResend: (auditor: AdminAuditorRow) => void;
}) {
  if (!auditor.active) {
    return <span className="text-zinc-400 dark:text-zinc-500">Inactive</span>;
  }
  if (!auditor.first_login_at) {
    return (
      <span className="text-amber-600 dark:text-amber-400">
        Invited {formatIsoDate(auditor.invited_at)} ·{" "}
        <button
          type="button"
          className="cursor-pointer underline underline-offset-2"
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
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
      Active
    </span>
  );
}

/** Whitelist table (design 1c): row click opens the detail panel. */
export function AuditorsManager({ auditors }: { auditors: AdminAuditorRow[] }) {
  const router = useRouter();
  const [panel, setPanel] = useState<PanelState>(null);

  const counts = {
    active: auditors.filter((a) => a.active && a.first_login_at).length,
    invited: auditors.filter((a) => a.active && !a.first_login_at).length,
    inactive: auditors.filter((a) => !a.active).length,
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
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {counts.active} active · {counts.invited} invited · {counts.inactive} inactive
          </p>
        </div>
        <Button onClick={() => setPanel({ mode: "add" })} className="h-11 md:h-10">
          Add auditor
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Firm</TableHead>
              <TableHead>Quote contact</TableHead>
              <TableHead>Services</TableHead>
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Won</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditors.map((auditor) => (
              <TableRow
                key={auditor.id}
                onClick={() => setPanel({ mode: "edit", auditor })}
                className={cn("cursor-pointer", !auditor.active && "opacity-60")}
              >
                <TableCell className="font-medium">{auditor.firm_name}</TableCell>
                <TableCell className="font-mono text-xs">{auditor.quote_email}</TableCell>
                <TableCell className="max-w-56">
                  <span className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {auditor.services.join(", ") || "·"}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{auditor.sent}</TableCell>
                <TableCell className="text-right tabular-nums">{auditor.won}</TableCell>
                <TableCell className="text-sm">
                  <StatusCell auditor={auditor} onResend={(a) => void resend(a)} />
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
