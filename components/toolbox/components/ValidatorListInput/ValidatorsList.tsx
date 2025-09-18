"use client"

import { useState } from "react"
import { ValidatorItem } from "./ValidatorItem"
import type { ConvertToL1Validator } from "../ValidatorListInput"

interface Props {
  validators: ConvertToL1Validator[]
  onChange: (validators: ConvertToL1Validator[]) => void
  l1TotalInitializedWeight?: bigint | null
  userPChainBalanceNavax?: bigint | null
}

export function ValidatorsList({ validators, onChange, l1TotalInitializedWeight = null, userPChainBalanceNavax = null }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index)
  }

  const updateValidator = (index: number, updated: Partial<ConvertToL1Validator>) => {
    const newValidators = [...validators]
    newValidators[index] = { ...newValidators[index], ...updated }
    onChange(newValidators)
  }

  const removeValidator = (index: number) => {
    const newValidators = [...validators]
    newValidators.splice(index, 1)
    onChange(newValidators)
  }

  if (validators.length === 0) return null

  return (
    <div className="space-y-4">
      {validators.map((validator, index) => (
        <ValidatorItem
          key={index}
          index={index}
          validator={validator}
          isExpanded={expandedIndex === index}
          onToggle={toggleExpand}
          onRemove={removeValidator}
          onUpdate={updateValidator}
          l1TotalInitializedWeight={l1TotalInitializedWeight}
          userPChainBalanceNavax={userPChainBalanceNavax}
        />
      ))}
    </div>
  )
}


