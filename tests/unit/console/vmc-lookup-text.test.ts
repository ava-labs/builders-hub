import { describe, expect, it } from 'vitest';
import {
  DATA_API_ERROR,
  NOT_AN_L1,
  SUBNET_ID_FORMAT_ERROR,
  otherNetworkText,
  pageLookupErrorText,
  pageOtherNetworkText,
  subnetFieldErrorText,
  subnetIdFormatErrorText,
  subnetLookupErrorText,
} from '@/components/toolbox/utils/vmcLookupText';

const NOT_ON_FUJI =
  'This L1 is not on Fuji. A new L1 can take a minute to appear. Check that the ID is a Subnet ID, not a blockchain ID.';
const NOT_ON_MAINNET =
  'This L1 is not on Mainnet. A new L1 can take a minute to appear. Check that the ID is a Subnet ID, not a blockchain ID.';
const PAGE_NOT_ON_FUJI = 'This L1 is not on Fuji. If it is a Mainnet L1, set the Network to Mainnet.';
const PAGE_NOT_ON_MAINNET = 'This L1 is not on Mainnet. If it is a Fuji L1, set the Network to Fuji.';

// IDs with a correct checksum: the Primary Network, and the C-Chain blockchain IDs of Mainnet and Fuji
const PRIMARY_NETWORK = '11111111111111111111111111111111LpoYY';
const MAINNET_C_CHAIN = '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5';
const FUJI_C_CHAIN = 'yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp';

describe('subnetLookupErrorText', () => {
  it('names the network for a 404 or a 400, and says that a new L1 can take a minute to appear', () => {
    expect(subnetLookupErrorText(404, true)).toBe(NOT_ON_FUJI);
    expect(subnetLookupErrorText(400, true)).toBe(NOT_ON_FUJI);
    expect(subnetLookupErrorText(404, false)).toBe(NOT_ON_MAINNET);
  });

  it('blames the Data API for a server error, a rate limit or a network error', () => {
    expect(subnetLookupErrorText(500, true)).toBe(DATA_API_ERROR);
    expect(subnetLookupErrorText(503, false)).toBe(DATA_API_ERROR);
    expect(subnetLookupErrorText(429, true)).toBe(DATA_API_ERROR);
    expect(subnetLookupErrorText(undefined, true)).toBe(DATA_API_ERROR);
  });
});

describe('subnetFieldErrorText', () => {
  it('gives the same text as the Validator Manager lookup for a 404 or a 400', () => {
    expect(subnetFieldErrorText(404, true)).toBe(NOT_ON_FUJI);
    expect(subnetFieldErrorText(400, true)).toBe(NOT_ON_FUJI);
    expect(subnetFieldErrorText(404, false)).toBe(NOT_ON_MAINNET);
    expect(subnetFieldErrorText(404, true)).toBe(subnetLookupErrorText(404, true));
  });

  it('gives no field error for a 503, a 429 or a network error, so the caller shows its Data API text', () => {
    expect(subnetFieldErrorText(503, true)).toBeNull();
    expect(subnetFieldErrorText(429, false)).toBeNull();
    expect(subnetFieldErrorText(undefined, true)).toBeNull();
    // The field does not read the other network for these, and that result would change nothing
    expect(subnetFieldErrorText(503, true, { otherNetwork: 'found' })).toBeNull();
    expect(subnetFieldErrorText(503, true, { otherNetwork: 'found', pageNetwork: true })).toBeNull();
  });

  it('tells the user to switch the wallet when the L1 is on the other network', () => {
    expect(subnetFieldErrorText(404, false, { otherNetwork: 'found' })).toBe(
      'This L1 is on Fuji. Switch the wallet to Fuji.',
    );
    expect(subnetFieldErrorText(400, true, { otherNetwork: 'found' })).toBe(
      'This L1 is on Mainnet. Switch the wallet to Mainnet.',
    );
    expect(otherNetworkText(true)).toBe('This L1 is on Fuji. Switch the wallet to Fuji.');
  });

  it("gives the not-found text on the wallet's network when the other network does not have the L1", () => {
    expect(subnetFieldErrorText(404, true, { otherNetwork: 'missing' })).toBe(NOT_ON_FUJI);
    expect(subnetFieldErrorText(404, true, { otherNetwork: 'unknown' })).toBe(NOT_ON_FUJI);
  });

  it("names the page's Network toggle, not the wallet, on a page with its own network", () => {
    expect(subnetFieldErrorText(404, false, { otherNetwork: 'found', pageNetwork: true })).toBe(
      'This L1 is on Fuji. Set the Network to Fuji.',
    );
    expect(subnetFieldErrorText(400, true, { otherNetwork: 'found', pageNetwork: true })).toBe(
      'This L1 is on Mainnet. Set the Network to Mainnet.',
    );
    expect(subnetFieldErrorText(404, false, { otherNetwork: 'unknown', pageNetwork: true })).toBe(PAGE_NOT_ON_MAINNET);
    expect(subnetFieldErrorText(404, true, { pageNetwork: true })).toBe(PAGE_NOT_ON_FUJI);
  });

  it('gives the not-found text on a page with its own network when neither network knows the ID', () => {
    // A blockchain ID or a new L1: the toggle is not the fix
    expect(subnetFieldErrorText(404, false, { otherNetwork: 'missing', pageNetwork: true })).toBe(NOT_ON_MAINNET);
  });
});

