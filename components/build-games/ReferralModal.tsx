"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { getSession } from "next-auth/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { generateReferralLink, generateXShareUrl, generateLinkedInShareUrl } from "@/lib/referral";

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReferralModal({ isOpen, onClose }: ReferralModalProps) {
  const [handle, setHandle] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerateLink = async () => {
    if (!handle.trim()) return;

    let userId: string | undefined;

    // Try to get the user ID with a try-catch
    try {
      // Use getSession() to get the freshest session data
      const freshSession = await getSession();
      if (freshSession?.user?.id) {
        userId = freshSession.user.id;
      }
    } catch (error) {
      console.error('Error getting user ID for referral:', error);
      // userId remains undefined if error occurs
    }

    const link = generateReferralLink(handle.trim(), userId);
    setReferralLink(link);
  };

  const handleCopyLink = async () => {
    if (!referralLink) return;
    
    let success = false;
    
    // Try modern Clipboard API first
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(referralLink);
        success = true;
      } catch {
        // Fall through to legacy fallback
      }
    }
    
    // Legacy fallback for older browsers or when Clipboard API fails
    if (!success) {
      const textArea = document.createElement("textarea");
      textArea.value = referralLink;
      
      // Style to be invisible and not affect layout
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      textArea.style.opacity = "0";
      textArea.style.pointerEvents = "none";
      textArea.setAttribute("readonly", "");
      textArea.setAttribute("aria-hidden", "true");
      
      document.body.appendChild(textArea);
      
      try {
        textArea.focus();
        textArea.select();
        // Check if execCommand succeeded
        success = document.execCommand("copy");
      } catch {
        success = false;
      } finally {
        document.body.removeChild(textArea);
      }
    }
    
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareX = () => {
    if (!referralLink) return;
    window.open(generateXShareUrl(referralLink), "_blank", "noopener,noreferrer");
  };

  const handleShareLinkedIn = () => {
    if (!referralLink) return;
    window.open(generateLinkedInShareUrl(referralLink), "_blank", "noopener,noreferrer");
  };

  const handleClose = () => {
    setHandle("");
    setReferralLink("");
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        className="bg-[#0b1e30] border border-[rgba(102,172,214,0.3)] text-white !max-w-[calc(100%-32px)] sm:!max-w-md !p-4 sm:!p-6 overflow-x-hidden"
      >
        <DialogHeader>
          <DialogTitle className="text-white font-['Aeonik:Medium',sans-serif] text-xl">
            Refer a Friend
          </DialogTitle>
          <DialogDescription className="text-gray-300 flex flex-col gap-3">
            <span>Get a part of a <span className="text-[#66acd6] font-medium">$30k referral pool</span> if you refer a winning team</span>
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <ReferralPrizeCard amount="$10k" place="1st" />
              <ReferralPrizeCard amount="$7.5k" place="2nd" />
              <ReferralPrizeCard amount="$5.5k" place="3rd" />
              <ReferralPrizeCard amount="$1k" place="4-10th" />
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="x-handle" className="text-sm text-gray-300">Your X (Twitter) Handle</label>
            <div className="flex gap-2">
              <input id="x-handle" type="text" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourhandle" className="flex-1 min-w-0 px-3 sm:px-4 py-2 bg-[#152d44] border border-[rgba(102,172,214,0.3)] rounded-lg text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:border-[#66acd6] transition-colors" onKeyDown={(e) => e.key === "Enter" && handleGenerateLink()} />
              <button onClick={handleGenerateLink} disabled={!handle.trim()} className="px-3 sm:px-4 py-2 bg-[#66acd6] text-[#152d44] text-sm sm:text-base font-medium rounded-lg hover:bg-[#7bbde3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0">Generate</button>
            </div>
          </div>

          {referralLink && (
            <div className="flex flex-col gap-3 p-3 sm:p-4 bg-[#152d44] rounded-lg border border-[rgba(102,172,214,0.2)]">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-300">Your Referral Link</label>
                <div className="flex gap-2">
                  <input type="text" value={referralLink} readOnly className="flex-1 min-w-0 px-2 sm:px-3 py-2 bg-[#0b1e30] border border-[rgba(102,172,214,0.2)] rounded text-xs sm:text-sm text-gray-200 truncate" />
                  <button onClick={handleCopyLink} className="p-2 bg-[rgba(102,172,214,0.1)] border border-[rgba(102,172,214,0.5)] text-[#66acd6] rounded hover:bg-[rgba(102,172,214,0.2)] transition-colors shrink-0">
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-300">Share on</label>
                <div className="flex gap-2">
                  <button onClick={handleShareX} className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-black text-white text-xs sm:text-sm rounded-lg hover:bg-gray-900 transition-colors">
                    <XIcon />
                    <span>X</span>
                  </button>
                  <button onClick={handleShareLinkedIn} className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-[#0077b5] text-white text-xs sm:text-sm rounded-lg hover:bg-[#006699] transition-colors">
                    <LinkedInIcon />
                    <span>LinkedIn</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <Accordion type="single" collapsible className="w-full mt-4 border-t border-[rgba(102,172,214,0.2)] pt-2">
          <AccordionItem value="terms" className="border-none">
            <AccordionTrigger className="text-gray-400 text-xs hover:no-underline py-2">
              Terms & Conditions
            </AccordionTrigger>
            <AccordionContent className="text-gray-400 text-xs leading-relaxed">
              <div className="space-y-3 max-h-[150px] overflow-y-auto pr-2">
                <p>
                  The Build Games referral program offers a total referral prize pool of <strong className="text-gray-300">$30,000</strong>, distributed based on the final placement of referred teams or individuals. Referral rewards are allocated as follows: <strong className="text-gray-300">$10,000</strong> for referring the 1st place winner, <strong className="text-gray-300">$7,500</strong> for the 2nd place winner, <strong className="text-gray-300">$5,500</strong> for the 3rd place winner, and <strong className="text-gray-300">$1,000</strong> for referring a team that places between 4th and 10th.
                </p>
                <p>
                  Self-referrals are strictly prohibited. Referrals are <strong className="text-gray-300">first-come, first-served</strong>, and only one referral may be attributed to any individual or team, meaning no duplicate or competing referrals will be honored. Referrals must be submitted at the time of application; <strong className="text-gray-300">retroactive referrals will not be accepted</strong> if a participant has already applied without a referral or with a different referral.
                </p>
                <p>
                  The <strong className="text-gray-300">Avalanche Foundation</strong> reserves the right, in its sole discretion, to <strong className="text-gray-300">disqualify any participant or referrer</strong> found to be engaging in fraudulent behavior, manipulation, misrepresentation, or any activity deemed to undermine the integrity of Build Games or the referral program. All terms and conditions are subject to change at any time.
                </p>
                <p>
                  By <strong className="text-gray-300">creating or using a referral link</strong>, you acknowledge and agree to these terms and conditions.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </DialogContent>
    </Dialog>
  );
}

function ReferralPrizeCard({ amount, place }: { amount: string; place: string }) {
  return (
    <div className="relative rounded-md sm:rounded-lg overflow-hidden bg-gradient-to-b from-[rgba(15,40,71,0.8)] to-[rgba(10,22,40,0.9)]">
      <div className="absolute inset-0 pointer-events-none rounded-md sm:rounded-lg">
        <div className="absolute bg-[rgba(34,74,113,0.5)] inset-0 rounded-md sm:rounded-lg" />
        <img alt="" className="absolute inset-0 w-full h-full object-cover opacity-60 rounded-md sm:rounded-lg" src="/build-games/frame-23.png" />
      </div>
      <div className="absolute inset-0 rounded-md sm:rounded-lg border border-[rgba(56,189,248,0.3)] pointer-events-none" />
      <div className="relative p-1.5 sm:p-3 flex flex-col items-center justify-center">
        <div className="text-white font-['Aeonik:Medium',sans-serif] text-sm sm:text-lg font-medium">{amount}</div>
        <div className="text-gray-400 text-[10px] sm:text-xs">{place}</div>
      </div>
    </div>
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
