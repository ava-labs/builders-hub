"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { generateReferralLink, generateXShareUrl, generateLinkedInShareUrl } from "@/lib/referral";

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReferralModal({ isOpen, onClose }: ReferralModalProps) {
  const [handle, setHandle] = useState("");
  const [referralLink, setReferralLink] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerateLink = () => {
    if (!handle.trim()) return;
    const link = generateReferralLink(handle.trim());
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
        className="bg-[#0b1e30] border border-[rgba(102,172,214,0.3)] text-white max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-white font-['Aeonik:Medium',sans-serif] text-xl">
            Refer a Friend
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Share with your network and earn a percentage of any prizes your referrals win.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="x-handle" className="text-sm text-gray-300">Your X (Twitter) Handle</label>
            <div className="flex gap-2">
              <input id="x-handle" type="text" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourhandle" className="flex-1 px-4 py-2 bg-[#152d44] border border-[rgba(102,172,214,0.3)] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#66acd6] transition-colors" onKeyDown={(e) => e.key === "Enter" && handleGenerateLink()} />
              <button onClick={handleGenerateLink} disabled={!handle.trim()} className="px-4 py-2 bg-[#66acd6] text-[#152d44] font-medium rounded-lg hover:bg-[#7bbde3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Generate</button>
            </div>
          </div>

          {referralLink && (
            <div className="flex flex-col gap-3 p-4 bg-[#152d44] rounded-lg border border-[rgba(102,172,214,0.2)]">
              <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-300">Your Referral Link</label>
                <div className="flex gap-2">
                  <input type="text" value={referralLink} readOnly className="flex-1 px-3 py-2 bg-[#0b1e30] border border-[rgba(102,172,214,0.2)] rounded text-sm text-gray-200 truncate" />
                  <button onClick={handleCopyLink} className="p-2 bg-[rgba(102,172,214,0.1)] border border-[rgba(102,172,214,0.5)] text-[#66acd6] rounded hover:bg-[rgba(102,172,214,0.2)] transition-colors">
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-gray-300">Share on</label>
                <div className="flex gap-2">
                  <button onClick={handleShareX} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors">
                    <XIcon />
                    <span>X / Twitter</span>
                  </button>
                  <button onClick={handleShareLinkedIn} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#0077b5] text-white rounded-lg hover:bg-[#006699] transition-colors">
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
