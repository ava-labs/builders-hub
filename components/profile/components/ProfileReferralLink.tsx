"use client";

import { useState } from "react";
import { Copy, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { createReferralLink } from "@/lib/referrals/client";

export function ProfileReferralLink() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copiedId, copyToClipboard } = useCopyToClipboard({
    resetDelay: 1600,
    onError: () => setError("Could not copy referral link"),
  });

  const handleCreateAndCopy = async () => {
    setIsCreating(true);
    setError(null);

    try {
      const link = await createReferralLink({ targetType: "bh_signup" });
      await copyToClipboard(link.shareUrl, link.id);
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
        ) : copiedId ? (
          <Copy className="mr-2 h-4 w-4" />
        ) : (
          <UserPlus className="mr-2 h-4 w-4" />
        )}
        {copiedId ? "Copied" : "Copy signup invite"}
      </Button>
      {error && <p className="max-w-56 text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}
