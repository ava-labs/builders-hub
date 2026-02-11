"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// Validator data structure from the P-Chain API
export interface ValidatorData {
  validationId: string;
  nodeId: string;
  subnetId: string;
  weight: number;
  remainingBalance: string;
  creationTimestamp: number;
  remainingBalanceOwner?: {
    addresses: string[];
    threshold: number;
  };
  deactivationOwner?: {
    addresses: string[];
    threshold: number;
  };
}

// Context state interface
interface DisableL1ValidatorState {
  // Subnet selection
  subnetId: string;
  setSubnetId: (id: string) => void;

  // Validator selection
  selectedValidator: ValidatorData | null;
  setSelectedValidator: (validator: ValidatorData | null) => void;

  // Transaction state
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;

  // Result state
  txHash: string | null;
  setTxHash: (hash: string | null) => void;

  // Error state
  error: string | null;
  setError: (error: string | null) => void;

  // Reset function
  reset: () => void;
}

// Create context
const DisableL1ValidatorContext = createContext<DisableL1ValidatorState | null>(null);

// Provider component
export function DisableL1ValidatorProvider({ children }: { children: ReactNode }) {
  const [subnetId, setSubnetId] = useState<string>("");
  const [selectedValidator, setSelectedValidator] = useState<ValidatorData | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setSubnetId("");
    setSelectedValidator(null);
    setIsProcessing(false);
    setTxHash(null);
    setError(null);
  }, []);

  const value: DisableL1ValidatorState = {
    subnetId,
    setSubnetId,
    selectedValidator,
    setSelectedValidator,
    isProcessing,
    setIsProcessing,
    txHash,
    setTxHash,
    error,
    setError,
    reset,
  };

  return (
    <DisableL1ValidatorContext.Provider value={value}>
      {children}
    </DisableL1ValidatorContext.Provider>
  );
}

// Hook to use the context
export function useDisableL1Validator() {
  const context = useContext(DisableL1ValidatorContext);
  if (!context) {
    throw new Error('useDisableL1Validator must be used within a DisableL1ValidatorProvider');
  }
  return context;
}
