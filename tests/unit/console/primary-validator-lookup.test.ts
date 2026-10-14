import { describe, expect, it } from 'vitest';
import {
  ACCEPTED_TX_TTL_MS,
  type AcceptedValidator,
  type ExistingValidatorInfo,
  VALIDATOR_NOT_LISTED_YET,
  configTxErrorText,
  configTxReady,
  existingValidatorFromApi,
  shownValidator,
} from '@/components/toolbox/utils/primaryValidatorLookup';
import { WALLET_REJECTED_TEXT } from '@/components/toolbox/lib/walletRejection';

const WALLET = 'P-fuji1walletaddress';
const OTHER = 'P-fuji1otheraddress';
const ADD_TX = 'add-tx-id';
const NOW = 1_800_000_000_000;

const autoRenewed = (periodHours: number, autoCompoundPct: number): ExistingValidatorInfo => ({
  kind: 'autoRenewed',
  txID: ADD_TX,
  isAuthority: true,
  stakeAvax: '1',
  periodHours,
  autoCompoundPct,
  authorityAddresses: [WALLET],
});

const fixed: ExistingValidatorInfo = {
  kind: 'fixed',
  txID: ADD_TX,
  isAuthority: false,
  stakeAvax: '1',
  endTime: 1_800_100_000,
  authorityAddresses: [],
};

const accepted = (info: ExistingValidatorInfo, ageMs = 0): AcceptedValidator => ({ info, acceptedAt: NOW - ageMs });

describe('existingValidatorFromApi', () => {
  it('reads an auto-renewed validator: hours, percent and the authority of the wallet', () => {
    const info = existingValidatorFromApi(
      {
        txID: ADD_TX,
        weight: '1000000000',
        endTime: '1800100000',
        nextPeriod: '46800',
        autoCompoundRewardShares: '500000',
        validatorAuthority: { addresses: [WALLET.replace(/^P-/, '')] },
      },
      WALLET,
    );
    expect(info).toEqual({ ...autoRenewed(13, 50), stakeAvax: (1).toLocaleString() });
  });

  it('reads a fixed-duration validator with its end time', () => {
    const info = existingValidatorFromApi({ txID: ADD_TX, weight: '1000000000', endTime: '1800100000' }, WALLET);
    expect(info).toEqual({ ...fixed, stakeAvax: (1).toLocaleString() });
  });
});

describe('shownValidator', () => {
  it('shows the API read when the page sent no tx for the NodeID', () => {
    expect(shownValidator(fixed, undefined, NOW, WALLET)).toEqual({ info: fixed, dropAccepted: false });
    expect(shownValidator(null, undefined, NOW, WALLET)).toEqual({ info: null, dropAccepted: false });
  });

  it('shows the accepted add when the cached API read has no validator yet', () => {
    const shown = shownValidator(null, accepted(fixed, 60_000), NOW, WALLET);
    expect(shown).toEqual({ info: { ...fixed, pending: true, listed: false }, dropAccepted: false });
  });

  it('shows the accepted config while the API read still has the old config', () => {
    const shown = shownValidator(autoRenewed(12, 0), accepted(autoRenewed(13, 50), 60_000), NOW, WALLET);
    expect(shown).toEqual({ info: { ...autoRenewed(13, 50), pending: true, listed: true }, dropAccepted: false });
  });

  it('does not count a validator of another tx as listed', () => {
    const older = { ...autoRenewed(12, 0), txID: 'older-tx-id' };
    const shown = shownValidator(older, accepted(autoRenewed(13, 50), 60_000), NOW, WALLET);
    expect(shown.info?.pending).toBe(true);
    expect(shown.info?.listed).toBe(false);
  });

  it('shows the API read, and drops the accepted values, once the API shows them', () => {
    expect(shownValidator(fixed, accepted(fixed), NOW, WALLET)).toEqual({ info: fixed, dropAccepted: true });
    const api = autoRenewed(13, 50);
    expect(shownValidator(api, accepted(autoRenewed(13, 50)), NOW, WALLET)).toEqual({ info: api, dropAccepted: true });
  });

  it('shows the API read after the accepted values expire, also when it differs', () => {
    const shown = shownValidator(
      autoRenewed(12, 0),
      accepted(autoRenewed(13, 50), ACCEPTED_TX_TTL_MS + 1),
      NOW,
      WALLET,
    );
    expect(shown).toEqual({ info: autoRenewed(12, 0), dropAccepted: true });
  });

  it('decides the authority from the wallet that is connected now', () => {
    const shown = shownValidator(null, accepted(autoRenewed(13, 50)), NOW, OTHER);
    expect(shown.info?.isAuthority).toBe(false);
    expect(shown.info?.pending).toBe(true);
  });
});

describe('configTxReady', () => {
  it('waits while the page shows an accepted add that the validator list does not show yet', () => {
    const afterAdd = shownValidator(null, accepted(autoRenewed(12, 0), 60_000), NOW, WALLET).info!;
    expect(configTxReady(afterAdd)).toBe(false);
  });

  it('is ready after an update (the list has the validator) and for an API read', () => {
    const afterUpdate = shownValidator(autoRenewed(12, 0), accepted(autoRenewed(13, 50), 60_000), NOW, WALLET).info!;
    expect(configTxReady(afterUpdate)).toBe(true);
    expect(configTxReady(autoRenewed(12, 0))).toBe(true);
  });

  it('is ready once the 30 s re-read shows the added validator', () => {
    const shown = shownValidator(autoRenewed(12, 0), accepted(autoRenewed(12, 0), 60_000), NOW, WALLET);
    expect(shown.dropAccepted).toBe(true);
    expect(configTxReady(shown.info!)).toBe(true);
  });
});

describe('configTxErrorText', () => {
  it('turns the SDK error of a validator that the cached list misses into the retry text', () => {
    // As @avalanche-sdk/client throws it when platform.getCurrentValidators does not list the add tx yet
    const sdk =
      'Auto-renewed validator P4VSAuC37XvLnXwXsNFau4vwkYBuwdr7E8jhziGMTXsqpZ9NT not found in current validators';
    expect(configTxErrorText(sdk)).toBe(VALIDATOR_NOT_LISTED_YET);
  });

  it('gives the one rejection text for a wallet rejection', () => {
    expect(configTxErrorText(new Error('User rejected the request.'))).toBe(WALLET_REJECTED_TEXT);
    expect(configTxErrorText(Object.assign(new Error('Request denied'), { code: 4001 }))).toBe(WALLET_REJECTED_TEXT);
  });

  it('keeps every other error as it is', () => {
    expect(configTxErrorText(new Error('HTTP 503'))).toBe('HTTP 503');
    expect(configTxErrorText('Auto-renewed validator x did not include validatorAuthority')).toBe(
      'Auto-renewed validator x did not include validatorAuthority',
    );
  });
});
