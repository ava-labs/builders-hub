import { describe, expect, it } from 'vitest';
import { networkIDs } from '@avalabs/avalanchejs';
import { checkSubnetField, subnetFieldNetwork, type SubnetRead } from '@/components/toolbox/components/InputSubnetId';
import { GlacierHttpError } from '@/components/toolbox/coreViem/utils/glacier';
import { SUBNET_ID_FORMAT_ERROR } from '@/components/toolbox/utils/vmcLookupText';

// IDs with a correct checksum. The stub Data API below decides on which network each one is a subnet. UNKNOWN_ID (the
// Primary Network's ID) is a subnet on neither network of the stub, like a blockchain ID or a new L1.
const MAINNET_ID = '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5';
const FUJI_ID = 'yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp';
const UNKNOWN_ID = '11111111111111111111111111111111LpoYY';

const NOT_ON_MAINNET =
  'This L1 is not on Mainnet. A new L1 can take a minute to appear. Check that the ID is a Subnet ID, not a blockchain ID.';
const NOT_ON_FUJI =
  'This L1 is not on Fuji. A new L1 can take a minute to appear. Check that the ID is a Subnet ID, not a blockchain ID.';

type Network = 'testnet' | 'mainnet';

/**
 * A stub of the Data API: each ID is a subnet on one network. `fail` makes every read of a network fail with that
 * status. `onRead` runs before each read.
 */
function stubDataApi(fail: Partial<Record<Network, number>> = {}, onRead?: () => void) {
  const reads: Network[] = [];
  const subnets: Record<Network, string[]> = { mainnet: [MAINNET_ID], testnet: [FUJI_ID] };
  const read: SubnetRead = async (network, subnetId) => {
    reads.push(network);
    onRead?.();
    const status = fail[network];
    if (status) throw new GlacierHttpError('Service Unavailable', status);
    if (!subnets[network].includes(subnetId)) throw new GlacierHttpError('Not Found', 404);
    return { subnetId };
  };
  return { read, reads };
}

const signal = () => new AbortController().signal;

describe('subnetFieldNetwork', () => {
  it("reads the caller's network when the caller sets it", () => {
    expect(subnetFieldNetwork(false, networkIDs.FujiID)).toEqual({ isTestnet: false, pageNetwork: true });
    expect(subnetFieldNetwork(true, networkIDs.MainnetID)).toEqual({ isTestnet: true, pageNetwork: true });
  });

  it("reads the wallet's network when the caller does not set one", () => {
    expect(subnetFieldNetwork(undefined, networkIDs.FujiID)).toEqual({ isTestnet: true, pageNetwork: false });
    expect(subnetFieldNetwork(undefined, networkIDs.MainnetID)).toEqual({ isTestnet: false, pageNetwork: false });
  });
});

