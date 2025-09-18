"use client"

import { useState } from "react"
import type { PChainOwner } from "./OwnerAddressesInput"
import { AddValidatorControls } from './ValidatorListInput/AddValidatorControls'
import { ValidatorsList } from './ValidatorListInput/ValidatorsList'

// Types for validator data
export type ConvertToL1Validator = {
  nodeID: string
  nodePOP: {
    publicKey: string
    proofOfPossession: string
  }
  validatorWeight: bigint
  validatorBalance: bigint
  remainingBalanceOwner: PChainOwner
  deactivationOwner: PChainOwner
}

interface ValidatorListInputProps {
  validators: ConvertToL1Validator[]
  onChange: (validators: ConvertToL1Validator[]) => void
  defaultAddress?: string
  label?: string
  description?: string
  l1TotalInitializedWeight?: bigint | null;
  userPChainBalanceNavax?: bigint | null;
  maxValidators?: number;
  selectedSubnetId?: string | null;
  isTestnet?: boolean;
}

export function ValidatorListInput({
  validators,
  onChange,
  defaultAddress = "",
  label = "Initial Validators",
  description,
  l1TotalInitializedWeight = null,
  userPChainBalanceNavax = null,
  maxValidators,
  selectedSubnetId = null,
  isTestnet = false,
}: ValidatorListInputProps) {

  const [error, setError] = useState<string | null>(null)


  const canAddMoreValidators = maxValidators === undefined || validators.length < maxValidators;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{label}</h2>
        {description && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{description}</p>}
      </div>

      <div className="bg-zinc-100/80 dark:bg-zinc-800/70 rounded-lg p-5 space-y-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">

        {/* Add new validator section */}
        {canAddMoreValidators && (
          <AddValidatorControls
            defaultAddress={defaultAddress}
            canAddMore={canAddMoreValidators}
            selectedSubnetId={selectedSubnetId}
            existingNodeIds={validators.map(v => v.nodeID)}
            isTestnet={isTestnet}
            onAddValidator={(candidate) => {
              if (validators.some((v) => v.nodeID === candidate.nodeID)) {
                setError("A validator with this NodeID already exists. NodeIDs must be unique.")
                return
              }
              onChange([...validators, candidate])
              setError(null)
            }}
          />
        )}

        {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400">{error}</div>}

        {/* List of validators */}
        <ValidatorsList
          validators={validators}
          onChange={onChange}
          l1TotalInitializedWeight={l1TotalInitializedWeight}
          userPChainBalanceNavax={userPChainBalanceNavax}
        />
      </div>
    </div>
  )
}
// balance duration moved into ValidatorsList