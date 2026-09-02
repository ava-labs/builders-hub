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
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AUDIT_SERVICES, AUDITOR_MEMBER_LIMIT } from "@/lib/audits/constants";
import type { AdminAuditorMember, AdminAuditorRow } from "@/server/services/audits/visibility";
import { ChipGroup, asChips } from "@/components/audits/shared/ChipGroup";
import { AUDITS_DIALOG, MONO_LABEL_META, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { formatIsoDate } from "@/components/audits/shared/format";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
  // Team emails keep the sheet open: this list is the truth while it is open,
  // router.refresh() syncs the table underneath.
  const [members, setMembers] = useState<AdminAuditorMember[]>([]);
  const [memberEmail, setMemberEmail] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  useEffect(() => {
    setFirmName(auditor?.firm_name ?? "");
    setQuoteEmail(auditor?.quote_email ?? "");
    setServices(auditor?.services ?? []);
    setMembers(auditor?.members ?? []);
    setMemberEmail("");
    setConfirmRemoveId(null);
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

  const addMember = async () => {
    if (!auditor) return;
    const email = memberEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/audits/admin/auditors/${auditor.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "That didn't work. Try again.");
        return;
      }
      setMembers((prev) => [
        ...prev,
        {
          id: body.member.id,
          email: body.member.email,
          invited_at: new Date(body.member.invited_at),
          first_login_at: null,
        },
      ]);
      setMemberEmail("");
      toast.success(
        body.inviteSent
          ? `Invite sent to ${email}.`
          : `${email} added. The invite email failed; ask them to sign in directly.`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (member: AdminAuditorMember) => {
    if (!auditor) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/audits/admin/auditors/${auditor.id}/members/${member.id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "That didn't work. Try again.");
        return;
      }
      setMembers((prev) => prev.filter((row) => row.id !== member.id));
      setConfirmRemoveId(null);
      toast.success(`${member.email} removed. They can no longer sign in.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet modal open={state !== null} onOpenChange={(open) => (!open ? onClose() : null)}>
      <SheetContent className={`${AUDITS_DIALOG} flex w-full flex-col gap-0 p-0 sm:max-w-md`}>
        {/* Header band: identity square + name + meta, the Active toggle at hand
            (board 2b; the IcmMessageSheet anatomy). */}
        <SheetHeader className="border-b border-zinc-200 px-4 py-3.5 dark:border-white/10">
          <div className="flex items-center gap-3 pr-8">
            <span
              aria-hidden
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-zinc-100 font-mono text-[11px] font-bold text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
            >
              {auditor ? initialsOf(auditor.firm_name) : "+"}
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-[15px]">
                {auditor ? auditor.firm_name : "Add auditor"}
              </SheetTitle>
              <SheetDescription className={`${MONO_LABEL_META} mt-0.5 normal-case`}>
                {auditor ? (
                  <>
                    On the whitelist since {formatIsoDate(auditor.invited_at)}
                    {auditor.attio_ref ? ` · Attio ref ${auditor.attio_ref}` : ""}
                  </>
                ) : (
                  "Vetted by security first."
                )}
              </SheetDescription>
            </div>
            {auditor ? (
              <label className="flex shrink-0 items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <Switch
                  checked={auditor.active}
                  disabled={busy}
                  onCheckedChange={(next) => void setActive(next)}
                  aria-label={auditor.active ? "Deactivate firm" : "Reactivate firm"}
                  className="data-[state=checked]:bg-brand"
                />
                {auditor.active ? "Active" : "Inactive"}
              </label>
            ) : null}
          </div>
        </SheetHeader>

        {/* Stats band: ink numbers, green WON (all four live on AdminAuditorRow). */}
        {auditor ? (
          <p className="border-b border-zinc-200 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-500 dark:border-white/10 dark:text-zinc-400">
            <span className="font-semibold text-zinc-950 dark:text-zinc-50">{auditor.sent}</span>{" "}
            requests received ·{" "}
            <span className="font-semibold text-zinc-950 dark:text-zinc-50">{auditor.quoted}</span>{" "}
            quoted ·{" "}
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              {auditor.won} won
            </span>
            {auditor.last_quote_at ? ` · last quote ${formatIsoDate(auditor.last_quote_at)}` : ""}
          </p>
        ) : null}

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5">
          <div className={auditor ? "grid gap-4 sm:grid-cols-2" : "space-y-5"}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="auditor-firm-name">
                Firm name <span className="text-brand dark:text-brand-soft">*</span>
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
                Quote email <span className="text-brand dark:text-brand-soft">*</span>
              </label>
              <Input
                id="auditor-quote-email"
                value={quoteEmail}
                onChange={(event) => setQuoteEmail(event.target.value)}
                disabled={Boolean(auditor)}
                inputMode="email"
                className="h-11 font-mono text-[13px] md:h-10"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {auditor
                  ? "The whitelist address · notices go here and to every teammate below."
                  : "OTP sign-in links and fan-out emails go here."}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              Services{" "}
              <span className="font-normal text-zinc-500 dark:text-zinc-400">
                {auditor
                  ? "· shown on the whitelist table and on quotes"
                  : "· optional now, editable anytime"}
              </span>
            </p>
            <ChipGroup
              multiple
              collapsible={!auditor}
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[10px] border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm dark:border-white/10 dark:bg-white/[0.02]">
              <span
                aria-hidden
                className={
                  auditor.first_login_at
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-amber-700 dark:text-amber-400"
                }
              >
                {auditor.first_login_at ? "✓" : "•"}
              </span>
              <span className="min-w-0 flex-1 text-zinc-600 dark:text-[#A2AFB2]">
                {auditor.first_login_at
                  ? `Invite accepted · first login ${formatIsoDate(auditor.first_login_at)}`
                  : `Invited ${formatIsoDate(auditor.invited_at)} · no login yet`}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void resend()}
                className="shrink-0 cursor-pointer text-sm text-zinc-600 underline underline-offset-2 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Send new OTP link
              </button>
            </div>
          ) : null}

          {/* Team emails (2026-09-02): approved teammate addresses that sign in
              to this firm's portal and receive every notice. Admin-managed. */}
          {auditor ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Team emails{" "}
                <span className="font-normal text-zinc-500 dark:text-zinc-400">
                  · sign in and get every notice, same as the quote email
                </span>
              </p>
              <ul className="divide-y divide-zinc-200 rounded-[10px] border border-zinc-200 dark:divide-white/[0.08] dark:border-white/10">
                {members.length === 0 ? (
                  <li className="px-3.5 py-2.5 text-sm text-zinc-500 dark:text-zinc-400">
                    No teammates yet · only the quote email can sign in.
                  </li>
                ) : (
                  members.map((member) => (
                    <li key={member.id} className="flex items-center gap-3 px-3.5 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                        {member.email}
                      </span>
                      <span className={MONO_LABEL_META}>
                        {member.first_login_at
                          ? "active"
                          : `invited ${formatIsoDate(member.invited_at)}`}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          confirmRemoveId === member.id
                            ? void removeMember(member)
                            : setConfirmRemoveId(member.id)
                        }
                        className="shrink-0 cursor-pointer text-xs text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        {confirmRemoveId === member.id ? "Confirm remove" : "Remove"}
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void addMember();
                }}
              >
                <Input
                  aria-label="Teammate email"
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  placeholder="teammate@firm.com"
                  inputMode="email"
                  className="h-11 font-mono text-[13px] md:h-10"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={busy || !memberEmail.trim() || members.length >= AUDITOR_MEMBER_LIMIT}
                  className="h-11 shrink-0 md:h-10"
                >
                  Add and invite
                </Button>
              </form>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Each address gets its own OTP invite and code. Up to {AUDITOR_MEMBER_LIMIT} per firm.
                Removing an address revokes its sign-in; quotes and history stay with the firm.
              </p>
            </div>
          ) : null}

          {/* Add mode: the invite lifecycle fills the sheet's quiet middle as
              the guideline's numbered-mono lever (round-3 M3-B). */}
          {auditor ? null : (
            <div className="mt-6">
              <p className={MONO_LABEL_SM}>What happens next</p>
              <div className="mt-1">
                {(
                  [
                    ["01", "OTP invite goes to the quote email", "On add"],
                    ["02", "First sign-in stamps the firm as active", "First login"],
                    ["03", "Every new request fans out to them", "From now on"],
                  ] as const
                ).map(([num, line, when], index) => (
                  <div
                    key={num}
                    className={
                      index > 0
                        ? "flex items-baseline justify-between gap-3 border-t border-zinc-200 py-2.5 text-sm dark:border-white/[0.08]"
                        : "flex items-baseline justify-between gap-3 py-2.5 text-sm"
                    }
                  >
                    <span className="min-w-0">
                      <span className="font-mono text-xs font-semibold text-brand">{num}</span>
                      <span className="ml-2.5 text-zinc-700 dark:text-zinc-300">{line}</span>
                    </span>
                    <span className={MONO_LABEL_META}>{when}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pinned footer: destructive LEFT, primary RIGHT (board 2b). */}
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-white/10">
          {auditor ? (
            <div className="flex items-center gap-2.5">
              {auditor.active ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={busy}
                      variant="outline"
                      className="border-brand-deep/35 text-brand-deep hover:bg-brand-deep/5 hover:text-brand-deep dark:border-brand-soft/35 dark:text-brand-soft dark:hover:bg-brand-soft/10 dark:hover:text-brand-soft"
                    >
                      Deactivate…
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className={AUDITS_DIALOG}>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Deactivate {auditor.firm_name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Deactivating stops future fan-outs; history and past quotes stay intact.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep active</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => void setActive(false)}
                        className="border border-brand-deep/35 bg-transparent text-brand-deep shadow-none hover:bg-brand-deep/5 dark:border-brand-soft/35 dark:text-brand-soft dark:hover:bg-brand-soft/10"
                      >
                        Deactivate
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : null}
              <span className="flex-1" />
              <Button disabled={busy} variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={busy || !firmName.trim()} onClick={() => void save()}>
                Save changes
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
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
