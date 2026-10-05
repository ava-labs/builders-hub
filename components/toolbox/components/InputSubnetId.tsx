'use client';

import { Input, type Suggestion } from './Input';
import { useL1ListStore } from '../stores/l1ListStore';
import { useCreateChainStore } from '../stores/createChainStore';
import { useWalletStore } from '../stores/walletStore';
import { useMemo, useState, useEffect, useRef } from 'react';
import { networkIDs } from '@avalabs/avalanchejs';
import { getSubnetInfoForNetwork, GlacierHttpError } from '../coreViem/utils/glacier';
import {
  isSubnetMiss,
  subnetFieldErrorText,
  subnetIdFormatErrorText,
  type OtherNetworkRead,
} from '../utils/vmcLookupText';

// Primary network subnet ID
export const PRIMARY_NETWORK_SUBNET_ID = '11111111111111111111111111111111LpoYY';

/**
 * The result of a check of the field's value, for onLookup:
 * - 'found': the Data API has the subnet on the network that the field reads.
 * - 'not-found': the value is not a Subnet ID on that network (its form, or a 404 or 400). The field shows its text.
 * - 'failed': the Data API read failed (a 5xx, a 429 or a network error). The field shows no text, so the caller can
 *   show its own (DATA_API_ERROR).
 */
export type SubnetLookupStatus = 'found' | 'not-found' | 'failed';

/** Reads a subnet on one network. getSubnetInfoForNetwork, or a stub in a test. */
export type SubnetRead = (network: 'testnet' | 'mainnet', subnetId: string, signal: AbortSignal) => Promise<unknown>;

/**
 * The network that the field reads. A caller with its own network (the `isTestnet` prop, for example a Network
 * toggle) sets it. Other callers get the wallet's network. `pageNetwork` is true when the caller set the network.
 */
export function subnetFieldNetwork(
  isTestnet: boolean | undefined,
  avalancheNetworkID: number,
): { isTestnet: boolean; pageNetwork: boolean } {
  if (isTestnet !== undefined) return { isTestnet, pageNetwork: true };
  return { isTestnet: avalancheNetworkID !== networkIDs.MainnetID, pageNetwork: false };
}

/** The HTTP status of a failed Data API read, or undefined for a network error. */
function glacierStatus(e: unknown): number | undefined {
  return e instanceof GlacierHttpError ? e.status : undefined;
}

/**
 * Checks a non-empty value: first its form (Base58Check), then the Data API on the network `isTestnet`. `error` is
 * the field error (null for a Data API failure, so the caller's text shows). `status` is null when the field did not
 * read the Data API for a valid value.
 * - A miss (404 or 400) makes the field read the other network once. getSubnetInfo read the other network after every
 *   failure, so this makes no more requests.
 * - On the wallet's network, an L1 on the other network gets the text that tells the user to switch the wallet.
 * - On the caller's network (`pageNetwork`, for example a Network toggle), the wallet is not the fix. The texts tell
 *   the user to set the Network (see subnetFieldErrorText).
 * - A read-only field (`readOnly`) holds a value that the caller filled in, so the field checks only its form.
 */
export async function checkSubnetField(
  value: string,
  { isTestnet, pageNetwork, readOnly }: { isTestnet: boolean; pageNetwork: boolean; readOnly: boolean },
  signal: AbortSignal,
  read: SubnetRead = getSubnetInfoForNetwork,
): Promise<{ status: SubnetLookupStatus | null; error: string | null }> {
  const formatError = subnetIdFormatErrorText(value);
  if (formatError) return { status: 'not-found', error: formatError };
  if (readOnly) return { status: null, error: null };
  try {
    await read(isTestnet ? 'testnet' : 'mainnet', value, signal);
    return { status: 'found', error: null };
  } catch (e) {
    const status = glacierStatus(e);
    if (!isSubnetMiss(status)) return { status: 'failed', error: null };
    let otherNetwork: OtherNetworkRead = 'unknown';
    if (!signal.aborted) {
      otherNetwork = await read(isTestnet ? 'mainnet' : 'testnet', value, signal).then(
        (): OtherNetworkRead => 'found',
        (other: unknown): OtherNetworkRead => (isSubnetMiss(glacierStatus(other)) ? 'missing' : 'unknown'),
      );
    }
    return { status: 'not-found', error: subnetFieldErrorText(status, isTestnet, { otherNetwork, pageNetwork }) };
  }
}

