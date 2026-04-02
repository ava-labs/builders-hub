import { useWalletStore } from '../../../stores/walletStore';
import { useViemChainStore } from '../../../stores/toolboxStore';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useChainPublicClient } from '../../useChainPublicClient';
import { useWalletClient } from 'wagmi';
import ICMDemoAbi from '@/contracts/example-contracts/compiled/ICMDemo.json';

export interface ICMDemoHook {
  // Read functions
  lastMessage: () => Promise<bigint>;

  // Write functions
  sendMessage: (destinationAddress: string, message: bigint, destinationBlockchainID: string) => Promise<string>;

  // Metadata
  contractAddress: string | null;
  isReady: boolean;
}

/**
 * Hook for interacting with ICMDemo contracts
 * @param contractAddress - The address of the ICMDemo contract
 * @param abi - Optional custom ABI (defaults to ICMDemo.json abi)
 */
export function useICMDemo(
  contractAddress: string | null,
  abi?: any
): ICMDemoHook {
  const { walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const publicClient = useChainPublicClient();
  const { data: walletClient } = useWalletClient();

  const contractAbi = abi ?? ICMDemoAbi.abi;
  const isReady = Boolean(contractAddress && walletClient && viemChain);

  // Read functions
  const lastMessage = async (): Promise<bigint> => {
    if (!publicClient || !contractAddress) throw new Error('Contract not ready');

    const result = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'lastMessage',
      args: []
    });

    return result as bigint;
  };

  // Write functions
  const sendMessage = async (
    destinationAddress: string,
    message: bigint,
    destinationBlockchainID: string
  ): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: contractAddress as `0x${string}`,
      abi: contractAbi,
      functionName: 'sendMessage',
      args: [
        destinationAddress as `0x${string}`,
        message,
        destinationBlockchainID as `0x${string}`
      ],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Send ICM Message'
    }, writePromise, viemChain);

    return await writePromise;
  };

  return {
    lastMessage,
    sendMessage,
    contractAddress,
    isReady
  };
}
