"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";

interface ApplyButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function ApplyButton({ className, children }: ApplyButtonProps) {
  const { status } = useSession();
  const router = useRouter();
  const { openLoginModal } = useLoginModalTrigger();

  const handleClick = () => {
    if (status === "authenticated") {
      // User is logged in, navigate to apply page
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
