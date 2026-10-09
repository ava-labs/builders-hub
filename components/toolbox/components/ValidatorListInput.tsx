'use client';

import { useState } from 'react';
import type { PChainOwner } from './OwnerAddressesInput';
import { AddValidatorControls } from './ValidatorListInput/AddValidatorControls';
import { ValidatorsList } from './ValidatorListInput/ValidatorsList';

// Types for validator data
export type ConvertToL1Validator = {
  nodeID: string;
  nodePOP: {
    publicKey: string;
    proofOfPossession: string;
  };
  validatorWeight: bigint;
  validatorBalance: bigint;
  remainingBalanceOwner: PChainOwner;
  deactivationOwner: PChainOwner;
};

interface ValidatorListInputProps {
  validators: ConvertToL1Validator[];
  onChange: (validators: ConvertToL1Validator[]) => void;
  defaultAddress?: string;
  label?: string;
  description?: string;
  l1TotalInitializedWeight?: bigint | null;
  userPChainBalanceNavax?: bigint | null;
  maxValidators?: number;
  selectedSubnetId?: string | null;
  isTestnet?: boolean;
  hideConsensusWeight?: boolean;
}

export function ValidatorListInput({
  validators,
  onChange,
  defaultAddress = '',
  label = 'Initial Validators',
  description,
  l1TotalInitializedWeight = null,
  userPChainBalanceNavax = null,
  maxValidators,
  selectedSubnetId = null,
  isTestnet = false,
  hideConsensusWeight = false,
}: ValidatorListInputProps) {
  const [error, setError] = useState<string | null>(null);

  const canAddMoreValidators = maxValidators === undefined || validators.length < maxValidators;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {label}
        </h2>
        {description && <p className="mt-1 text-[13px] text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>

      <div className="space-y-4 border border-zinc-200 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        {/* Add new validator section */}
        {canAddMoreValidators && (
          <AddValidatorControls
            defaultAddress={defaultAddress}
            canAddMore={canAddMoreValidators}
            selectedSubnetId={selectedSubnetId}
            existingNodeIds={validators.map((v) => v.nodeID)}
            isTestnet={isTestnet}
            onAddValidator={(candidate) => {
              if (validators.some((v) => v.nodeID === candidate.nodeID)) {
                setError('A validator with this NodeID already exists. NodeIDs must be unique.');
                return;
              }
              onChange([...validators, candidate]);
              setError(null);
            }}
          />
        )}

        {error && (
          <div className="border border-red-200 bg-red-50/60 p-3 text-[13px] text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        {/* List of validators */}
        <ValidatorsList
          validators={validators}
          onChange={onChange}
          l1TotalInitializedWeight={l1TotalInitializedWeight}
          userPChainBalanceNavax={userPChainBalanceNavax}
          hideConsensusWeight={hideConsensusWeight}
        />
      </div>
    </div>
  );
}
// balance duration moved into ValidatorsList
