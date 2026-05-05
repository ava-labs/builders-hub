"use client";

import { useState } from "react";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReferralLinkResponse {
  id: string;
  shareUrl: string;
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

export function ProfileReferralLink() {
  const [isCreating, setIsCreating] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateAndCopy = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "bh_signup" }),
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || "Could not create referral link");
      }

      const link = (await response.json()) as ReferralLinkResponse;
      await copyToClipboard(link.shareUrl);
      setCopiedLinkId(link.id);
      setTimeout(() => setCopiedLinkId(null), 1600);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create referral link");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleCreateAndCopy}
        disabled={isCreating}
        className="shrink-0"
      >
        {isCreating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : copiedLinkId ? (
          <Copy className="mr-2 h-4 w-4" />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" />
        )}
        {copiedLinkId ? "Copied" : "Copy signup invite"}
      </Button>
      {error && <p className="max-w-56 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
