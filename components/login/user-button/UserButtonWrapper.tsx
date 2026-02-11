"use client";

import { SessionProvider } from "next-auth/react";
import { UserButton } from "./UserButton";
import { useEffect, useState } from "react";
import NotificationBell from "@/components/notification/notification-bell";

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
    <div className="flex items-center">
      <NotificationBell />
      <UserButton />
    </div>
  </SessionProvider>;
}