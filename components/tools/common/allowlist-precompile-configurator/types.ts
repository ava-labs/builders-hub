export interface AddressEntry {
  id: string;
  address: string;
  error?: string;
  requiredReason?: string;
}

export type Role = "Admin" | "Manager" | "Enabled";

export interface AddressRoles {
  Admin: AddressEntry[];
  Manager: AddressEntry[];
  Enabled: AddressEntry[];
}

export interface AllowlistPrecompileConfig {
  addresses: AddressRoles;
  activated: boolean;
}
