import { useWalletStore } from '../../../stores/walletStore';
import { useViemChainStore } from '../../../stores/toolboxStore';
import { readContract } from 'viem/actions';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useWallet } from '../../useWallet';
import { useResolvedWalletClient } from '../../useResolvedWalletClient';
import ProxyAdminAbi from '@/contracts/openzeppelin-4.9/compiled/ProxyAdmin.json';

export interface ProxyAdminHook {
  // Read functions
  owner: () => Promise<string>;
  getProxyImplementation: (proxy: string) => Promise<string>;
  getProxyAdmin: (proxy: string) => Promise<string>;

  // Write functions
  transferOwnership: (newOwner: string) => Promise<string>;
  upgrade: (proxy: string, implementation: string) => Promise<string>;
  upgradeAndCall: (proxy: string, implementation: string, data: string) => Promise<string>;
  changeProxyAdmin: (proxy: string, newAdmin: string) => Promise<string>;

  // Metadata
  contractAddress: string | null;
  isReady: boolean;
}

/**
 * Hook for interacting with ProxyAdmin contracts
 * @param contractAddress - The address of the ProxyAdmin contract
 * @param abi - Optional custom ABI (defaults to ProxyAdmin.json abi)
 */
export function useProxyAdmin(
  contractAddress: string | null,
  abi?: any
): ProxyAdminHook {
  const { walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const { avalancheWalletClient } = useWallet();
  const walletClient = useResolvedWalletClient();

  const contractAbi = abi ?? ProxyAdminAbi.abi;
  const isReady = Boolean(contractAddress && walletClient && viemChain);

  // Read functions
  const owner = async (): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'owner',
      args: []
    }) as string;
  };

  const getProxyImplementation = async (proxy: string): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'getProxyImplementation',
      args: [proxy]
    }) as string;
  };

  const getProxyAdmin = async (proxy: string): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress) throw new Error('Contract not ready');

    return await readContract(avalancheWalletClient as any, {
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'getProxyAdmin',
      args: [proxy]
    }) as string;
  };

  // Write functions
  const transferOwnership = async (newOwner: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'transferOwnership',
      args: [newOwner],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Transfer Proxy Admin Ownership'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const upgrade = async (proxy: string, implementation: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'upgrade',
      args: [proxy, implementation],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Upgrade Proxy'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const upgradeAndCall = async (proxy: string, implementation: string, data: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'upgradeAndCall',
      args: [proxy, implementation, data],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Upgrade And Call Proxy'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const changeProxyAdmin = async (proxy: string, newAdmin: string): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'changeProxyAdmin',
      args: [proxy, newAdmin],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Change Proxy Admin'
    }, writePromise, viemChain);

    return await writePromise;
  };

  return {
    // Read functions
    owner,
    getProxyImplementation,
    getProxyAdmin,

    // Write functions
    transferOwnership,
    upgrade,
    upgradeAndCall,
    changeProxyAdmin,

    // Metadata
    contractAddress,
    isReady
  };
}
