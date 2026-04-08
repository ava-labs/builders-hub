"use client";

import React from "react";
import { ValidatorManagerProvider } from "./ValidatorManagerContext";
import { Alert } from "@/components/toolbox/components/Alert";

interface PermissionedFlowLayoutProps {
  subnetIdL1: string;
  globalError: string | null;
  children: React.ReactNode;
}

export default function PermissionedFlowLayout({
  subnetIdL1,
  globalError,
  children,
}: PermissionedFlowLayoutProps) {
  return (
    <ValidatorManagerProvider subnetId={subnetIdL1}>
      {globalError && (
        <Alert variant="error" className="mb-4">Error: {globalError}</Alert>
      )}
      {children}
    </ValidatorManagerProvider>
  );
}
