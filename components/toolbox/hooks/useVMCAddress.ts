import { useState, useEffect, useRef } from 'react';
import { networkIDs } from '@avalabs/avalanchejs';
import { getSubnetInfoForNetwork, getBlockchainInfoForNetwork, GlacierHttpError } from '../coreViem/utils/glacier';
import { useWalletStore } from '../stores/walletStore';
import { useViemChainStore } from '../stores/toolboxStore';
import { DATA_API_ERROR, NOT_AN_L1, NO_L1_SELECTED, subnetLookupErrorText } from '../utils/vmcLookupText';

// A subnet that the Data API shows as not an L1 can be an L1 that converted a few minutes ago: the Data API shows the
// conversion late. The hook reads the subnet again at this interval, for this time from the first read, then stops.
const NOT_AN_L1_RETRY_INTERVAL_MS = 20_000;
const NOT_AN_L1_RETRY_FOR_MS = 5 * 60_000;

/** Replaces the error of a Data API (Glacier) read with `text(status)`. A network error has no status. */
function fromDataApi<T>(read: Promise<T>, text: (status: number | undefined) => string): Promise<T> {
  return read.catch((e: unknown) => {
    throw new Error(text(e instanceof GlacierHttpError ? e.status : undefined));
  });
}

/**
 * Set when the connected wallet's EVM chain doesn't match the chain where the
 * VMC contract is deployed (its "home chain"). All EVM reads + writes against
 * the VMC must happen on this chain: typically the L1 itself for the
 * inheritance-model contracts, or C-Chain when the VMC is composed cross-chain.
 */
export interface VMCChainMismatch {
  expectedChainId: number;
  expectedChainName: string;
  currentChainId: number;
}

interface VMCAddressResult {
  validatorManagerAddress: string;
  /** Blockchain where the VMC contract is deployed (home chain) */
  blockchainId: string;
  /** The L1's own blockchain ID. Use this for uptimeBlockchainID */
  l1BlockchainId: string;
  signingSubnetId: string;
  isLoading: boolean;
  error: string | null;
  /** Non-null when the wallet is on a different EVM chain than the VMC's home chain. */
  chainMismatch: VMCChainMismatch | null;
}

/**
 * Hook A: Resolves the Validator Manager Contract address for a given subnetId
 * by querying the Glacier API. Results are cached per (network, subnetId) pair.
 */
