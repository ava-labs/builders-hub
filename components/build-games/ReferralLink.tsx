"use client";

import { useState } from "react";
import { useSession, getSession } from "next-auth/react";
import ReferralModal from "./ReferralModal";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";

export default function ReferralLink() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: session, status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();

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
      // User is not logged in, open login modal
      openLoginModal(window.location.href);
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