describe('checkSubnetField on a page with its own network (L1 Node Setup)', () => {
  // The Network toggle is on Mainnet, and the wallet store is on Fuji (its default with no wallet). The texts name the
  // toggle, not the wallet.
  const pageMainnet = { ...subnetFieldNetwork(false, networkIDs.FujiID), readOnly: false };

  it('gives no error for a Mainnet L1, and reads only Mainnet', async () => {
    const api = stubDataApi();
    const check = await checkSubnetField(MAINNET_ID, pageMainnet, signal(), api.read);
    expect(check).toEqual({ status: 'found', error: null });
    expect(api.reads).toEqual(['mainnet']);
  });

  it('tells the user to set the Network for an L1 of the other network, with one more read', async () => {
    const api = stubDataApi();
    const check = await checkSubnetField(FUJI_ID, pageMainnet, signal(), api.read);
    expect(check).toEqual({ status: 'not-found', error: 'This L1 is on Fuji. Set the Network to Fuji.' });
    expect(api.reads).toEqual(['mainnet', 'testnet']);
  });

  it('gives the not-found text for an ID that neither network knows (a blockchain ID or a new L1)', async () => {
    const api = stubDataApi();
    const check = await checkSubnetField(UNKNOWN_ID, pageMainnet, signal(), api.read);
    expect(check).toEqual({ status: 'not-found', error: NOT_ON_MAINNET });
    expect(api.reads).toEqual(['mainnet', 'testnet']);
  });

  it('names the toggle when the read of the other network fails', async () => {
    const api = stubDataApi({ testnet: 503 });
    const check = await checkSubnetField(FUJI_ID, pageMainnet, signal(), api.read);
    expect(check).toEqual({
      status: 'not-found',
      error: 'This L1 is not on Mainnet. If it is a Fuji L1, set the Network to Fuji.',
    });
    expect(api.reads).toEqual(['mainnet', 'testnet']);
  });

  it('names the toggle, with no read of the other network, when a newer value aborts the check', async () => {
    const controller = new AbortController();
    const api = stubDataApi({}, () => controller.abort());
    const pageFuji = { ...subnetFieldNetwork(true, networkIDs.MainnetID), readOnly: false };
    const check = await checkSubnetField(MAINNET_ID, pageFuji, controller.signal, api.read);
    expect(check).toEqual({
      status: 'not-found',
      error: 'This L1 is not on Fuji. If it is a Mainnet L1, set the Network to Mainnet.',
    });
    expect(api.reads).toEqual(['testnet']);
  });

  it('reports a Data API failure with no field text and no read of the other network', async () => {
    const api = stubDataApi({ mainnet: 503 });
    expect(await checkSubnetField(FUJI_ID, pageMainnet, signal(), api.read)).toEqual({ status: 'failed', error: null });
    expect(api.reads).toEqual(['mainnet']);
  });
});

describe("checkSubnetField on the wallet's network", () => {
  const walletFuji = { ...subnetFieldNetwork(undefined, networkIDs.FujiID), readOnly: false };

  it('finds a Fuji L1 with one read', async () => {
    const api = stubDataApi();
    expect(await checkSubnetField(FUJI_ID, walletFuji, signal(), api.read)).toEqual({ status: 'found', error: null });
    expect(api.reads).toEqual(['testnet']);
  });

  it('tells the user to switch the wallet for an L1 of the other network', async () => {
    const api = stubDataApi();
    expect(await checkSubnetField(MAINNET_ID, walletFuji, signal(), api.read)).toEqual({
      status: 'not-found',
      error: 'This L1 is on Mainnet. Switch the wallet to Mainnet.',
    });
    expect(api.reads).toEqual(['testnet', 'mainnet']);
  });

  it('gives the not-found text when neither network knows the ID, or when the other read fails', async () => {
    for (const fail of [{}, { mainnet: 503 }]) {
      const api = stubDataApi(fail);
      expect(await checkSubnetField(UNKNOWN_ID, walletFuji, signal(), api.read)).toEqual({
        status: 'not-found',
        error: NOT_ON_FUJI,
      });
      expect(api.reads).toEqual(['testnet', 'mainnet']);
    }
  });

  it('reports a Data API failure with no field text and no read of the other network', async () => {
    for (const status of [503, 429]) {
      const api = stubDataApi({ testnet: status, mainnet: status });
      expect(await checkSubnetField(FUJI_ID, walletFuji, signal(), api.read)).toEqual({
        status: 'failed',
        error: null,
      });
      expect(api.reads).toEqual(['testnet']);
    }
  });

  it('refuses a value that is not a Subnet ID in form, with no read', async () => {
    const api = stubDataApi();
    expect(await checkSubnetField('abc123', walletFuji, signal(), api.read)).toEqual({
      status: 'not-found',
      error: SUBNET_ID_FORMAT_ERROR,
    });
    expect(api.reads).toEqual([]);
  });
});

describe('checkSubnetField on a read-only field (Explorer Setup)', () => {
  // The caller filled in the value from the chain's own network, so the wallet's network does not apply
  const readOnly = { ...subnetFieldNetwork(undefined, networkIDs.FujiID), readOnly: true };

  it('does not read the Data API and gives no error', async () => {
    const api = stubDataApi();
    expect(await checkSubnetField(MAINNET_ID, readOnly, signal(), api.read)).toEqual({ status: null, error: null });
    expect(api.reads).toEqual([]);
  });
});
