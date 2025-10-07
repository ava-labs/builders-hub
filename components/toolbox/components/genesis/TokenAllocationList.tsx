"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { RawInput } from "../Input"
import { Trash2, Plus } from 'lucide-react'
import { AllocationEntry } from './types'
import { isAddress, Address } from 'viem'
import { AddConnectedWalletButtonSimple } from '@/components/toolbox/components/ConnectWallet/AddConnectedWalletButton'
import { useGenesisHighlight } from './GenesisHighlightContext'

interface TokenAllocationListProps {
  allocations: AllocationEntry[];
  onAllocationsChange: (newAllocations: AllocationEntry[]) => void;
  compact?: boolean;
}

export default function TokenAllocationList({
  allocations,
  onAllocationsChange,
  compact
}: TokenAllocationListProps) {
  const [newAddress, setNewAddress] = useState('')
  const [newAmount, setNewAmount] = useState<string>('1000000')
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({})
  const [amountInputs, setAmountInputs] = useState<Record<number, string>>({})
  const { setHighlightPath, clearHighlight } = useGenesisHighlight()

  const handleFocus = () => {
    setHighlightPath('tokenAllocations')
  }

  const handleBlur = () => {
    clearHighlight()
  }

  useEffect(() => {
    // Only reset amountInputs when the length changes (items added/removed)
    // or when an index doesn't exist in amountInputs
    setAmountInputs(prev => {
      const newInputs = { ...prev }
      allocations.forEach((entry, index) => {
        // Only set if this index doesn't exist yet
        if (!(index in newInputs)) {
          newInputs[index] = entry.amount.toString()
        }
      })
      // Remove inputs for indices that no longer exist
      Object.keys(newInputs).forEach(key => {
        const index = parseInt(key)
        if (index >= allocations.length) {
          delete newInputs[index]
        }
      })
      return newInputs
    })
  }, [allocations.length]) // Only depend on length changes

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
    // Allow numeric input with basic validation
    setAmountInputs(prev => ({ ...prev, [index]: value }))
  }

  const handleAmountInputBlur = (index: number) => {
    const localValue = amountInputs[index] ?? allocations[index]?.amount.toString() ?? '0'
    let numericAmount = parseFloat(localValue)

    if (isNaN(numericAmount) || numericAmount < 0) {
      // If invalid input, reset to current allocation amount
      const currentAmount = allocations[index]?.amount ?? 0
      setAmountInputs(prev => ({ ...prev, [index]: currentAmount.toString() }))
      return
    }

    // Only update if the numeric value is different from the current amount
    const currentAmount = allocations[index]?.amount ?? 0

    if (numericAmount !== currentAmount) {
      const updatedAllocations = [...allocations]
      updatedAllocations[index] = { ...allocations[index], amount: numericAmount }
      onAllocationsChange(updatedAllocations)
      setAmountInputs(prev => ({ ...prev, [index]: numericAmount.toString() }))
    } else {
      // Even if the value is the same, make sure the display is consistent
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

  const totalSupply = useMemo(() => allocations.reduce((sum, a) => sum + (isNaN(a.amount) ? 0 : a.amount), 0), [allocations])

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className={`flex items-center justify-between ${compact ? 'px-3 py-2' : 'px-4 py-3'} border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/40`}>
          <div className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300">Token Allocations</div>
          <div className="flex items-center gap-3 text-[12px] text-zinc-600 dark:text-zinc-400">
            <span>Total: <span className="font-medium text-zinc-800 dark:text-zinc-200">{totalSupply.toLocaleString()}</span></span>
            {allocations.length > 0 && (
              <button className="underline hover:no-underline" onClick={() => onAllocationsChange([])}>Clear all</button>
            )}
          </div>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {allocations.map((entry, index) => (
            <div key={index} className={`flex items-center gap-3 ${compact ? 'p-3' : 'p-4'} hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors`}>
              <div className="flex-1 min-w-0">
                <div className={`font-mono ${compact ? 'text-[12px]' : 'text-sm'} break-all ${validationErrors[index] ? 'text-red-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {entry.address}
                  {validationErrors[index] && <p className="text-xs text-red-500 dark:text-red-400 mt-1">{validationErrors[index]}</p>}
                </div>
              </div>
              <RawInput
                type="text"
                inputMode="decimal"
                value={amountInputs[index] ?? allocations[index]?.amount?.toString() ?? ''}
                onChange={(e) => handleAmountInputChange(index, e.target.value)}
                onBlur={() => {
                  handleAmountInputBlur(index);
                  handleBlur();
                }}
                onFocus={handleFocus}
                className={`w-32 font-mono ${compact ? 'text-[12px] py-1' : 'text-sm'}`}
              />
              <button
                onClick={() => handleDeleteAllocation(index)}
                className={`${compact ? 'p-1.5' : 'p-2'} hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors`}
                aria-label="Delete allocation"
              >
                <Trash2 className="h-4 w-4 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors" />
              </button>
            </div>
          ))}

          <div className={`${compact ? 'p-3' : 'p-4'} bg-zinc-50/80 dark:bg-zinc-900/40`}>
            <div className={`flex items-center gap-3`}>
              <div className="flex-1 min-w-0 relative">
                <RawInput
                  type="text"
                  placeholder="Add address (0x...)"
                  value={newAddress}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  className={`w-full font-mono ${compact ? 'text-[12px] py-1 pl-7' : 'text-sm pl-8'} pr-2`}
                />
                <Plus className={`absolute left-2 top-1/2 -translate-y-1/2 ${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} text-zinc-400`} />
              </div>
              <RawInput
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                placeholder="Amount"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                className={`w-32 ${compact ? 'text-[12px] py-1' : 'text-sm'}`}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddAddress}
                  disabled={!isValidInput(newAddress)}
                  className={`${compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'} bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:opacity-50 transition-colors font-medium flex items-center gap-1.5`}
                >
                  Add
                </button>
                <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600" />
                <AddConnectedWalletButtonSimple 
                  onAddAddress={(address) => handleAddAllocations([{ 
                    address: address as Address, 
                    amount: parseFloat(newAmount) || 0 
                  }])}
                  addressSource={allocations}
                />
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
            <AddConnectedWalletButtonSimple
              onAddAddress={(address) => handleAddAllocations([{
                address: address as Address,
                amount: 1_000_000
              }])}
              addressSource={allocations}
            />
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


