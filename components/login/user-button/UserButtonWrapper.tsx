"use client";

import { SessionProvider } from "next-auth/react";
import { UserButton } from "./UserButton";
import { useEffect, useState } from "react";

export function UserButtonWrapper() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Only render after the component is mounted and SessionProvider is available
  if (!isMounted) {
    return null;
  }

  return <SessionProvider>
    <UserButton />
  </SessionProvider>;
}
