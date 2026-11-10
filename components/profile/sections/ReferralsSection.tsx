"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, QrCode, X } from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  referralKindTag,
  referralSignature,
  referralTargetGroups,
  shareUrlDisplay,
  totalSignupsOf,
  visibleReferralLinks,
} from "./model";
import type { ReferralLink, ReferralTarget } from "./types";
import {
  Button,
  EmptyState,
  ErrorLine,
  FOCUS,
  Group,
  MONO_LABEL,
  Row,
  SectionHeader,
  SkeletonRows,
  Stack,
  Tag,
} from "../ui";

export type { ReferralLink, ReferralTarget } from "./types";

const COPIED_MS = 1800;

export function ReferralsSection({
  links,
  targets,
  totalSignups,
  loading = false,
  failed = false,
  onRetry,
  onCreate,
  onCopy,
}: {
  /** the links the user owns */
  links: ReferralLink[];
  /** the destinations the user can make a link for */
  targets: ReferralTarget[];
  /** the signups the server counted; else the sum of the shown links */
  totalSignups?: number;
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  /** makes the link and reports its own errors; the section waits for it */
  onCreate: (target: ReferralTarget) => Promise<void> | void;
  /** called after the link is on the clipboard */
  onCopy?: (link: ReferralLink) => void;
}) {
  const [creatingKey, setCreatingKey] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [qrId, setQrId] = React.useState<string | null>(null);
  const [qrOpen, setQrOpen] = React.useState(false);
  const copiedTimer = React.useRef<number | undefined>(undefined);
  const qrTrigger = React.useRef<HTMLButtonElement | null>(null);
  const copyButtons = React.useRef(new Map<string, HTMLButtonElement>());
  const makeButtons = React.useRef(new Map<string, HTMLButtonElement>());
  const focusAfterCreate = React.useRef<{ key: string; signature: string } | null>(null);

  const visible = React.useMemo(() => visibleReferralLinks(links, targets), [links, targets]);
  const groups = React.useMemo(() => referralTargetGroups(targets, visible), [targets, visible]);
  const total = totalSignupsOf(visible, totalSignups);
  // the dialog keeps its link while it fades out
  const qrLink = qrId ? (links.find((l) => l.id === qrId) ?? null) : null;

  React.useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  // The busy Make link button loses the focus. A new link replaces that
  // button, so the focus moves to the new link's Copy button. When no link
  // comes (onCreate failed), the focus goes back to the Make link button.
  React.useEffect(() => {
    const pending = focusAfterCreate.current;
    if (!pending) return;
    const copyButton = copyButtons.current.get(pending.signature);
    if (copyButton) {
      focusAfterCreate.current = null;
      copyButton.focus();
    } else if (creatingKey === null) {
      focusAfterCreate.current = null;
      makeButtons.current.get(pending.key)?.focus();
    }
  }, [visible, creatingKey]);

  const copy = async (link: ReferralLink) => {
    try {
      await navigator.clipboard.writeText(link.shareUrl);
    } catch {
      sonnerToast.error("Could not copy the link");
      return;
    }
    setCopiedId(link.id);
    onCopy?.(link);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopiedId(null), COPIED_MS);
  };

  const create = async (target: ReferralTarget) => {
    focusAfterCreate.current = { key: target.key, signature: referralSignature(target) };
    setCreatingKey(target.key);
    try {
      await onCreate(target);
    } finally {
      setCreatingKey(null);
    }
  };

  const openQr = (link: ReferralLink, trigger: HTMLButtonElement) => {
    qrTrigger.current = trigger;
    setQrId(link.id);
    setQrOpen(true);
  };

  let linksBody: React.ReactNode;
  if (failed) {
    linksBody = <ErrorLine onRetry={onRetry}>Could not load your links.</ErrorLine>;
  } else if (loading) {
    linksBody = (
      // one child, so the group's row divider draws no second line under the label strip
      <div>
        <span role="status" className="sr-only">
          Loading your links
        </span>
        <SkeletonRows rows={3} />
      </div>
    );
  } else {
    linksBody = (
      <>
        <Row label="Total signups">
          <span className="font-mono text-[15px] font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
            {total.toLocaleString("en-US")}
          </span>
        </Row>
        {visible.length === 0 ? (
          <EmptyState>{groups.length > 0 ? "No links yet. Make one below." : "No links yet."}</EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {visible.map((l) => (
              <LinkRow
                key={l.id}
                link={l}
                copied={copiedId === l.id}
                onCopy={() => void copy(l)}
                onQr={(trigger) => openQr(l, trigger)}
                copyRef={(el) => {
                  const signature = referralSignature(l);
                  if (el) copyButtons.current.set(signature, el);
                  else copyButtons.current.delete(signature);
                }}
              />
            ))}
          </ul>
        )}
      </>
    );
  }

  return (
    <>
      <SectionHeader eyebrow="Account" title="Referrals" id="section-title" />
      <Stack>
        <Group label="Your links">{linksBody}</Group>

        {!failed && (
          <Group label="Make a link">
            {loading ? (
              <SkeletonRows rows={2} />
            ) : groups.length === 0 ? (
              <EmptyState>You have a link for each destination.</EmptyState>
            ) : (
              groups.map((g) => (
                <Row key={g.type} label={g.label} align="start">
                  <ul aria-label={g.label} className="flex flex-col gap-3">
                    {g.targets.map((t) => (
                      <li key={t.key} className="flex min-h-10 items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-zinc-900 dark:text-zinc-100">{t.label}</p>
                          {t.detail && (
                            <p className="truncate text-[12px] text-zinc-500 dark:text-zinc-400">{t.detail}</p>
                          )}
                        </div>
                        <Button
                          ref={(el) => {
                            if (el) makeButtons.current.set(t.key, el);
                            else makeButtons.current.delete(t.key);
                          }}
                          busy={creatingKey === t.key}
                          disabled={creatingKey !== null && creatingKey !== t.key}
                          aria-label={`Make link for ${t.label}`}
                          onClick={() => void create(t)}
                        >
                          Make link
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Row>
              ))
            )}
          </Group>
        )}
      </Stack>

      <QrDialog
        link={qrLink}
        open={qrOpen && qrLink !== null}
        onOpenChange={setQrOpen}
        copied={qrLink !== null && copiedId === qrLink.id}
        onCopy={() => qrLink && void copy(qrLink)}
        onCloseAutoFocus={(e) => {
          // no DialogTrigger: give the focus back to the QR button by hand
          e.preventDefault();
          qrTrigger.current?.focus();
        }}
      />
    </>
  );
}

function LinkRow({
  link,
  copied,
  onCopy,
  onQr,
  copyRef,
}: {
  link: ReferralLink;
  copied: boolean;
  onCopy: () => void;
  onQr: (trigger: HTMLButtonElement) => void;
  copyRef: (el: HTMLButtonElement | null) => void;
}) {
  const kind = referralKindTag(link.targetType);
  const signups = link.signups ?? 0;
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-6 sm:px-5">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="min-w-0 truncate text-[14px] font-medium text-zinc-900 dark:text-zinc-100">
            {link.targetLabel}
          </span>
          {kind && <Tag>{kind}</Tag>}
        </div>
        <p className="mt-1 truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400" title={link.shareUrl}>
          {shareUrlDisplay(link.shareUrl)}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <p className="whitespace-nowrap font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400">
          <span className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
            {signups.toLocaleString("en-US")}
          </span>{" "}
          {signups === 1 ? "signup" : "signups"}
        </p>
        <div className="flex gap-2">
          <Button
            aria-label={`Show QR code for ${link.targetLabel}`}
            aria-haspopup="dialog"
            onClick={(e) => onQr(e.currentTarget)}
          >
            <QrCode aria-hidden className="h-3.5 w-3.5" />
            QR code
          </Button>
          <Button
            ref={copyRef}
            aria-label={copied ? `Copied link for ${link.targetLabel}` : `Copy link for ${link.targetLabel}`}
            onClick={onCopy}
            className="min-w-[6.5rem]"
          >
            {copied ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
    </li>
  );
}

/** the link as a QR code, in a square sheet with the group's label strip */
function QrDialog({
  link,
  open,
  onOpenChange,
  copied,
  onCopy,
  onCloseAutoFocus,
}: {
  link: ReferralLink | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  copied: boolean;
  onCopy: () => void;
  onCloseAutoFocus: (e: Event) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        onCloseAutoFocus={onCloseAutoFocus}
        className="gap-0 rounded-none border-zinc-200 bg-white p-0 shadow-none sm:max-w-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        {link && (
          <>
            <div className="flex min-h-10 items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/80 py-1 pl-4 pr-1.5 sm:pl-5 dark:border-zinc-800 dark:bg-zinc-900/40">
              <DialogTitle
                className={cn(MONO_LABEL, "min-w-0 truncate leading-normal text-zinc-500 dark:text-zinc-400")}
              >
                QR code<span className="sr-only"> for {link.targetLabel}</span>
              </DialogTitle>
              <DialogClose asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                    FOCUS,
                  )}
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </DialogClose>
            </div>
            <div className="flex flex-col items-center gap-4 px-4 py-6 sm:px-5">
              <p className="text-center text-[14px] font-medium text-zinc-900 dark:text-zinc-100">{link.targetLabel}</p>
              {/* white in both themes: a scanner needs dark marks on a light field */}
              <div className="border border-zinc-200 bg-white p-3 dark:border-zinc-800">
                <QRCodeSVG value={link.shareUrl} size={176} role="img" aria-label={`QR code for ${link.targetLabel}`} />
              </div>
              <DialogDescription className="text-center text-[13px] text-zinc-500 dark:text-zinc-400">
                Scan the code to open your link.
              </DialogDescription>
              <p className="w-full text-center font-mono text-[12px] text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-100">
                {shareUrlDisplay(link.shareUrl)}
              </p>
              <Button
                aria-label={copied ? `Copied link for ${link.targetLabel}` : `Copy link for ${link.targetLabel}`}
                onClick={onCopy}
                className="min-w-[8rem]"
              >
                {copied ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
