"use client"

import { useState } from "react"
import type { PChainOwner } from "./OwnerAddressesInput"
import { SuggestedManagedTestnetNodes } from './SuggestedManagedTestnetNodes'
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
  showSuggestedManagedNodes?: boolean;
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
  showSuggestedManagedNodes = false,
}: ValidatorListInputProps) {

  const [error, setError] = useState<string | null>(null)

  const handleAutofillFromManaged = (choice: {
    id: string;
    node_id: string;
    chain_name: string | null;
    public_key?: string;
    proof_of_possession?: string;
    subnet_id?: string;
  }) => {
    setError(null)
    if (!choice.node_id) {
      setError("Hosted node is missing NodeID")
      return
    }
    const existing = validators.some((v) => v.nodeID === choice.node_id)
    if (existing) {
      setError("A validator with this NodeID already exists.")
      return
    }

    const publicKey = (choice.public_key || "").trim()
    const proof = (choice.proof_of_possession || "").trim()

    const newValidator: ConvertToL1Validator = {
      nodeID: choice.node_id,
      nodePOP: { publicKey, proofOfPossession: proof },
      validatorWeight: BigInt(100),
      validatorBalance: BigInt(100000000),
      remainingBalanceOwner: {
        addresses: defaultAddress ? [defaultAddress] : [],
        threshold: 1,
      },
      deactivationOwner: {
        addresses: defaultAddress ? [defaultAddress] : [],
        threshold: 1,
      },
    }

    onChange([...validators, newValidator])
  }

  const canAddMoreValidators = maxValidators === undefined || validators.length < maxValidators;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{label}</h2>
        {description && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{description}</p>}
      </div>

      <div className="bg-zinc-100/80 dark:bg-zinc-800/70 rounded-lg p-5 space-y-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">

        {/* Suggested hosted nodes for the selected Subnet */}
        {showSuggestedManagedNodes && (
          <SuggestedManagedTestnetNodes
            managedNodes={[]}
            selectedSubnetId={selectedSubnetId}
            canAddMore={canAddMoreValidators}
            onAdd={handleAutofillFromManaged}
          />
        )}

        {/* Add new validator section */}
        {canAddMoreValidators && (
          <AddValidatorControls
            defaultAddress={defaultAddress}
            canAddMore={canAddMoreValidators}
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