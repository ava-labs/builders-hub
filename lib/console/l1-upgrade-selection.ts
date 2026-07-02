import { utils } from '@avalabs/avalanchejs';

export type L1UpgradeSelectionCandidate = {
  subnetId?: string | null;
  blockchainId?: string | null;
  rpcUrl?: string | null;
  chainName?: string | null;
};

export function isValidAvalancheId(value: string | null | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length < 40 || trimmed.length > 60) return false;

  try {
    utils.base58check.decode(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function validatePublicRpcUrlInput(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return 'RPC URL is required so Builder Hub can read active precompile state.';

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return 'RPC URL must be a valid URL.';
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'RPC URL must use http or https.';
  }

  return null;
}

export function validateL1UpgradeSelection(selection: L1UpgradeSelectionCandidate): string[] {
  const errors: string[] = [];
  const subnetId = selection.subnetId?.trim() ?? '';
  const blockchainId = selection.blockchainId?.trim() ?? '';
  const chainName = selection.chainName?.trim() ?? '';

  if (!subnetId) {
    errors.push('Subnet ID is required.');
  } else if (!isValidAvalancheId(subnetId)) {
    errors.push('Subnet ID must be a valid Avalanche CB58 ID.');
  }

  if (!blockchainId) {
    errors.push('Blockchain ID is required.');
  } else if (!isValidAvalancheId(blockchainId)) {
    errors.push('Blockchain ID must be a valid Avalanche CB58 ID.');
  }

  const rpcError = validatePublicRpcUrlInput(selection.rpcUrl);
  if (rpcError) errors.push(rpcError);

  if (chainName.length > 80) {
    errors.push('Chain name must be 80 characters or less.');
  }

  return errors;
}