export default function InputSubnetId({
  value,
  onChange,
  error,
  label = 'Subnet ID',
  hidePrimaryNetwork = true,
  helperText,
  id,
  validationDelayMs = 500,
  readOnly = false,
  hideSuggestions = false,
  placeholder,
  isTestnet,
  onLookup,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  label?: string;
  hidePrimaryNetwork?: boolean;
  helperText?: string | null;
  id?: string;
  validationDelayMs?: number;
  readOnly?: boolean;
  hideSuggestions?: boolean;
  placeholder?: string;
  /**
   * The network of the L1, when the page has its own (for example a Network toggle). Default: the wallet's network.
   * The field reads this network, and the other network once after a miss. Its texts tell the user to set the
   * Network, not to switch the wallet.
   */
  isTestnet?: boolean;
  /**
   * Called after each check of a non-empty value that has a result (see SubnetLookupStatus). A read-only field with a
   * valid value gets no call, because the field does not read the Data API for it.
   */
  onLookup?: (subnetId: string, status: SubnetLookupStatus) => void;
}) {
  const createChainStoreSubnetId = useCreateChainStore()((state) => state.subnetId);
  const { l1List } = useL1ListStore()();

  const avalancheNetworkID = useWalletStore((s) => s.avalancheNetworkID);
  const { isTestnet: readTestnet, pageNetwork } = subnetFieldNetwork(isTestnet, avalancheNetworkID);
  const [validationError, setValidationError] = useState<string | null>(null);
  // The latest callback, so a new callback on each render of the caller does not start a new check
  const onLookupRef = useRef(onLookup);
  useEffect(() => {
    onLookupRef.current = onLookup;
  });

  // Check the value after the delay: first its form (Base58Check, every non-empty value), then the Data API
  useEffect(() => {
    // An error of the old value does not stay on the new value while the check waits
    setValidationError(null);
    if (!value) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      const check = await checkSubnetField(value, { isTestnet: readTestnet, pageNetwork, readOnly }, controller.signal);
      // A newer value or network started its own check
      if (controller.signal.aborted) return;
      setValidationError(check.error);
      if (check.status) onLookupRef.current?.(value, check.status);
    }, validationDelayMs);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [value, validationDelayMs, readTestnet, pageNetwork, readOnly]);

  const subnetIdSuggestions: Suggestion[] = useMemo(() => {
    const result: Suggestion[] = [];
    const seen = new Set<string>();

    // Add subnet from create chain store first
    if (createChainStoreSubnetId && !(hidePrimaryNetwork && createChainStoreSubnetId === PRIMARY_NETWORK_SUBNET_ID)) {
      result.push({
        title: createChainStoreSubnetId,
        value: createChainStoreSubnetId,
        description: 'The Subnet that you have just created in the "Create Chain" tool',
      });
      seen.add(createChainStoreSubnetId);
    }

    // Add subnets from L1 list
    for (const l1 of l1List) {
      const { subnetId, name } = l1;

      if (!subnetId || seen.has(subnetId)) continue;

      if (hidePrimaryNetwork && subnetId === PRIMARY_NETWORK_SUBNET_ID) {
        continue;
      }

      result.push({
        title: `${name} (${subnetId})`,
        value: subnetId,
        description: l1.description || 'A subnet that was added to your L1 list.',
      });

      seen.add(subnetId);
    }

    return result;
  }, [createChainStoreSubnetId, l1List, hidePrimaryNetwork]);

  // The field's own error names the fix (the form, a miss, or the other network), so it wins over the caller's error.
  // For a Data API failure or a read-only value, the field has no error, and the caller's text shows.
  const combinedError = validationError || error;

  return (
    <Input
      id={id}
      label={label}
      value={value}
      onChange={onChange}
      suggestions={readOnly || hideSuggestions ? [] : subnetIdSuggestions}
      error={combinedError}
      helperText={helperText}
      placeholder={readOnly ? 'Automatically filled from Blockchain ID' : placeholder || 'Enter subnet ID'}
      disabled={readOnly}
    />
  );
}
