import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import type { Address } from '../types';

const TRIM = (url: string) => url.replace(/\/+$/, '');

export function buildAddressUrl(l1: L1ListItem | null | undefined, address: Address | undefined | null): string | null {
  if (!l1?.explorerUrl || !address) return null;
  return `${TRIM(l1.explorerUrl)}/address/${address}`;
}

export function buildTxUrl(l1: L1ListItem | null | undefined, txHash: Address | undefined | null): string | null {
  if (!l1?.explorerUrl || !txHash) return null;
  return `${TRIM(l1.explorerUrl)}/tx/${txHash}`;
}

export function truncateAddress(address: string | null | undefined, head = 6, tail = 4): string {
  if (!address) return '—';
  if (address.length <= head + tail + 3) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
