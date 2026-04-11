import { useState, useEffect, useRef } from 'react';
import { networkIDs } from '@avalabs/avalanchejs';
import { getSubnetInfoForNetwork, getBlockchainInfoForNetwork } from '../coreViem/utils/glacier';
import { useWalletStore } from '../stores/walletStore';
import { useViemChainStore } from '../stores/toolboxStore';

interface VMCAddressResult {
  validatorManagerAddress: string;
  blockchainId: string;
  signingSubnetId: string;
  isLoading: boolean;
  error: string | null;
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
  const [signingSubnetId, setSigningSubnetId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Cache to store fetched details for each subnetId to avoid redundant API calls
  const subnetCache = useRef<
    Record<
      string,
      {
        validatorManagerAddress: string;
        blockchainId: string;
        signingSubnetId: string;
      }
    >
  >({});

  useEffect(() => {
    const fetchDetails = async () => {
      if (!subnetId || subnetId === '11111111111111111111111111111111LpoYY') {
        setValidatorManagerAddress('');
        setBlockchainId('');
        setSigningSubnetId('');
        setError('Please select a valid subnet ID.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const cacheKey = `${avalancheNetworkID}-${subnetId}`;
      if (subnetCache.current[cacheKey]) {
        const cached = subnetCache.current[cacheKey];
        setValidatorManagerAddress(cached.validatorManagerAddress);
        setBlockchainId(cached.blockchainId);
        setSigningSubnetId(cached.signingSubnetId);
        setIsLoading(false);
        return;
      }

      try {
        const network = avalancheNetworkID === networkIDs.MainnetID ? 'mainnet' : 'testnet';

        const subnetInfo = await getSubnetInfoForNetwork(network, subnetId);

        if (!subnetInfo.isL1 || !subnetInfo.l1ValidatorManagerDetails) {
          setValidatorManagerAddress('');
          setBlockchainId('');
          setSigningSubnetId('');
          setError("Selected subnet is not an L1 or doesn\'t have a Validator Manager Contract.");
          setIsLoading(false);
          return;
        }

        const vmcAddress = subnetInfo.l1ValidatorManagerDetails.contractAddress;
        const vmcBlockchainId = subnetInfo.l1ValidatorManagerDetails.blockchainId;

        const blockchainInfoForVMC = await getBlockchainInfoForNetwork(network, vmcBlockchainId);
        const expectedChainIdForVMC = blockchainInfoForVMC.evmChainId;

        if (viemChain && viemChain.id !== expectedChainIdForVMC) {
          setError(`Switch to chain ${expectedChainIdForVMC} to write to this Validator Manager`);
          // Don't return — still resolve the address for read-only consumers
        }

        // The signing subnet is the parent subnet of the chain where the VMC
        // is deployed. Warp messages originate from that chain, so its subnet's
        // validators must sign. This is NOT always the L1's own subnet — both
        // PoA and PoS L1s can have the VMC deployed on any chain (e.g. C-Chain
        // on the primary network, or the L1's own chain).
        const vmcSubnetId = blockchainInfoForVMC.subnetId;

        setValidatorManagerAddress(vmcAddress);
        setBlockchainId(vmcBlockchainId);
        setSigningSubnetId(vmcSubnetId);

        // Cache the fetched details
        subnetCache.current[cacheKey] = {
          validatorManagerAddress: vmcAddress,
          blockchainId: vmcBlockchainId,
          signingSubnetId: vmcSubnetId,
        };
        setError(null);
      } catch (e: any) {
        setValidatorManagerAddress('');
        setBlockchainId('');
        setSigningSubnetId('');
        setError(e.message || 'Failed to fetch Validator Manager information for this subnet.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [subnetId, viemChain?.id, avalancheNetworkID]);

  return {
    validatorManagerAddress,
    blockchainId,
    signingSubnetId,
    isLoading,
    error,
  };
}
