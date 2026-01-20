"use client";

import { useSession, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";

interface ApplyButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function ApplyButton({ className, children }: ApplyButtonProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { openLoginModal } = useLoginModalTrigger();

  const handleClick = async () => {
    // First check the current session state from useSession
    if (status === "authenticated" && session?.user) {
      // User is logged in, navigate to apply page
      router.push("/build-games/apply");
      return;
    }

    // If useSession says unauthenticated, double-check with getSession()
    // This handles race conditions where useSession hasn't updated yet
    const freshSession = await getSession();
    if (freshSession?.user) {
      // User is actually authenticated, navigate to apply page
      router.push("/build-games/apply");
    } else {
      // User is not logged in, open login modal with callback to apply page
      openLoginModal(`${window.location.origin}/build-games/apply`);
    }
  };

  return (
    <button onClick={handleClick} className={className}>
      {children || "Apply"}
    </button>
  );
}
