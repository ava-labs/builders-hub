"use client";

import { UserButton } from "./UserButton";
import { useEffect, useState } from "react";

interface UserButtonWrapperProps {
  showLoginText?: boolean;
  loginText?: string;
}

export function UserButtonWrapper({ showLoginText, loginText }: UserButtonWrapperProps = {}) {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Only render after the component is mounted
  if (!isMounted) {
    return null;
  }

  return <UserButton showLoginText={showLoginText} loginText={loginText} />;
} 