describe('pageLookupErrorText', () => {
  it('names the Network toggle for a 404 or a 400', () => {
    expect(pageLookupErrorText(404, false)).toBe(PAGE_NOT_ON_MAINNET);
    expect(pageLookupErrorText(400, false)).toBe(PAGE_NOT_ON_MAINNET);
    expect(pageLookupErrorText(404, true)).toBe(PAGE_NOT_ON_FUJI);
  });

  it('blames the Data API for a server error, a rate limit or a network error', () => {
    expect(pageLookupErrorText(503, false)).toBe(DATA_API_ERROR);
    expect(pageLookupErrorText(429, true)).toBe(DATA_API_ERROR);
    expect(pageLookupErrorText(undefined, true)).toBe(DATA_API_ERROR);
  });
});

describe('pageOtherNetworkText', () => {
  it('tells the user to set the Network to the network of the L1', () => {
    expect(pageOtherNetworkText(true)).toBe('This L1 is on Fuji. Set the Network to Fuji.');
    expect(pageOtherNetworkText(false)).toBe('This L1 is on Mainnet. Set the Network to Mainnet.');
  });
});

describe('subnetIdFormatErrorText', () => {
  it('accepts an ID of 32 bytes with a correct checksum', () => {
    expect(subnetIdFormatErrorText(PRIMARY_NETWORK)).toBeNull();
    expect(subnetIdFormatErrorText(MAINNET_C_CHAIN)).toBeNull();
    expect(subnetIdFormatErrorText(FUJI_C_CHAIN)).toBeNull();
  });

  it('gives no error for an empty value', () => {
    expect(subnetIdFormatErrorText('')).toBeNull();
  });

  it('refuses a short value, a value that is not base58 and a Node ID', () => {
    expect(subnetIdFormatErrorText('abc123')).toBe(SUBNET_ID_FORMAT_ERROR);
    expect(subnetIdFormatErrorText('a')).toBe(SUBNET_ID_FORMAT_ERROR);
    expect(subnetIdFormatErrorText('0OIl')).toBe(SUBNET_ID_FORMAT_ERROR);
    expect(subnetIdFormatErrorText('NodeID-7Xhw2mDxuDS44j42TCB6U5579esbSt3Lg')).toBe(SUBNET_ID_FORMAT_ERROR);
  });

  it('refuses an ID with a typing error: the checksum does not match', () => {
    // One character changed, so the 32 bytes no longer match the checksum
    const typo = `${FUJI_C_CHAIN.slice(0, 10)}${FUJI_C_CHAIN[10] === 'a' ? 'b' : 'a'}${FUJI_C_CHAIN.slice(11)}`;
    expect(subnetIdFormatErrorText(typo)).toBe(SUBNET_ID_FORMAT_ERROR);
    // One character missing
    expect(subnetIdFormatErrorText(FUJI_C_CHAIN.slice(0, -1))).toBe(SUBNET_ID_FORMAT_ERROR);
  });
});

describe('NOT_AN_L1', () => {
  it('names the Data API delay after a conversion', () => {
    expect(NOT_AN_L1).toBe(
      'This is not an L1, or it has no Validator Manager. After a conversion, the Data API can take a few minutes ' +
        'to show the L1.',
    );
  });
});
