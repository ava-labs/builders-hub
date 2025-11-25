"use client"

import { useState, useRef, useEffect } from 'react'
import { RawInput } from "../Input"
import { Trash2, AlertCircle, Plus, Lock, Info } from 'lucide-react'
import { AddressEntry, Role, AddressRoles } from './types'
import { isAddress } from 'viem'
import { AddConnectedWalletButtonSimple } from '@/components/toolbox/components/ConnectWallet/AddConnectedWalletButton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface EthereumAddressListProps {
  role: Role;
  addresses: AddressEntry[];
  onAddAddresses: (newAddresses: string[]) => void;
  onDeleteAddress: (id: string) => void;
  precompileAction: string;
  checkDuplicate?: (address: string) => boolean;
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
  precompileAction,
  checkDuplicate
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
    <div className="space-y-3 text-[12px]">
      <div className="bg-white dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-1.5">
            <div className="font-medium text-zinc-800 dark:text-white">{role} Addresses</div>
            <Tooltip>
              <TooltipTrigger className="inline-flex">
                <Info className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{getRoleDescription(role, precompileAction)}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {addresses.map((entry) => (
            <div key={entry.id} className="flex justify-between items-center px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
              <div className={`font-mono text-[12px] ${entry.error ? 'text-red-500 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                <span className="inline-flex items-center">
                  {entry.address}
                  {entry.error && <AlertCircle className="h-4 w-4 ml-2 flex-shrink-0" />}
                </span>
                {entry.error && <p className="text-[11px] text-red-500 dark:text-red-400 mt-1">{entry.error}</p>}
                {entry.requiredReason && <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 italic">{entry.requiredReason}</p>}
              </div>
              <div>
                {entry.requiredReason ?
                  <Lock className="h-4 w-4 text-zinc-400" /> :
                  <button
                    onClick={() => onDeleteAddress(entry.id)}
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    aria-label="Delete address"
                  >
                    <Trash2 className="h-4 w-4 text-zinc-500 dark:text-zinc-400 hover:text-red-500 transition-colors" />
                  </button>
                }
              </div>
            </div>
          ))}

          <div className="flex items-center px-3 py-2 gap-3 bg-zinc-50/80 dark:bg-zinc-900/40">
            <Plus className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <RawInput
              type="text"
              placeholder={`Add one or more addresses for ${role}`}
              value={newAddress}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 border-none bg-transparent shadow-none focus:ring-0 p-0 font-mono text-[12px]"
            />
            <button
              onClick={handleAddAddress}
              disabled={!isValidInput(newAddress)}
              className="px-2.5 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:opacity-50 transition-colors font-medium"
            >
              Add
            </button>
            <AddConnectedWalletButtonSimple 
              onAddAddress={(address) => onAddAddresses([address])} 
              checkDuplicate={checkDuplicate}
              addressSource={!checkDuplicate ? addresses : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

