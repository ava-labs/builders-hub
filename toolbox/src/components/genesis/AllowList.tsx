"use client"

import { useCallback } from 'react'
import EthereumAddressList from './EthereumAddressList'
import { Role, AddressRoles } from './types'
import { isAddress } from 'viem'

interface AllowlistProps {
  addresses: AddressRoles
  onUpdateAllowlist: (newAddresses: AddressRoles) => void
  precompileAction: string
}

export default function AllowList({
  addresses,
  onUpdateAllowlist,
  precompileAction
}: AllowlistProps) {
  const isAddressInvalid = useCallback((address: string, _: Role, currentId?: string, currentAddresses = addresses): string | undefined => {
    if (!isAddress(address, { strict: false })) {
      return 'Invalid Ethereum address format'
    }

    const roles: Role[] = ['Admin', 'Manager', 'Enabled']
    for (const role of roles) {
      const duplicateEntry = currentAddresses[role].find(
        entry => entry.address.toLowerCase() === address.toLowerCase() && entry.id !== currentId
      )
      if (duplicateEntry) {
        return 'Duplicate address'
      }
    }

    return undefined
  }, [addresses])

  const addAddresses = useCallback((role: Role, newAddresses: string[]) => {
    const newEntries = newAddresses.map(addr => ({
      id: Math.random().toString(36).substr(2, 9),
      address: addr,
    }))

    const updatedAddresses = {
      ...addresses,
      [role]: [
        ...addresses[role],
        ...newEntries
      ]
    }

    // Validate all addresses, including the new ones
    const validatedAddresses = Object.fromEntries(
      Object.entries(updatedAddresses).map(([role, entries]) => [
        role,
        entries.map(entry => ({
          ...entry,
          error: isAddressInvalid(entry.address, role as Role, entry.id, updatedAddresses)
        }))
      ])
    ) as unknown as AddressRoles

    onUpdateAllowlist(validatedAddresses)
  }, [addresses, isAddressInvalid, onUpdateAllowlist])

  const deleteAddress = useCallback((role: Role, id: string) => {
    const updatedAddresses = { ...addresses }
    updatedAddresses[role] = updatedAddresses[role].filter(entry => entry.id !== id || entry.requiredReason)

    // Re-validate all remaining addresses
    const validatedAddresses = Object.fromEntries(
      Object.entries(updatedAddresses).map(([currentRole, entries]) => [
        currentRole,
        entries.map(entry => ({
          ...entry,
          error: isAddressInvalid(entry.address, currentRole as Role, entry.id, updatedAddresses)
        }))
      ])
    ) as unknown as AddressRoles

    onUpdateAllowlist(validatedAddresses)
  }, [addresses, isAddressInvalid, onUpdateAllowlist])

  return (
    <div className="space-y-2">
      {(['Admin', 'Manager', 'Enabled'] as Role[]).map(role => (
        <EthereumAddressList
          key={role}
          role={role}
          addresses={addresses[role]}
          onAddAddresses={(newAddresses) => addAddresses(role, newAddresses)}
          onDeleteAddress={(id) => deleteAddress(role, id)}
          precompileAction={precompileAction}
        />
      ))}
    </div>
  )
}

