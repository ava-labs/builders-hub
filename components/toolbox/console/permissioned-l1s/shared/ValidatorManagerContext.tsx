"use client";

import React, { createContext, useContext } from "react";
import { useValidatorManagerDetails } from "@/components/toolbox/hooks/useValidatorManagerDetails";

type ValidatorManagerContextType = ReturnType<typeof useValidatorManagerDetails>;

const ValidatorManagerContext = createContext<ValidatorManagerContextType | null>(null);

export function ValidatorManagerProvider({
  subnetId,
  children,
}: {
  subnetId: string;
  children: React.ReactNode;
}) {
  const details = useValidatorManagerDetails({ subnetId });

  return (
    <ValidatorManagerContext.Provider value={details}>
      {children}
    </ValidatorManagerContext.Provider>
  );
}

export function useValidatorManagerContext(): ValidatorManagerContextType {
  const ctx = useContext(ValidatorManagerContext);
  if (!ctx) {
    throw new Error(
      "useValidatorManagerContext must be used within a ValidatorManagerProvider"
    );
  }
  return ctx;
}
