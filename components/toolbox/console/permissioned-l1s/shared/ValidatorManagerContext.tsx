"use client";

import React, { createContext, useContext, useMemo } from "react";
import { useValidatorManagerDetails } from "@/components/toolbox/hooks/useValidatorManagerDetails";

type ValidatorManagerDetailsReturn = ReturnType<typeof useValidatorManagerDetails>;

interface ValidatorManagerContextType extends ValidatorManagerDetailsReturn {
  subnetId: string;
  isContractInitialized: boolean;
  isValidatorSetInitialized: boolean;
}

const ValidatorManagerContext = createContext<ValidatorManagerContextType | null>(null);

export function ValidatorManagerProvider({
  subnetId,
  children,
}: {
  subnetId: string;
  children: React.ReactNode;
}) {
  const details = useValidatorManagerDetails({ subnetId });

  const value = useMemo<ValidatorManagerContextType>(() => {
    const isContractInitialized =
      !!details.validatorManagerAddress && !details.error;

    const isValidatorSetInitialized =
      isContractInitialized &&
      details.contractTotalWeight > 0n &&
      !details.l1WeightError;

    return {
      ...details,
      subnetId,
      isContractInitialized,
      isValidatorSetInitialized,
    };
  }, [details, subnetId]);

  return (
    <ValidatorManagerContext.Provider value={value}>
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
