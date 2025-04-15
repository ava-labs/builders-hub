"use client"

import { useState, useRef, useEffect } from 'react'
import { RawInput } from "../Input"
import { Trash2, AlertCircle, Plus, CircleHelp, Lock } from 'lucide-react'
import { AddressEntry, Role } from './types'
import { isAddress } from 'viem'

interface EthereumAddressListProps {
  role: Role;
  addresses: AddressEntry[];
  onAddAddresses: (newAddresses: string[]) => void;
  onDeleteAddress: (id: string) => void;
  precompileAction: string;
}

const isValidInput = (input: string): boolean => {
  const addresses = input.split(/[\s,]+/).filter(addr => addr.trim() !== '');
  return addresses.length > 0 && addresses.every(address => isAddress(address, { strict: false }));
}

const getRoleDescription = (role: Role, precompileAction: string) => {
  switch (role) {
    case 'Admin':
      return `Can ${precompileAction} and have full control over the allowlist, including the ability to add or remove Admins, Managers, and Enabled addresses via contract calls to the precompile.`;
    case 'Manager':
      return `Can ${precompileAction}, add or remove Enabled addresses via contract calls to the precompile but cannot modify Admins or Managers.`;
    case 'Enabled':
      return `Can ${precompileAction} but cannot modify the allow list.`;
    default:
      return '';
  }
};

export default function EthereumAddressList({
  role,
  addresses,
  onAddAddresses,
  onDeleteAddress,
  precompileAction
}: EthereumAddressListProps) {
  const [newAddress, setNewAddress] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (inputValue: string) => {
    setNewAddress(inputValue);
  }

  const handleAddAddress = () => {
    if (isValidInput(newAddress)) {
      const newAddresses = newAddress.split(/[\s,]+/).filter(addr => addr.trim() !== '');
      onAddAddresses(newAddresses);
      setNewAddress('');
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddAddress();
    }
  }

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-md shadow">
        <div className="font-medium p-3 border-b flex items-center">
          <span className="font-bold flex items-center">
            {role} Addresses
            <CircleHelp className="h-4 w-4 text-gray-500 ml-1 inline" />
          </span>
          <div className="ml-2 text-xs text-gray-500">
            {getRoleDescription(role, precompileAction)}
          </div>
        </div>

        <div className="divide-y">
          {addresses.map((entry) => (
            <div key={entry.id} className="flex justify-between items-center p-3">
              <div className={`${entry.error ? 'text-red-500' : ''}`}>
                <span className="inline-flex items-center">
                  {entry.address}
                  {entry.error && <AlertCircle className="h-4 w-4 ml-2" />}
                </span>
                {entry.error && <p className="text-xs text-red-500 mt-1">{entry.error}</p>}
                {entry.requiredReason && <p className="text-xs text-gray-500 mt-1">{entry.requiredReason}</p>}
              </div>
              <div>
                {entry.requiredReason ?
                  <Lock className="h-4 w-4 text-gray-500" /> :
                  <button
                    onClick={() => onDeleteAddress(entry.id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
                    aria-label="Delete address"
                  >
                    <Trash2 className="h-4 w-4 text-gray-500" />
                  </button>
                }
              </div>
            </div>
          ))}

          <div className="flex items-center p-3 gap-2">
            <Plus className="h-4 w-4 text-gray-400 shrink-0" />
            <RawInput
              type="text"
              placeholder={`Add one or more addresses for ${role}`}
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
    </div>
  )
}

