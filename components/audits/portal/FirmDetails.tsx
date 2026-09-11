"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUDIT_SERVICES, AUDITOR_MEMBER_LIMIT } from "@/lib/audits/constants";
import type { OwnFirm } from "@/server/services/audits/visibility";
import { ChipGroup, asChips } from "@/components/audits/shared/ChipGroup";
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { formatIsoDate, monogramOf } from "@/components/audits/shared/format";
import { DeactivatedBanner } from "@/components/audits/portal/DeactivatedBanner";

type Member = OwnFirm["members"][number];

/**
 * The firm's own self-service page (spec 7.4.3). Any active identity edits
 * services and website; only the quote-email identity manages teammates. Firm
 * name, quote email and active status stay admin-only. Follows the admin
 * panel's write pattern: fetch, toast, optimistic member list, router.refresh.
 */
export function FirmDetails({
  firm,
  isOwner,
  readOnly,
}: {
  firm: OwnFirm;
  isOwner: boolean;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [services, setServices] = useState<string[]>(firm.services);
  const [website, setWebsite] = useState(firm.website ?? "");
  const [members, setMembers] = useState<Member[]>(firm.members);
  const [memberEmail, setMemberEmail] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const locked = busy || readOnly;
  const atCap = members.length >= AUDITOR_MEMBER_LIMIT;

  const saveDetails = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/audits/portal/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ services, website }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "That didn't work. Try again.");
        return;
      }
      toast.success("Saved.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const addMember = async () => {
    const email = memberEmail.trim().toLowerCase();
    if (!email) return;
    if (members.some((m) => m.email === email)) {
      toast.error("This email is already on your team.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/audits/portal/me/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "That didn't work. Try again.");
        return;
      }
      setMembers((prev) => [...prev, body.member as Member]);
      setMemberEmail("");
      toast.success(
        body.inviteSent === false
          ? `Added ${email}. The invite email failed to send.`
          : `Invite sent to ${email}.`,
      );
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (member: Member) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/audits/portal/me/members/${member.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "That didn't work. Try again.");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      setConfirmRemoveId(null);
      toast.success(`${member.email} removed. They can no longer sign in.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="py-10">
      {readOnly ? <DeactivatedBanner /> : null}
      <p className="text-[12.5px] text-zinc-500 dark:text-zinc-400">
        <Link
          href="/audits/portal"
          className="underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Inbox
        </Link>{" "}
        / Firm details
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Firm details</h1>

      <div className="mt-6 space-y-5">
        <div className={cn(CARD, "p-5")}>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-100 font-mono text-sm font-semibold text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
            >
              {monogramOf(firm.firm_name)}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{firm.firm_name}</p>
              <p className="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
                {firm.quote_email}
              </p>
            </div>
          </div>
          <p className={`${MONO_LABEL_SM} mt-4 normal-case`}>
            On the whitelist since {formatIsoDate(firm.invited_at)}
          </p>
          <a
            href="/audits/firms"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            See how you appear on the vetted firms page{" "}
            <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className={cn(CARD, "space-y-5 p-5")}>
          <div className="space-y-2">
            <p className="text-sm font-medium">Services</p>
            <ChipGroup
              multiple
              options={asChips(AUDIT_SERVICES)}
              value={services}
              onChange={locked ? () => {} : setServices}
              aria-label="Services"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Shown on the vetted firms page and on your quotes. Projects may use them to choose
              which firms receive a request.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="firm-website">
              Website
            </label>
            <Input
              id="firm-website"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              disabled={locked}
              placeholder="firm.example"
              inputMode="url"
              className="h-11 font-mono text-[13px] md:h-10"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Shown on the vetted firms page</p>
          </div>
          <div className="flex justify-end">
            <Button disabled={locked} onClick={() => void saveDetails()}>
              Save changes
            </Button>
          </div>
        </div>

        <div className={cn(CARD, "space-y-3 p-5")}>
          <div>
            <p className="text-sm font-medium">
              Team emails{" "}
              <span className="font-normal text-zinc-500 dark:text-zinc-400">
                · sign in and get every notice, same as the quote email
              </span>
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Teammates receive every request this firm receives and can read its full history,
              including project contacts on won requests.
            </p>
          </div>
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
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {member.first_login_at ? "active" : `invited ${formatIsoDate(member.invited_at)}`}
                  </span>
                  {isOwner ? (
                    confirmRemoveId === member.id ? (
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => void removeMember(member)}
                        className="shrink-0 cursor-pointer text-xs text-brand-deep underline underline-offset-2 dark:text-brand-soft"
                      >
                        Confirm remove
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => setConfirmRemoveId(member.id)}
                        className="shrink-0 cursor-pointer text-xs text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                      >
                        Remove
                      </button>
                    )
                  ) : null}
                </li>
              ))
            )}
          </ul>
          {isOwner ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={memberEmail}
                  onChange={(event) => setMemberEmail(event.target.value)}
                  disabled={locked || atCap}
                  placeholder="teammate@firm.example"
                  inputMode="email"
                  className="h-11 flex-1 font-mono text-[13px] md:h-10"
                />
                <Button
                  disabled={locked || atCap || !memberEmail.trim()}
                  onClick={() => void addMember()}
                >
                  Add and invite
                </Button>
              </div>
              {atCap ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  A firm can have up to {AUDITOR_MEMBER_LIMIT} approved emails.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Only {firm.quote_email} can add or remove teammates.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
