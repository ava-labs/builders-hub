// The text of a failed L1 lookup: the Subnet ID field (InputSubnetId), L1 Node Setup and the Validator Manager lookup
// (useVMCAddress). The signing steps show the lookup text too (SigningSubnetStatus).

import { utils } from '@avalabs/avalanchejs';

/** The lookup error when no L1 is selected. The signing steps show it as is: it is an instruction, not a failure. */
export const NO_L1_SELECTED = 'Select an L1.';

/** A failed Data API (Glacier) read. Its own text names a subnet and an HTTP status, which users cannot act on. */
export const DATA_API_ERROR = 'Could not load the L1 from the Data API.';

/**
 * The lookup error for a Subnet ID that the Data API knows, but not as an L1 with a Validator Manager. After a
 * conversion, the Data API needs a few minutes to show the L1 (useVMCAddress reads the subnet again in that time).
 */
export const NOT_AN_L1 =
  'This is not an L1, or it has no Validator Manager. After a conversion, the Data API can take a few minutes to ' +
  'show the L1.';

/** The field error for a value that is not a Subnet ID in form (Base58Check, 32 bytes). */
export const SUBNET_ID_FORMAT_ERROR = 'This is not a valid Subnet ID. Check that the ID is complete and correct.';

function networkName(isTestnet: boolean): string {
  return isTestnet ? 'Fuji' : 'Mainnet';
}

/**
 * True for a 404 or a 400 from the Data API read of a subnet: the ID is not a Subnet ID on that network. For example,
 * it is a blockchain ID, an L1 of the other network, or a new subnet that the Data API does not show yet. The user
 * can act on that. Other statuses (5xx, 429) and network errors (no status) come from the service.
 */
export function isSubnetMiss(status: number | undefined): boolean {
  return status === 404 || status === 400;
}

/**
 * The text for a failed Data API read of the selected L1 (Glacier /subnets/{id}) on one network: the wallet's, or the
 * page's own network (the Network toggle of L1 Node Setup).
 */
export function subnetLookupErrorText(status: number | undefined, isTestnet: boolean): string {
  if (isSubnetMiss(status)) {
    return (
      `This L1 is not on ${networkName(isTestnet)}. A new L1 can take a minute to appear. ` +
      'Check that the ID is a Subnet ID, not a blockchain ID.'
    );
  }
  return DATA_API_ERROR;
}

/** The text for an L1 that is not on the wallet's network. `l1IsTestnet` is the network of the L1. */
export function otherNetworkText(l1IsTestnet: boolean): string {
  const name = networkName(l1IsTestnet);
  return `This L1 is on ${name}. Switch the wallet to ${name}.`;
}

/**
 * The text for a failed Data API read of the L1 on the page's own network (the Network toggle of L1 Node Setup). The
 * toggle, not the wallet, sets that network, so a miss (404 or 400) names the toggle.
 */
export function pageLookupErrorText(status: number | undefined, isTestnet: boolean): string {
  if (!isSubnetMiss(status)) return DATA_API_ERROR;
  const other = networkName(!isTestnet);
  return `This L1 is not on ${networkName(isTestnet)}. If it is a ${other} L1, set the Network to ${other}.`;
}

/** The text for an L1 that is not on the page's network (the Network toggle). `l1IsTestnet` is the network of the L1. */
export function pageOtherNetworkText(l1IsTestnet: boolean): string {
  const name = networkName(l1IsTestnet);
  return `This L1 is on ${name}. Set the Network to ${name}.`;
}

/**
 * The result of the field's read of the other network after a miss: the Data API has the L1 there ('found'), it does
 * not know the ID there either ('missing', a 404 or 400), or the read failed or did not run ('unknown').
 */
export type OtherNetworkRead = 'found' | 'missing' | 'unknown';

/**
 * The error of the Subnet ID field after a failed read on the network that it reads (`isTestnet`), or null.
 * - Any failure other than a miss (404 or 400) gets null: the field does not blame the ID for a Data API failure. The
 *   caller's own text shows (DATA_API_ERROR from useVMCAddress on the validator steps).
 * - A miss on the wallet's network: when the other network has the L1, the text tells the user to switch the wallet.
 *   Else the text of subnetLookupErrorText.
 * - A miss on the page's own network (`pageNetwork`, the Network toggle of L1 Node Setup): the texts name the toggle,
 *   not the wallet. When the other network has the L1, the text tells the user to set the Network to it. When the
 *   other network does not know the ID either, the text of subnetLookupErrorText, because a new L1 or a blockchain ID
 *   is the likely cause. When the field cannot tell, the text of pageLookupErrorText.
 */
export function subnetFieldErrorText(
  status: number | undefined,
  isTestnet: boolean,
  { otherNetwork = 'unknown', pageNetwork = false }: { otherNetwork?: OtherNetworkRead; pageNetwork?: boolean } = {},
): string | null {
  if (!isSubnetMiss(status)) return null;
  if (otherNetwork === 'found') return pageNetwork ? pageOtherNetworkText(!isTestnet) : otherNetworkText(!isTestnet);
  if (pageNetwork && otherNetwork === 'unknown') return pageLookupErrorText(status, isTestnet);
  return subnetLookupErrorText(status, isTestnet);
}

/** The field error for a value that is not a Subnet ID in form, or null. Every non-empty value gets the test. */
export function subnetIdFormatErrorText(value: string): string | null {
  if (!value) return null;
  try {
    // A Subnet ID is base58 of 32 bytes and a checksum: the last 4 bytes of their SHA-256 (addChecksum).
    // utils.base58check.decode only removes the checksum and does not test it, so this test does.
    const raw = utils.base58.decode(value);
    const valid = raw.length === 36 && utils.bytesEqual(utils.addChecksum(raw.subarray(0, 32)), raw);
    return valid ? null : SUBNET_ID_FORMAT_ERROR;
  } catch {
    return SUBNET_ID_FORMAT_ERROR;
  }
}
