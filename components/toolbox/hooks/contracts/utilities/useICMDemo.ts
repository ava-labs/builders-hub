import { useContractActions } from '../useContractActions';
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
export function useICMDemo(contractAddress: string | null, abi?: any): ICMDemoHook {
  const contract = useContractActions(contractAddress, abi ?? ICMDemoAbi.abi);

  return {
    lastMessage: () => contract.read('lastMessage') as Promise<bigint>,
    sendMessage: (destinationAddress, message, destinationBlockchainID) =>
      contract.write('sendMessage', [destinationAddress, message, destinationBlockchainID], 'Send ICM Message'),
    contractAddress: contract.contractAddress,
    isReady: contract.isReady,
  };
}
