import { useContractActions } from '../useContractActions';
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
  const contract = useContractActions(contractAddress, abi ?? ProxyAdminAbi.abi);

  return {
    // Read functions
    owner: () => contract.read('owner') as Promise<string>,
    getProxyImplementation: (proxy) => contract.read('getProxyImplementation', [proxy]) as Promise<string>,
    getProxyAdmin: (proxy) => contract.read('getProxyAdmin', [proxy]) as Promise<string>,

    // Write functions
    transferOwnership: (newOwner) =>
      contract.write('transferOwnership', [newOwner], 'Transfer Proxy Admin Ownership'),
    upgrade: (proxy, implementation) =>
      contract.write('upgrade', [proxy, implementation], 'Upgrade Proxy'),
    upgradeAndCall: (proxy, implementation, data) =>
      contract.write('upgradeAndCall', [proxy, implementation, data], 'Upgrade And Call Proxy'),
    changeProxyAdmin: (proxy, newAdmin) =>
      contract.write('changeProxyAdmin', [proxy, newAdmin], 'Change Proxy Admin'),

    // Metadata
    contractAddress: contract.contractAddress,
    isReady: contract.isReady,
  };
}
