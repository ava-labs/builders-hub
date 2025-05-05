"use client"

import React, { useState, useEffect } from 'react'
import { RawInput } from "../Input"
import { Trash2, Plus } from 'lucide-react'
import { AllocationEntry } from './types'
import { isAddress, Address } from 'viem'

export interface TokenAllocationListProps {
  allocations: AllocationEntry[];
  onAllocationsChange: (newAllocations: AllocationEntry[]) => void;
}

export default function TokenAllocationList({
  allocations,
  onAllocationsChange
}: TokenAllocationListProps) {
  const [newAddress, setNewAddress] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({})
  const [amountInputs, setAmountInputs] = useState<Record<number, string>>({})

  useEffect(() => {
    const initialAmounts: Record<number, string> = {}
    allocations.forEach((entry, index) => {
      initialAmounts[index] = entry.amount.toString()
    })
    setAmountInputs(initialAmounts)
  }, [allocations])

  const isAddressInvalid = (address: string, index?: number, currentAllocations = allocations): string | undefined => {
    if (!isAddress(address, { strict: false })) {
      return 'Invalid Ethereum address format'
    }

    const occurrences = currentAllocations.filter(
      (allocation, i) => allocation.address.toLowerCase() === address.toLowerCase() && i !== index
    ).length;

    if (occurrences > 0) {
      return 'Duplicate address'
    }

    return undefined
  }

  const validateAndSetAllocations = (updatedAllocations: AllocationEntry[]) => {
    const errors: Record<number, string> = {}
    updatedAllocations.forEach((allocation, index) => {
      const error = isAddressInvalid(allocation.address, index, updatedAllocations)
      if (error) {
        errors[index] = error
      }
    })
    setValidationErrors(errors)
    onAllocationsChange(updatedAllocations)
  }

  const handleAddAllocations = (newEntries: Omit<AllocationEntry, 'id'>[]) => {
    const validNewEntries = newEntries.filter(entry => isAddress(entry.address, { strict: false }))
    const updatedAllocations = [...allocations, ...validNewEntries]
    validateAndSetAllocations(updatedAllocations)
  }

  const handleDeleteAllocation = (index: number) => {
    const updatedAllocations = allocations.filter((_, i) => i !== index)
    validateAndSetAllocations(updatedAllocations)
  }

  const handleAmountInputChange = (index: number, value: string) => {
    setAmountInputs(prev => ({ ...prev, [index]: value }))
  }

  const handleAmountInputBlur = (index: number) => {
    const localValue = amountInputs[index] ?? allocations[index]?.amount.toString() ?? '0'
    let numericAmount = parseFloat(localValue)
    
    if (isNaN(numericAmount) || numericAmount < 0) {
      numericAmount = 0
    }

    if (allocations[index]?.amount !== numericAmount) {
      const updatedAllocations = [...allocations]
      updatedAllocations[index] = { ...allocations[index], amount: numericAmount }
      onAllocationsChange(updatedAllocations)
      setAmountInputs(prev => ({ ...prev, [index]: numericAmount.toString() }))
    }
  }

  const isValidInput = (input: string): boolean => {
    const addresses = input.split(/[\s,]+/).filter(addr => addr.trim() !== '')
    return addresses.length > 0 && addresses.every(address => isAddress(address, { strict: false }))
  }

  const handleInputChange = (inputValue: string) => {
    setNewAddress(inputValue)
  }

  const handleAddAddress = () => {
    if (isValidInput(newAddress)) {
      const addressesToAdd = newAddress.split(/[\s,]+/).map(addr => addr.trim()).filter(addr => addr !== '' && isAddress(addr, { strict: false }))
      
      const newEntries = addressesToAdd.map(address => ({
        address: address as Address,
        amount: 1_000_000
      }))
      handleAddAllocations(newEntries)
      setNewAddress('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddAddress()
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_auto] font-medium p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/50">
          <div className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Address</div>
          <div className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">Amount</div>
          <div className="w-10"></div>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {allocations.map((entry, index) => (
            <div key={index} className="grid grid-cols-[2fr_1fr_auto] items-center p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
              <div>
                <div className={`font-mono text-sm break-all ${validationErrors[index] ? 'text-red-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {entry.address}
                  {validationErrors[index] && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">{validationErrors[index]}</p>}
                </div>
              </div>
              <div>
                <RawInput
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*\\.?[0-9]*"
                  value={amountInputs[index] ?? ''}
                  onChange={(e) => handleAmountInputChange(index, e.target.value)}
                  onBlur={() => handleAmountInputBlur(index)}
                  min="0"
                  className="w-full font-mono text-sm"
                />
              </div>
              <div className="flex justify-center w-10">
                <button
                  onClick={() => handleDeleteAllocation(index)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                  aria-label="Delete allocation"
                >
                  <Trash2 className="h-4 w-4 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors" />
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center p-4 gap-3 bg-zinc-50/80 dark:bg-zinc-800/50">
            <Plus className="h-4 w-4 text-blue-500 shrink-0" />
            <RawInput
              type="text"
              placeholder="Add address (or multiple separated by space/comma)"
              value={newAddress}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 border-transparent bg-transparent shadow-none focus:ring-0 p-0 font-mono text-sm"
            />
            <button
              onClick={handleAddAddress}
              disabled={!isValidInput(newAddress)}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md disabled:opacity-50 transition-colors font-medium"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {allocations.length < 1 && (
        <p className="text-sm text-red-500 dark:text-red-400 font-medium">
          Please add at least one address that holds some tokens.
        </p>
      )}
    </div>
  )
}

