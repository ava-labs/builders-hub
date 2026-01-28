"use client";

import { useState, useEffect } from "react";
import { useSession, getSession } from "next-auth/react";
import ReferralModal from "./ReferralModal";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";

export default function ReferralLink() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: session, status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();

  // Check if user just logged in and wanted to open referral modal
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('openReferral') === 'true') {
        setIsModalOpen(true);
        // Clean up URL without reloading
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('openReferral');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }
  }, [status, session]);

  const handleClick = async () => {
    // First check the current session state from useSession
    if (status === "authenticated" && session?.user) {
      // User is logged in, open referral modal
      setIsModalOpen(true);
      return;
    }

    // If useSession says unauthenticated, double-check with getSession()
    // This handles race conditions where useSession hasn't updated yet
    const freshSession = await getSession();
    if (freshSession?.user) {
      // User is actually authenticated, open referral modal
      setIsModalOpen(true);
    } else {
      // User is not logged in, open login modal with openReferral param
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('openReferral', 'true');
      openLoginModal(currentUrl.toString());
    }
  };

  return (
    <>
      <button onClick={handleClick} className="text-[#66acd6] underline hover:text-[#7bbde3] transition-colors font-medium">
        HERE
      </button>
      <ReferralModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
