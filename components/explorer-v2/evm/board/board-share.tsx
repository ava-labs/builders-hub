"use client";

/* A board's link, and where its boards are kept: this browser, or the
   reader's account. */

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import type { SyncState } from "@/lib/explorer-query/board-sync";
import { btn, primary, useCopied } from "./parts";

/** a board's link, for anyone; signed out, the way to an account that keeps it */
export function ShareBoard({ link, sync, disabled }: { link: string; sync: SyncState; disabled: boolean }) {
  const [copied, copy] = useCopied();
  const [open, setOpen] = useState(false);
  const { openLoginModal } = useLoginModalTrigger();
  if (sync !== "off")
    return (
      <button type="button" onClick={() => copy(`${window.location.origin}${link}`)} disabled={disabled} title="Anyone with the link can view this board" className={btn}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Link2 className="h-3.5 w-3.5" />} {copied ? "Link copied" : "Share"}
      </button>
    );
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger disabled={disabled} className={btn}>
        <Link2 className="h-3.5 w-3.5" /> Share
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 flex w-64 flex-col gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-3.5 shadow-[0_24px_48px_-20px_rgba(24,24,27,0.4)] backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950/95"
        >
          <p className="text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-300">Sign in to share this board by its link.</p>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openLoginModal(window.location.href);
            }}
            className={cn(primary, "justify-center py-2")}
          >
            Sign in
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** where the boards are kept, in a few words; signed out, a way to sign in */
export function SyncNote({ sync, long = false }: { sync: SyncState; long?: boolean }) {
  if (sync === "off") {
    return (
      <>
        {long ? "Kept in this browser. " : "on this device · "}
        <SignInToSync inline label={long ? "Sign in to keep them in your Builder Hub account" : "sign in to sync"} />
        {long && "."}
      </>
    );
  }
  if (sync === "loading") return <span>{long ? "Syncing with your account." : "syncing"}</span>;
  if (sync === "error") return <span className="text-amber-600 dark:text-amber-500">{long ? "Could not reach your account; changes stay in this browser and sync when it is back." : "not synced, kept here"}</span>;
  return <span>{long ? "Synced to your Builder Hub account. Anyone with a board's link can view it." : "synced to your account"}</span>;
}

export function SignInToSync({ inline = false, label = "Sign in to sync boards" }: { inline?: boolean; label?: string }) {
  const { openLoginModal } = useLoginModalTrigger();
  return (
    <button
      type="button"
      onClick={() => openLoginModal(typeof window !== "undefined" ? window.location.href : undefined)}
      className={inline ? "underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-900 dark:decoration-zinc-700 dark:hover:text-zinc-100" : btn}
    >
      {label}
    </button>
  );
}
