"use client";

import { useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Copy, UserPlus, CalendarDays, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { createReferralLink, type ReferralLinkResponse } from "@/lib/referrals/client";
import type { ReferralTargetPreset } from "@/lib/referrals/targets";

export interface ReferralLinkSummary {
  id: string;
  code: string;
  target_type: string;
  target_id: string | null;
  destination_url: string;
  created_at: string;
  shareUrl: string;
}

export interface ReferralTargetGroups {
  signup: ReferralTargetPreset[];
  event: ReferralTargetPreset[];
  grant: ReferralTargetPreset[];
}

export function ReferralLinkGenerator({
  initialLinks,
  targets,
  buttonVariant = "default",
}: {
  initialLinks: ReferralLinkSummary[];
  targets: ReferralTargetGroups;
  buttonVariant?: "default" | "outline";
}) {
  const [referralLinks, setReferralLinks] = useState<ReferralLinkSummary[]>(initialLinks);
  const [creatingTargetKey, setCreatingTargetKey] = useState<string | null>(null);
  const [qrLinkId, setQrLinkId] = useState<string | null>(null);
  const { copiedId: copiedLinkId, copyToClipboard } = useCopyToClipboard({
    resetDelay: 1600,
  });

  const getLatestLinkForTarget = (target: ReferralTargetPreset) =>
    referralLinks.find(
      (link) =>
        link.target_type === target.targetType &&
        (link.target_id ?? null) === target.targetId &&
        link.destination_url === target.destinationUrl,
    );

  const handleCopy = async (link: ReferralLinkSummary) => {
    await copyToClipboard(link.shareUrl, link.id);
  };

  const handleGenerateAndCopy = async (target: ReferralTargetPreset) => {
    const existingLink = getLatestLinkForTarget(target);
    if (existingLink && /^[A-Z]{5}$/.test(existingLink.code)) {
      await handleCopy(existingLink);
      setQrLinkId(existingLink.id);
      return;
    }

    setCreatingTargetKey(target.key);
    try {
      const link: ReferralLinkResponse = await createReferralLink({
        targetType: target.targetType,
        targetId: target.targetId,
        destinationUrl: target.destinationUrl,
      });
      const summary: ReferralLinkSummary = {
        id: link.id,
        code: link.code,
        target_type: link.target_type,
        target_id: link.target_id ?? null,
        destination_url: link.destination_url,
        created_at:
          typeof link.created_at === "string"
            ? link.created_at
            : new Date().toISOString(),
        shareUrl: link.shareUrl,
      };
      setReferralLinks((current) =>
        [summary, ...current.filter((item) => item.id !== summary.id)].slice(0, 25),
      );
      setQrLinkId(summary.id);
      await handleCopy(summary);
    } finally {
      setCreatingTargetKey(null);
    }
  };

  const selectedQrLink = referralLinks.find((link) => link.id === qrLinkId) ?? null;

  return (
    <Card className="rounded-lg border-neutral-200 shadow-none dark:border-neutral-800">
      <CardHeader className="px-4 py-2 pb-1">
        <CardTitle className="text-base">Referral Link Generator</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 px-4 pb-4 pt-1">
        <div className="flex flex-wrap gap-1.5">
          <TargetGroup
            icon={<UserPlus className="h-4 w-4" />}
            title="Builder Hub"
            targets={targets.signup}
            buttonVariant={buttonVariant}
            getLatestLinkForTarget={getLatestLinkForTarget}
            creatingTargetKey={creatingTargetKey}
            copiedLinkId={copiedLinkId}
            onGenerateAndCopy={handleGenerateAndCopy}
          />
          <TargetGroup
            icon={<CalendarDays className="h-4 w-4" />}
            title="Active And Upcoming Events"
            targets={targets.event}
            emptyLabel="No active or upcoming public events found."
            buttonVariant={buttonVariant}
            getLatestLinkForTarget={getLatestLinkForTarget}
            creatingTargetKey={creatingTargetKey}
            copiedLinkId={copiedLinkId}
            onGenerateAndCopy={handleGenerateAndCopy}
          />
          <TargetGroup
            icon={<Gift className="h-4 w-4" />}
            title="Active Grants"
            targets={targets.grant}
            buttonVariant={buttonVariant}
            getLatestLinkForTarget={getLatestLinkForTarget}
            creatingTargetKey={creatingTargetKey}
            copiedLinkId={copiedLinkId}
            onGenerateAndCopy={handleGenerateAndCopy}
          />
        </div>

        {selectedQrLink && (
          <div className="grid gap-3 rounded-md border border-neutral-200 p-4 dark:border-neutral-800 md:grid-cols-[auto_1fr_auto] md:items-center">
            <div className="rounded-md bg-white p-3">
              <QRCodeSVG value={selectedQrLink.shareUrl} size={132} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium">QR Code</div>
              <div className="truncate text-sm text-neutral-600 dark:text-neutral-400">
                {selectedQrLink.shareUrl}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => handleCopy(selectedQrLink)}>
              <Copy className="mr-2 h-4 w-4" />
              {copiedLinkId === selectedQrLink.id ? "Copied" : "Copy link"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TargetGroup({
  title: _title,
  icon: _icon,
  targets,
  emptyLabel = "No referral targets available.",
  buttonVariant = "default",
  getLatestLinkForTarget,
  creatingTargetKey,
  copiedLinkId,
  onGenerateAndCopy,
}: {
  title: string;
  icon: ReactNode;
  targets: ReferralTargetPreset[];
  emptyLabel?: string;
  buttonVariant?: "default" | "outline";
  getLatestLinkForTarget: (target: ReferralTargetPreset) => ReferralLinkSummary | undefined;
  creatingTargetKey: string | null;
  copiedLinkId: string | null;
  onGenerateAndCopy: (target: ReferralTargetPreset) => Promise<void>;
}) {
  if (!targets.length) {
    return <div className="text-xs text-neutral-500 dark:text-neutral-400">{emptyLabel}</div>;
  }
  return (
    <>
      {targets.map((target) => {
        const existingLink = getLatestLinkForTarget(target);
        const isCreating = creatingTargetKey === target.key;
        const isCopied = existingLink ? copiedLinkId === existingLink.id : false;

        return (
          <Button
            key={target.key}
            size="sm"
            variant={buttonVariant}
            onClick={() => onGenerateAndCopy(target)}
            disabled={isCreating}
            title={target.detail}
          >
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCopied ? "Copied" : target.label}
          </Button>
        );
      })}
    </>
  );
}