export function useVMCAddress(subnetId: string): VMCAddressResult {
  const { avalancheNetworkID } = useWalletStore();
  const viemChain = useViemChainStore();

  const [validatorManagerAddress, setValidatorManagerAddress] = useState('');
  const [blockchainId, setBlockchainId] = useState('');
  const [l1BlockchainId, setL1BlockchainId] = useState('');
  const [signingSubnetId, setSigningSubnetId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chainMismatch, setChainMismatch] = useState<VMCChainMismatch | null>(null);

  // Cache to store fetched details for each subnetId to avoid redundant API calls
  const subnetCache = useRef<
    Record<
      string,
      {
        validatorManagerAddress: string;
        blockchainId: string;
        l1BlockchainId: string;
        signingSubnetId: string;
        expectedChainId: number;
        expectedChainName: string;
      }
    >
  >({});

  useEffect(() => {
    // A newer subnet, network or chain starts its own read, and the result of this one is dropped
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();
    // While the result is 'not an L1', read the subnet again until NOT_AN_L1_RETRY_FOR_MS is over
    const retryLater = () => {
      if (Date.now() - startedAt + NOT_AN_L1_RETRY_INTERVAL_MS > NOT_AN_L1_RETRY_FOR_MS) return;
      retryTimer = setTimeout(() => void fetchDetails(true), NOT_AN_L1_RETRY_INTERVAL_MS);
    };

    // `isRetry`: a read again after 'not an L1'. It keeps that text on the page until the L1 shows.
    const fetchDetails = async (isRetry: boolean) => {
      if (!subnetId || subnetId === '11111111111111111111111111111111LpoYY') {
        setValidatorManagerAddress('');
        setBlockchainId('');
        setL1BlockchainId('');
        setSigningSubnetId('');
        setError(NO_L1_SELECTED);
        setChainMismatch(null);
        setIsLoading(false);
        return;
      }

      if (!isRetry) {
        setIsLoading(true);
        setError(null);
      }

      const cacheKey = `${avalancheNetworkID}-${subnetId}`;
      const applyCachedAndMismatch = (cached: {
        validatorManagerAddress: string;
        blockchainId: string;
        l1BlockchainId: string;
        signingSubnetId: string;
        expectedChainId: number;
        expectedChainName: string;
      }) => {
        setValidatorManagerAddress(cached.validatorManagerAddress);
        setBlockchainId(cached.blockchainId);
        setL1BlockchainId(cached.l1BlockchainId);
        setSigningSubnetId(cached.signingSubnetId);
        if (viemChain && viemChain.id !== cached.expectedChainId) {
          setChainMismatch({
            expectedChainId: cached.expectedChainId,
            expectedChainName: cached.expectedChainName,
            currentChainId: viemChain.id,
          });
        } else {
          setChainMismatch(null);
        }
      };

      if (subnetCache.current[cacheKey]) {
        applyCachedAndMismatch(subnetCache.current[cacheKey]);
        setIsLoading(false);
        return;
      }

      try {
        const network = avalancheNetworkID === networkIDs.MainnetID ? 'mainnet' : 'testnet';

        // A 404 or a 400 here is the user's: the ID is not a Subnet ID on this network
        const subnetInfo = await fromDataApi(getSubnetInfoForNetwork(network, subnetId), (status) =>
          subnetLookupErrorText(status, network === 'testnet'),
        );
        if (cancelled) return;

        if (!subnetInfo.isL1 || !subnetInfo.l1ValidatorManagerDetails) {
          setValidatorManagerAddress('');
          setBlockchainId('');
          setL1BlockchainId('');
          setSigningSubnetId('');
          setError(NOT_AN_L1);
          setChainMismatch(null);
          setIsLoading(false);
          retryLater();
          return;
        }

        const vmcAddress = subnetInfo.l1ValidatorManagerDetails.contractAddress;
        const vmcBlockchainId = subnetInfo.l1ValidatorManagerDetails.blockchainId;

        // The Data API gave this blockchain ID itself, so any failure here is the service's
        const blockchainInfoForVMC = await fromDataApi(
          getBlockchainInfoForNetwork(network, vmcBlockchainId),
          () => DATA_API_ERROR,
        );
        if (cancelled) return;
        const expectedChainIdForVMC = blockchainInfoForVMC.evmChainId;
        const expectedChainName = blockchainInfoForVMC.blockchainName;

        // The signing subnet is the parent subnet of the chain where the VMC
        // is deployed. Warp messages originate from that chain, so its subnet's
        // validators must sign. This is NOT always the L1's own subnet: both
        // PoA and PoS L1s can have the VMC deployed on any chain (e.g. C-Chain
        // on the primary network, or the L1's own chain).
        const vmcSubnetId = blockchainInfoForVMC.subnetId;

        // The L1's own blockchain ID: the first blockchain on this subnet.
        // This is what should be used for uptimeBlockchainID in the staking manager,
        // NOT the VMC's home chain (which could be C-Chain for cross-chain setups).
        const l1ChainId = subnetInfo.blockchains?.[0]?.blockchainId || vmcBlockchainId;

        setValidatorManagerAddress(vmcAddress);
        setBlockchainId(vmcBlockchainId);
        setL1BlockchainId(l1ChainId);
        setSigningSubnetId(vmcSubnetId);

        // Promote mismatch out of `error` so the UI can render a CTA banner
        // instead of letting downstream contract reads fail noisily on the
        // wrong RPC.
        if (viemChain && viemChain.id !== expectedChainIdForVMC) {
          setChainMismatch({
            expectedChainId: expectedChainIdForVMC,
            expectedChainName,
            currentChainId: viemChain.id,
          });
        } else {
          setChainMismatch(null);
        }

        subnetCache.current[cacheKey] = {
          validatorManagerAddress: vmcAddress,
          blockchainId: vmcBlockchainId,
          l1BlockchainId: l1ChainId,
          signingSubnetId: vmcSubnetId,
          expectedChainId: expectedChainIdForVMC,
          expectedChainName,
        };
        setError(null);
      } catch (e: any) {
        if (cancelled) return;
        // A failed read again keeps the 'not an L1' text, and the next read again can still find the L1
        if (isRetry) {
          retryLater();
          return;
        }
        setValidatorManagerAddress('');
        setBlockchainId('');
        setL1BlockchainId('');
        setSigningSubnetId('');
        setError(e?.message || 'Could not load the Validator Manager for this L1.');
        setChainMismatch(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchDetails(false);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [subnetId, viemChain?.id, avalancheNetworkID]);

  return {
    validatorManagerAddress,
    blockchainId,
    l1BlockchainId,
    signingSubnetId,
    isLoading,
    error,
    chainMismatch,
  };
}
