import {
  AllowlistPrecompileConfig,
  AddressEntry,
} from "@/components/tools/common/allowlist-precompile-configurator/types";

export function isValidL1Name(name: string): boolean {
  return name.split("").every((char) => {
    const code = char.charCodeAt(0);
    return (
      code <= 127 && // MaxASCII check
      char.match(/[a-zA-Z0-9 ]/) !== null
    ); // only letters, numbers, spaces
  });
}

const hasErrors = (entries: AddressEntry[]): boolean =>
  entries.some((entry) => entry.error !== undefined);

export const isValidAllowlistPrecompileConfig = (config: AllowlistPrecompileConfig): boolean => {
  if (!config.activated) return true;

  //check if at least one role has a valid address that is not required
  if (
    config.addresses.Admin.filter((entry) => !entry.requiredReason && !entry.error).length === 0 &&
    config.addresses.Manager.filter((entry) => !entry.requiredReason && !entry.error).length ===
      0 &&
    config.addresses.Enabled.filter((entry) => !entry.requiredReason && !entry.error).length === 0
  ) {
    return false;
  }

  return !Object.values(config.addresses).some((entries) => hasErrors(entries as AddressEntry[]));
};

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
