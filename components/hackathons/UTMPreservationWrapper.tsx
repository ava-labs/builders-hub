"use client";

import { useUTMPreservation } from "@/hooks/use-utm-preservation";
import { Suspense } from "react";

interface UTMPreservationWrapperProps {
  children: React.ReactNode;
}

function UTMPreserver() {
  useUTMPreservation();
  return null;
}

export default function UTMPreservationWrapper({ children }: UTMPreservationWrapperProps) {
  return (
    <>
      <Suspense fallback={null}>
        <UTMPreserver />
      </Suspense>
      {children}
    </>
  );
} 