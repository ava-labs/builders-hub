"use client";

import { UserButton } from "./UserButton";
import { useEffect, useState } from "react";

export function UserButtonWrapper() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <div className="flex items-center">
      <UserButton />
    </div>
  );
}
