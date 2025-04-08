export interface AddressEntry {
  id: string;
  address: string;
  error?: string;
  requiredReason?: string;
}

export type Role = 'Admin' | 'Manager' | 'Enabled'

export interface AddressRoles {
  'Admin': AddressEntry[],
  'Manager': AddressEntry[],
  'Enabled': AddressEntry[]
}

export interface AllowlistPrecompileConfig {
  addresses: AddressRoles
  activated: boolean
}

export const generateEmptyAllowlistPrecompileConfig = (): AllowlistPrecompileConfig => {
  return {
    addresses: {
      'Admin': [],
      'Manager': [],
      'Enabled': []
    },
    activated: false
  }
}

export const isValidAllowlistPrecompileConfig = (config: AllowlistPrecompileConfig): boolean => {
  if (!config.activated) return true;

  //check if at least one role has a valid address that is not required
  if (
    config.addresses.Admin.filter(entry => !entry.requiredReason && !entry.error).length === 0
    && config.addresses.Manager.filter(entry => !entry.requiredReason && !entry.error).length === 0
    && config.addresses.Enabled.filter(entry => !entry.requiredReason && !entry.error).length === 0
  ) return false;

  const hasErrors = (entries: AddressEntry[]): boolean =>
    entries.some(entry => entry.error !== undefined);

  return !Object.values(config.addresses).some(entries => hasErrors(entries as AddressEntry[]));
}

export const addressEntryArrayToAddressArray = (entries: AddressEntry[]): string[] => {
  return entries.map(entry => entry.address);
}

export interface AllocationEntry {
  address: string;
  amount: number;
}
