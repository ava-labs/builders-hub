"use client"

import { useState } from 'react'
import { RawInput } from "../Input"
import { Trash2, Plus } from 'lucide-react'
import { AllocationEntry } from './types'
import { isAddress } from 'viem'

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

  const handleAddAllocations = (newAllocations: Omit<AllocationEntry, 'id'>[]) => {
    const updatedAllocations = [...allocations, ...newAllocations];
    const errors: Record<number, string> = {};

    updatedAllocations.forEach((allocation, index) => {
      const error = isAddressInvalid(allocation.address, index, updatedAllocations);
      if (error) {
        errors[index] = error;
      }
    });

    setValidationErrors(errors);
    onAllocationsChange(updatedAllocations);
  }

  const handleDeleteAllocation = (index: number) => {
    const updatedAllocations = allocations.filter((_, i) => i !== index);
    const errors: Record<number, string> = {};

    updatedAllocations.forEach((allocation, index) => {
      const error = isAddressInvalid(allocation.address, index, updatedAllocations);
      if (error) {
        errors[index] = error;
      }
    });

    setValidationErrors(errors);
    onAllocationsChange(updatedAllocations);
  }

  const isValidInput = (input: string): boolean => {
    const addresses = input.split(/[\s,]+/).filter(addr => addr.trim() !== '');
    return addresses.length > 0 && addresses.every(address => isAddress(address, { strict: false }));
  }

  const handleInputChange = (inputValue: string) => {
    setNewAddress(inputValue);
  }

  const handleAddAddress = () => {
    if (isValidInput(newAddress)) {
      const newAddresses = newAddress.split(/[\s,]+/).filter(addr => addr.trim() !== '');
      const newAllocations = newAddresses.map(address => ({
        address,
        amount: 1_000_000
      }));
      handleAddAllocations(newAllocations);
      setNewAddress('');
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAddress();
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-md shadow">
        <div className="grid grid-cols-[2fr_1fr_auto] font-medium p-3 border-b">
          <div>Address</div>
          <div>Amount</div>
          <div className="w-10"></div>
        </div>

        <div className="divide-y">
          {allocations.map((entry, index) => (
            <div key={index} className="grid grid-cols-[2fr_1fr_auto] items-center p-3">
              <div>
                <div className={`${validationErrors[index] ? 'text-red-500' : ''}`}>
                  {entry.address}
                  {validationErrors[index] && <p className="text-xs text-red-500 mt-1">{validationErrors[index]}</p>}
                </div>
              </div>
              <div>
                <RawInput
                  type="number"
                  value={entry.amount}
                  onChange={(e) => {
                    const numericAmount = parseFloat(e.target.value);
                    if (!isNaN(numericAmount) && numericAmount >= 0) {
                      const updatedAllocations = [...allocations];
                      updatedAllocations[index] = { ...entry, amount: numericAmount };
                      onAllocationsChange(updatedAllocations);
                    }
                  }}
                  min="0"
                  step="0.000000000000000001"
                  className="w-full"
                />
              </div>
              <div className="flex justify-center w-10">
                <button
                  onClick={() => handleDeleteAllocation(index)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                  aria-label="Delete allocation"
                >
                  <Trash2 className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center p-3 gap-2">
            <Plus className="h-4 w-4 text-gray-400 shrink-0" />
            <RawInput
              type="text"
              placeholder="Add address (or multiple separated by space/comma)"
              value={newAddress}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 border-transparent bg-transparent shadow-none focus:ring-0 p-0"
            />
            <button
              onClick={handleAddAddress}
              disabled={!isValidInput(newAddress)}
              className="px-3 py-1 bg-blue-500 text-white rounded-md disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {allocations.length < 1 && (
        <p className="text-sm text-red-500">
          Please add at least one address that holds some tokens.
        </p>
      )}
    </div>
  )
}

