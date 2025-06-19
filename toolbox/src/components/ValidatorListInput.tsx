"use client"

import { useState } from "react"
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "./utils"
import { Button } from "./Button"
import { OwnerAddressesInput, type PChainOwner } from "./OwnerAddressesInput"
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock'

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
}: ValidatorListInputProps) {
  const [jsonInput, setJsonInput] = useState("")
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const rpcCommand = `curl -X POST --data '{"jsonrpc":"2.0","id":1,"method":"info.getNodeID"}' -H "content-type:application/json;" 127.0.0.1:9650/ext/info`

  const handleAddValidator = () => {
    try {
      if (!jsonInput.trim()) {
        setError("Please enter a valid JSON response")
        return
      }

      const parsedJson = JSON.parse(jsonInput)
      const { nodeID, nodePOP } = parsedJson.result ? parsedJson.result : parsedJson

      if (!nodeID || !nodePOP || !nodePOP.publicKey || !nodePOP.proofOfPossession) {
        setError("Invalid JSON format. Missing nodeID or nodePOP.")
        return
      }

      if (validators.some((validator) => validator.nodeID === nodeID)) {
        setError("A validator with this NodeID already exists. NodeIDs must be unique.")
        return
      }

      const newValidator: ConvertToL1Validator = {
        nodeID,
        nodePOP,
        validatorWeight: BigInt(100),
        validatorBalance: BigInt(100000000), // 0.1 AVAX
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
      setJsonInput("")
      setError(null)
      setExpandedIndex(validators.length)
    } catch (err) {
      setError(`Error parsing JSON: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleRemoveValidator = (index: number) => {
    const newValidators = [...validators]
    newValidators.splice(index, 1)
    onChange(newValidators)
    if (expandedIndex === index) {
      setExpandedIndex(null)
    } else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1)
    }
  }

  const updateValidator = (index: number, updatedValidator: Partial<ConvertToL1Validator>) => {
    if (updatedValidator.nodeID) {
      const isDuplicate = validators.some(
        (validator, idx) => idx !== index && validator.nodeID === updatedValidator.nodeID,
      )
      if (isDuplicate) {
        setError("This NodeID is already used by another validator. NodeIDs must be unique.")
        return
      }
    }
    const newValidators = [...validators]
    newValidators[index] = { ...newValidators[index], ...updatedValidator }
    onChange(newValidators)
    setError(null)
  }

  const updateOwner = (index: number, ownerType: "remainingBalanceOwner" | "deactivationOwner", owner: PChainOwner) => {
    const newValidators = [...validators]
    newValidators[index][ownerType] = owner
    onChange(newValidators)
  }

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

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
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between pb-1 border-b border-zinc-200 dark:border-zinc-700">
              <span className="text-base font-medium text-zinc-800 dark:text-zinc-200">Add Validator</span>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400">
             Click the copy button to copy the command and run it in your node's terminal to get the node credentials.
            </p>


            <DynamicCodeBlock
              code={rpcCommand}
              lang="zsh"
            />

            <p className="text-sm text-zinc-600 dark:text-zinc-400">
             Paste the JSON response below:
            </p>

            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"jsonrpc":"2.0","result":{"nodeID":"...","nodePOP":{"publicKey":"...",  "proofOfPossession":"..."}},"id":1}'
              rows={4}
              className={cn(
                "w-full rounded-md p-3 font-mono text-sm",
                "bg-white dark:bg-zinc-900",
                "border border-zinc-300 dark:border-zinc-600",
                "text-zinc-900 dark:text-zinc-100",
                "shadow-sm focus:ring focus:ring-primary/20 focus:border-primary/60 focus:outline-none",
                "placeholder:text-zinc-400 dark:placeholder:text-zinc-500",
              )}
            />

            {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400">{error}</div>}

            <div className="pt-2">
              <Button
                onClick={handleAddValidator}
                icon={<Plus className="w-4 h-4" color="white" />}
                variant="primary"
                className="w-full sm:w-auto"
                disabled={!canAddMoreValidators}
              >
                Add Validator
              </Button>
            </div>
          </div>
        )}

        {/* List of validators */}
        {validators.length > 0 && (
          <div className="space-y-4">
            {validators.map((validator, index) => {
              let weightPercentageText = "";
              if (l1TotalInitializedWeight && l1TotalInitializedWeight > 0n) {
                const percentage = (Number(validator.validatorWeight * 10000n / l1TotalInitializedWeight) / 100).toFixed(2);
                weightPercentageText = `${percentage}% of total L1 weight.`;
              } else {
                const totalListedWeight = validators.reduce((acc, val) => acc + Number(val.validatorWeight), 0);
                if (totalListedWeight > 0) {
                    const percentage = ((Number(validator.validatorWeight) / totalListedWeight) * 100).toFixed(2);
                    weightPercentageText = `${percentage}% of total weight in this list. Should not exceed 20% in production settings.`;
                } else {
                    weightPercentageText = "N/A% of total weight. Add other validators to see percentage.";
                }
              }

              // Check for insufficient P-Chain balance for this specific validator
              let insufficientBalanceError: string | null = null;
              if (userPChainBalanceNavax !== null && validator.validatorBalance > userPChainBalanceNavax) {
                insufficientBalanceError = `Validator balance (${(Number(validator.validatorBalance) / 1e9).toFixed(2)} AVAX) exceeds your P-Chain balance (${(Number(userPChainBalanceNavax) / 1e9).toFixed(2)} AVAX).`;
              }

              return (
                <div
                  key={index}
                  className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden shadow-sm hover:shadow transition-shadow duration-200"
                >
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    onClick={() => toggleExpand(index)}
                  >
                    <div className="flex-1 font-mono text-sm truncate">{validator.nodeID}</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveValidator(index)
                        }}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-md transition-colors text-red-500"
                        title="Remove validator"
                        type="button"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      {expandedIndex === index ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {expandedIndex === index && (
                    <div className="p-3 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          Node ID (must be unique)
                        </label>
                        <input
                          type="text"
                          value={validator.nodeID}
                          onChange={(e) => updateValidator(index, { nodeID: e.target.value })}
                          className={cn(
                            "w-full rounded p-2",
                            "bg-zinc-50 dark:bg-zinc-900",
                            "border border-zinc-200 dark:border-zinc-700",
                            "text-zinc-900 dark:text-zinc-100",
                            "shadow-sm focus:ring focus:ring-primary/30 focus:ring-opacity-50",
                            "font-mono text-sm",
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Consensus Weight
                          </label>
                          <input
                            type="number"
                            value={validator.validatorWeight.toString()}
                            onChange={(e) =>
                              updateValidator(index, {
                                validatorWeight: BigInt(e.target.value || 0),
                              })
                            }
                            className={cn(
                              "w-full rounded p-2",
                              "bg-zinc-50 dark:bg-zinc-900",
                              "border border-zinc-200 dark:border-zinc-700",
                              "text-zinc-900 dark:text-zinc-100",
                              "shadow-sm focus:ring focus:ring-primary/30 focus:ring-opacity-50",
                            )}
                          />
                          <p className="text-xs mt-0 mb-0 text-zinc-500 dark:text-zinc-400">
                            {weightPercentageText}
                          </p>
                          {/* Updated error display for individual validator weight */}
                          {l1TotalInitializedWeight && l1TotalInitializedWeight > 0n && validator.validatorWeight > 0n && 
                           (validator.validatorWeight * 100n / l1TotalInitializedWeight) >= 20n && (
                            <p className="text-xs mt-1 text-red-500 dark:text-red-400">
                              Warning: This validator's weight is 20% or more of the current L1 total stake ({ Number(validator.validatorWeight * 10000n / l1TotalInitializedWeight / 100n).toFixed(2) }%). Recommended to be less than 20%.
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Validator Balance (AVAX)
                          </label>
                          <input
                            type="number"
                            step="0.000001"
                            min="0"
                            value={Number(validator.validatorBalance) / 1000000000}
                            onChange={(e) =>
                              updateValidator(index, {
                                validatorBalance: BigInt(parseFloat(e.target.value || "0") * 1000000000),
                              })
                            }
                            className={cn(
                              "w-full rounded p-2",
                              "bg-zinc-50 dark:bg-zinc-900",
                              "border border-zinc-200 dark:border-zinc-700",
                              (insufficientBalanceError ? "border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500/30" : "focus:ring-primary/30 focus:border-primary"),
                              "text-zinc-900 dark:text-zinc-100",
                              "shadow-sm focus:ring focus:ring-opacity-50",
                            )}
                          />
                          <p className="text-xs mt-0 mb-0 text-zinc-500 dark:text-zinc-400">
                            Will last for {getBalanceDurationEstimate(Number(validator.validatorBalance) / 1000000000)} with a fee of 1.33 AVAX per month.
                          </p>
                          {insufficientBalanceError && (
                            <p className="text-xs mt-1 text-red-500 dark:text-red-400">
                              {insufficientBalanceError}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Remaining Balance Owner */}
                      <OwnerAddressesInput
                        label="Remaining Balance Owner Addresses"
                        owner={validator.remainingBalanceOwner}
                        onChange={(owner) => updateOwner(index, "remainingBalanceOwner", owner)}
                      />

                      {/* Deactivation Owner */}
                      <OwnerAddressesInput
                        label="Deactivation Owner Addresses"
                        owner={validator.deactivationOwner}
                        onChange={(owner) => updateOwner(index, "deactivationOwner", owner)}
                      />
                    </div>
                  )}
                </div>
              )}
            )}
          </div>
        )}
      </div>
    </div>
  )
}


function getBalanceDurationEstimate(balance: number): string {
  const feePerSecond = 0.000000512;
  const seconds = balance / feePerSecond;

  const oneHour = 3600;
  const oneDay = 86400;
  const oneMonth = oneDay * 30;
  const oneYear = oneDay * 365;

  if (seconds < oneHour) return "less than 1 hour";

  if (seconds < oneDay) {
    const hours = Math.round(seconds / oneHour);
    return hours === 1 ? "roughly 1 hour" : `roughly ${hours} hours`;
  }

  if (seconds < oneMonth) {
    const days = Math.round(seconds / oneDay);
    return days === 1 ? "roughly 1 day" : `roughly ${days} days`;
  }

  if (seconds < oneYear) {
    const months = Math.round(seconds / oneMonth);
    return months === 1 ? "roughly 1 month" : `roughly ${months} months`;
  }

  return "more than 1 year";
}