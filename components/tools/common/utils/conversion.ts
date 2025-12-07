import { AddressEntry } from "@/components/tools/common/allowlist-precompile-configurator/types";

export const addressEntryArrayToAddressArray = (entries: AddressEntry[]): string[] => {
  return entries.map((entry) => entry.address);
};
