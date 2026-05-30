import { useState, useEffect, useRef } from 'react';
import { networkIDs } from '@avalabs/avalanchejs';
import { getSubnetInfoForNetwork, getBlockchainInfoForNetwork } from '../coreViem/utils/glacier';
import { useWalletStore } from '../stores/walletStore';
import { useViemChainStore } from '../stores/toolboxStore';

/**
 * Set when the connected wallet's EVM chain doesn't match the chain where the
 * VMC contract is deployed (its "home chain"). All EVM reads + writes against
 * the VMC must happen on this chain — typically the L1 itself for the
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
  /** The L1's own blockchain ID — use this for uptimeBlockchainID */
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
    const fetchDetails = async () => {
      if (!subnetId || subnetId === '11111111111111111111111111111111LpoYY') {
        setValidatorManagerAddress('');
        setBlockchainId('');
        setL1BlockchainId('');
        setSigningSubnetId('');
        setError('Please select a valid subnet ID.');
        setChainMismatch(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

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

        const subnetInfo = await getSubnetInfoForNetwork(network, subnetId);

        if (!subnetInfo.isL1 || !subnetInfo.l1ValidatorManagerDetails) {
          setValidatorManagerAddress('');
          setBlockchainId('');
          setL1BlockchainId('');
          setSigningSubnetId('');
          setError("Selected subnet is not an L1 or doesn\'t have a Validator Manager Contract.");
          setChainMismatch(null);
          setIsLoading(false);
          return;
        }

        const vmcAddress = subnetInfo.l1ValidatorManagerDetails.contractAddress;
        const vmcBlockchainId = subnetInfo.l1ValidatorManagerDetails.blockchainId;

        const blockchainInfoForVMC = await getBlockchainInfoForNetwork(network, vmcBlockchainId);
        const expectedChainIdForVMC = blockchainInfoForVMC.evmChainId;
        const expectedChainName = blockchainInfoForVMC.blockchainName;

        // The signing subnet is the parent subnet of the chain where the VMC
        // is deployed. Warp messages originate from that chain, so its subnet's
        // validators must sign. This is NOT always the L1's own subnet — both
        // PoA and PoS L1s can have the VMC deployed on any chain (e.g. C-Chain
        // on the primary network, or the L1's own chain).
        const vmcSubnetId = blockchainInfoForVMC.subnetId;

        // The L1's own blockchain ID — the first blockchain on this subnet.
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
        setValidatorManagerAddress('');
        setBlockchainId('');
        setL1BlockchainId('');
        setSigningSubnetId('');
        setError(e.message || 'Failed to fetch Validator Manager information for this subnet.');
        setChainMismatch(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
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
