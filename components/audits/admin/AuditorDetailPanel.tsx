"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AUDIT_SERVICES } from "@/lib/audits/constants";
import type { AdminAuditorRow } from "@/server/services/audits/visibility";
import { ChipGroup, asChips } from "@/components/audits/shared/ChipGroup";
import { formatIsoDate } from "@/components/audits/shared/format";

export type PanelState = { mode: "add" } | { mode: "edit"; auditor: AdminAuditorRow } | null;

interface AuditorDetailPanelProps {
  state: PanelState;
  onClose: () => void;
}

/**
 * The auditor detail panel (design 2b): row click opens edit mode, the Add
 * auditor button opens the same panel in add mode. Services use the wizard's
 * category list and are informational only; they never gate fan-out.
 */
export function AuditorDetailPanel({ state, onClose }: AuditorDetailPanelProps) {
  const router = useRouter();
  const auditor = state?.mode === "edit" ? state.auditor : null;
  const [firmName, setFirmName] = useState("");
  const [quoteEmail, setQuoteEmail] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFirmName(auditor?.firm_name ?? "");
    setQuoteEmail(auditor?.quote_email ?? "");
    setServices(auditor?.services ?? []);
  }, [auditor, state?.mode]);

  const finish = (message: string) => {
    toast.success(message);
    onClose();
    router.refresh();
  };

  const call = async (input: RequestInfo, init: RequestInit, ok: string) => {
    setBusy(true);
    try {
      const res = await fetch(input, init);
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "That didn't work. Try again.");
        return null;
      }
      finish(ok);
      return body;
    } finally {
      setBusy(false);
    }
  };

  const add = async () => {
    const body = await call(
      "/api/audits/admin/auditors",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firm_name: firmName, quote_email: quoteEmail, services }),
      },
      "Firm added.",
    );
    if (body && body.inviteSent === false) {
      toast.warning("The invite email failed to send. Use resend from the firm's row.");
    }
  };

  const save = async () => {
    if (!auditor) return;
    await call(
      `/api/audits/admin/auditors/${auditor.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firm_name: firmName, services }),
      },
      "Saved.",
    );
  };

  const setActive = async (active: boolean) => {
    if (!auditor) return;
    await call(
      `/api/audits/admin/auditors/${auditor.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      },
      active ? "Firm reactivated." : "Firm deactivated. History stays intact.",
    );
  };

  const resend = async () => {
    if (!auditor) return;
    await call(
      `/api/audits/admin/auditors/${auditor.id}/resend-invite`,
      { method: "POST" },
      "OTP invite sent.",
    );
  };

  return (
    <Sheet open={state !== null} onOpenChange={(open) => (!open ? onClose() : null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{auditor ? auditor.firm_name : "Add auditor"}</SheetTitle>
          <SheetDescription>
            {auditor ? (
              <>
                On the whitelist since {formatIsoDate(auditor.invited_at)}
                {auditor.attio_ref ? ` · Attio ref ${auditor.attio_ref}` : ""}
              </>
            ) : (
              "Vetted by security first."
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {auditor ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {auditor.sent} requests received · {auditor.quoted} quoted · {auditor.won} won
              {auditor.last_quote_at ? ` · last quote ${formatIsoDate(auditor.last_quote_at)}` : ""}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="auditor-firm-name">
              Firm name <span className="text-brand">*</span>
            </label>
            <Input
              id="auditor-firm-name"
              value={firmName}
              onChange={(event) => setFirmName(event.target.value)}
              className="h-11 md:h-10"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="auditor-quote-email">
              Quote email <span className="text-brand">*</span>
            </label>
            <Input
              id="auditor-quote-email"
              value={quoteEmail}
              onChange={(event) => setQuoteEmail(event.target.value)}
              disabled={Boolean(auditor)}
              inputMode="email"
              className="h-11 md:h-10"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              OTP sign-in links and fan-out emails go here.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              Services{" "}
              <span className="font-normal text-zinc-500 dark:text-zinc-400">
                {auditor ? "· shown on the whitelist table and on quotes" : "· optional now, editable anytime"}
              </span>
            </p>
            <ChipGroup
              multiple
              options={asChips(AUDIT_SERVICES)}
              value={services}
              onChange={setServices}
              aria-label="Services"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Same category list the project wizard uses. Informational only: every active firm
              still receives every fan-out.
            </p>
          </div>

          {auditor ? (
            <p className="text-sm text-zinc-600 dark:text-[#A2AFB2]">
              {auditor.first_login_at
                ? `Invite accepted · first login ${formatIsoDate(auditor.first_login_at)}`
                : `Invited ${formatIsoDate(auditor.invited_at)} · no login yet`}
            </p>
          ) : null}

          {auditor ? (
            <div className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-white/10">
              <Button disabled={busy || !firmName.trim()} onClick={() => void save()}>
                Save changes
              </Button>
              <Button disabled={busy} variant="outline" onClick={() => void resend()}>
                Send new OTP link
              </Button>
              {auditor.active ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={busy} variant="ghost" className="text-zinc-500">
                      Deactivate…
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Deactivate {auditor.firm_name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Deactivating stops future fan-outs; history and past quotes stay intact.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep active</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void setActive(false)}>
                        Deactivate
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button disabled={busy} variant="ghost" onClick={() => void setActive(true)}>
                  Reactivate
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-white/10">
              <Button
                disabled={busy || !firmName.trim() || !quoteEmail.trim()}
                onClick={() => void add()}
                className="w-full"
              >
                Add and send OTP invite
              </Button>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Sends the sign-in link to the quote email. The firm appears as Invited until first
                login and joins every fan-out from the moment it is added.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
