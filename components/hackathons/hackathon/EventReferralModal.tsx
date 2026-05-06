"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import type { EventsLang } from "@/lib/events/i18n";
import { t } from "@/lib/events/i18n";
import { createReferralLink } from "@/lib/referrals/client";

interface EventReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  hackathonId: string;
  hackathonTitle: string;
  lang?: EventsLang;
}

export default function EventReferralModal({
  isOpen,
  onClose,
  hackathonId,
  hackathonTitle,
  lang = "en",
}: EventReferralModalProps) {
  const [referralLink, setReferralLink] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { copiedId, copyToClipboard } = useCopyToClipboard({
    resetDelay: 2000,
    onError: () => setError("Failed to copy referral link"),
  });

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await createReferralLink({
        targetType: "hackathon_registration",
        targetId: hackathonId,
        destinationUrl: `/events/registration-form?event=${hackathonId}`,
      });

      setReferralLink(result.shareUrl);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create referral link");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!referralLink) return;
    await copyToClipboard(referralLink, "event-referral-link");
  };

  const handleShareX = () => {
    if (!referralLink) return;
    const text = t(lang, "referral.share.xText", { title: hackathonTitle, link: referralLink });
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleShareLinkedIn = () => {
    if (!referralLink) return;
    const text = t(lang, "referral.share.linkedinText", { title: hackathonTitle, link: referralLink });
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}&summary=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleClose = () => {
    setReferralLink("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="!max-w-[calc(100%-32px)] sm:!max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {t(lang, "referral.modal.title")}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {t(lang, "referral.modal.description", { title: hackathonTitle })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          <button
            onClick={handleGenerateLink}
            disabled={isGenerating}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating && <Loader2 size={16} className="animate-spin" />}
            {t(lang, "referral.modal.generate")}
          </button>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}

          {referralLink && (
            <div className="flex flex-col gap-3 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  {t(lang, "referral.modal.yourLink")}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={referralLink}
                    readOnly
                    className="flex-1 min-w-0 px-2 py-2 border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-900 text-xs truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="p-2 border border-zinc-300 dark:border-zinc-600 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
                    title={t(lang, "referral.modal.copy")}
                  >
                    {copiedId ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">
                  {t(lang, "referral.modal.shareOn")}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleShareX}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black text-white text-sm rounded-lg hover:bg-zinc-800 transition-colors"
                  >
                    <XIcon />
                    <span>X</span>
                  </button>
                  <button
                    onClick={handleShareLinkedIn}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#0077b5] text-white text-sm rounded-lg hover:bg-[#006699] transition-colors"
                  >
                    <LinkedInIcon />
                    <span>LinkedIn</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

export function EventReferralButton({
  hackathonId,
  hackathonTitle,
  lang = "en",
  isAuthenticated = false,
}: {
  hackathonId: string;
  hackathonTitle: string;
  lang?: EventsLang;
  isAuthenticated?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();

  const handleOpen = () => {
    if (!isAuthenticated && status !== "authenticated") {
      const callbackUrl = `${window.location.pathname}${window.location.search}`;
      openLoginModal(callbackUrl);
      return;
    }

    setIsOpen(true);
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
      >
        <Share2 size={16} />
        {t(lang, "referral.button.label")}
      </button>
      <EventReferralModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        hackathonId={hackathonId}
        hackathonTitle={hackathonTitle}
        lang={lang}
      />
    </>
  );
}
