// What the Stake page shows for a NodeID lookup (platform.getCurrentValidators) after its own stake txs.
//
// The public API caches getCurrentValidators by its params for about 3 min. After the page's own tx is accepted, a
// lookup can show the old state: no validator after an add, or the old auto-renew config after an update. The page
// keeps what each accepted tx set (AcceptedValidator) and shows it until the API returns the same values.

import { WALLET_REJECTED_TEXT } from '@/components/toolbox/lib/walletRejection';
import { isWalletRejection } from '@/components/toolbox/utils/stakeTxText';

export type ExistingValidatorInfo = {
  kind: 'autoRenewed' | 'fixed';
  txID: string;
  isAuthority: boolean;
  stakeAvax: string;
  endTime?: number;
  periodHours?: number;
  autoCompoundPct?: number;
  authorityAddresses: string[];
  /** True when the values come from the page's own accepted tx, and the API does not show them yet. */
  pending?: boolean;
  /**
   * With `pending`: true when the API read lists this validator (the same tx ID), with its old values. False right
   * after the add. The SDK builds a config tx from the validator list, so the page waits for it (configTxReady).
   */
  listed?: boolean;
};

/** A Primary Network validator as platform.getCurrentValidators returns it (the fields that the page reads). */
export interface ApiPrimaryValidator {
  txID: string;
  endTime?: string;
  stakeAmount?: string;
  weight?: string;
  validatorAuthority?: { addresses?: string[] };
  nextPeriod?: string;
  autoCompoundRewardShares?: string;
}

/** What an accepted tx of the page set for one NodeID, and when. */
export interface AcceptedValidator {
  info: ExistingValidatorInfo;
  acceptedAt: number;
}

/**
 * How long the page shows an accepted tx's values over an API read that does not show them. The API cache holds a
 * read for about 3 min. After this time the API read wins, also when it differs: someone else may have changed the
 * validator.
 */
export const ACCEPTED_TX_TTL_MS = 10 * 60_000;

/** The text of a stake amount in AVAX, as the page shows it. */
export function stakeAvaxText(nAvax: number): string {
  return (nAvax / 1e9).toLocaleString();
}

/** The page's view of an API validator. `walletPAddress` is the connected wallet's P-Chain address. */
export function existingValidatorFromApi(v: ApiPrimaryValidator, walletPAddress: string): ExistingValidatorInfo {
  const stakeAvax = stakeAvaxText(Number(v.stakeAmount ?? v.weight ?? 0));
  const walletAddr = walletPAddress.replace(/^P-/, '');
  if (v.nextPeriod !== undefined || v.validatorAuthority) {
    const authorityAddresses = (v.validatorAuthority?.addresses ?? []).map((a) => (a.startsWith('P-') ? a : `P-${a}`));
    return {
      kind: 'autoRenewed',
      txID: v.txID,
      isAuthority: !!walletAddr && authorityAddresses.some((a) => a.replace(/^P-/, '') === walletAddr),
      stakeAvax,
      periodHours: Math.round(Number(v.nextPeriod ?? 0) / 3600),
      autoCompoundPct: Number(v.autoCompoundRewardShares ?? 0) / 10_000,
      authorityAddresses,
    };
  }
  return {
    kind: 'fixed',
    txID: v.txID,
    isAuthority: false,
    stakeAvax,
    endTime: Number(v.endTime ?? 0),
    authorityAddresses: [],
  };
}

/** True when the API read shows what the accepted tx set. */
export function apiShowsAccepted(api: ExistingValidatorInfo | null, accepted: ExistingValidatorInfo): boolean {
  if (!api || api.kind !== accepted.kind || api.txID !== accepted.txID) return false;
  if (accepted.kind === 'fixed') return true;
  return api.periodHours === accepted.periodHours && api.autoCompoundPct === accepted.autoCompoundPct;
}

/**
 * The validator that the page shows for a lookup, and whether the accepted tx's record can go: the API read shows
 * its values, or its time is over. Null: the node does not validate. The accepted values name the authority of the
 * wallet that sent the tx, so `walletPAddress` (the wallet now) decides isAuthority again.
 */
export function shownValidator(
  api: ExistingValidatorInfo | null,
  accepted: AcceptedValidator | undefined,
  now: number,
  walletPAddress: string,
): { info: ExistingValidatorInfo | null; dropAccepted: boolean } {
  if (!accepted) return { info: api, dropAccepted: false };
  if (apiShowsAccepted(api, accepted.info) || now - accepted.acceptedAt > ACCEPTED_TX_TTL_MS) {
    return { info: api, dropAccepted: true };
  }
  const walletAddr = walletPAddress.replace(/^P-/, '');
  const isAuthority =
    accepted.info.kind === 'autoRenewed' &&
    !!walletAddr &&
    accepted.info.authorityAddresses.some((a) => a.replace(/^P-/, '') === walletAddr);
  const listed = !!api && api.txID === accepted.info.txID;
  return { info: { ...accepted.info, isAuthority, pending: true, listed }, dropAccepted: false };
}

/**
 * True when the SDK can build a config tx (SetAutoRenewedValidatorConfigTx) for the shown validator: the values come
 * from the API, or the API already lists the validator. Right after the add, the list misses it for a few minutes.
 */
export function configTxReady(info: ExistingValidatorInfo): boolean {
  return !info.pending || !!info.listed;
}

/**
 * The text when the config tx cannot find the validator in the validator list. The SDK builds the tx from
 * platform.getCurrentValidators, which the public API caches for about 3 min. Right after the add, that list can miss a
 * validator that the page already shows.
 */
export const VALIDATOR_NOT_LISTED_YET =
  'The validator list does not show this validator yet. Try again in a few minutes.';

/** The page's text for an error of the config tx (SetAutoRenewedValidatorConfigTx). Other errors keep their text. */
export function configTxErrorText(err: unknown): string {
  if (isWalletRejection(err)) return WALLET_REJECTED_TEXT;
  const message = err instanceof Error ? err.message : String(err);
  return /not found in current validators/.test(message) ? VALIDATOR_NOT_LISTED_YET : message;
}
