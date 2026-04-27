import { useERC20Token, ERC20TokenHook } from '../../useERC20Token';
import { useContractActions } from '../useContractActions';
import ExampleERC20Abi from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { parseEther } from 'viem';

/**
 * Extended ERC20 hook that includes mintable and burnable functionality
 * Uses composition pattern - extends useERC20Token like useWrappedNativeToken
 */
export type ExampleERC20Hook = ERC20TokenHook & {
  // Additional mint/burn functions
  mint: (to: string, amount: string) => Promise<string>;
  burn: (amount: string) => Promise<string>;
  burnFrom: (from: string, amount: string) => Promise<string>;

  // Access control functions
  grantRole: (role: string, account: string) => Promise<string>;
};

/**
 * Hook for interacting with ExampleERC20 contracts (mintable and burnable ERC20)
 * @param tokenAddress - The address of the ExampleERC20 contract
 */
export function useExampleERC20(tokenAddress: string | null): ExampleERC20Hook {
  // Get base ERC20 functionality
  const erc20Token = useERC20Token(tokenAddress, ExampleERC20Abi.abi);

  // Get contract actions for additional write functions
  const contract = useContractActions(tokenAddress, ExampleERC20Abi.abi);

  // Additional write functions
  const mint = (to: string, amount: string) =>
    contract.write('mint', [to, parseEther(amount)], 'Mint ExampleERC20 Token');

  const burn = (amount: string) => contract.write('burn', [parseEther(amount)], 'Burn ExampleERC20 Token');

  const burnFrom = (from: string, amount: string) =>
    contract.write('burnFrom', [from, parseEther(amount)], 'Burn From ExampleERC20 Token');

  const grantRole = (role: string, account: string) =>
    contract.write('grantRole', [role as `0x${string}`, account as `0x${string}`], 'Grant Role');

  // Return composition of base ERC20 and additional functions
  return {
    ...erc20Token,
    mint,
    burn,
    burnFrom,
    grantRole,
  };
}
