import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { MultisigInfo } from './MultisigInfo';
import { AlertCircle } from 'lucide-react';
import { Toggle } from './Toggle';
import Safe from '@safe-global/protocol-kit';
import SafeApiKit from '@safe-global/api-kit';
import { ethers } from 'ethers';
import { MetaTransactionData } from '@safe-global/types-kit';
import validatorManagerAbi from '../../contracts/icm-contracts/compiled/ValidatorManager.json';
import poaManagerAbi from '../../contracts/icm-contracts/compiled/PoAManager.json';
import { useWalletStore } from '../stores/walletStore';
import { useViemChainStore } from '../stores/toolboxStore';

interface ChainConfig {
  chainId: string;
  chainName: string;
  transactionService: string;
  [key: string]: any;
}

interface MultisigOptionProps {
  validatorManagerAddress: string;
  functionName: string;
  args: any[];
  onSuccess: (txHash: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

/**
 * MultisigOption Component
 * 
 * A wrapper component that provides multisig functionality for ValidatorManager operations.
 * This component automatically detects if the current user is the contract owner and conditionally
 * renders either direct transaction capabilities or Ash Wallet multisig proposal interface.
 * 
 * @example
 * ```tsx
 * <MultisigOption
 *   validatorManagerAddress="0x123..."
 *   functionName="completeValidatorRegistration"
 *   args={[validationID]}
 *   onSuccess={(txHash) => console.log('Success:', txHash)}
 *   onError={(error) => console.error('Error:', error)}
 *   disabled={!validationID}
 * >
 *   <Button onClick={handleDirectTransaction}>
 *     Complete Registration
 *   </Button>
 * </MultisigOption>
 * ```
 * 
 * Behavior:
 * - Shows Ash Wallet toggle and multisig interface
 * - When multisig is enabled: Initializes Safe SDK and allows proposing transactions
 * - Children are disabled when multisig is not enabled
 * 
 * Requirements:
 * - ValidatorManager contract must have PoAManager as owner
 * - PoAManager must have Safe contract as owner
 * - Current wallet must be a signer of the Safe contract
 * - Chain must be supported by Safe Transaction Service
 * 
 * @param validatorManagerAddress - Address of the ValidatorManager contract
 * @param functionName - Function name to call on PoAManager (e.g., "completeValidatorRegistration")
 * @param args - Arguments array to pass to the function
 * @param onSuccess - Callback when transaction/proposal succeeds, receives transaction hash
 * @param onError - Callback when error occurs, receives error message
 * @param disabled - Whether the action should be disabled
 * @param children - Content to render for direct transaction (when user is not using multisig)
 */

export const MultisigOption: React.FC<MultisigOptionProps> = ({
  validatorManagerAddress,
  functionName,
  args,
  onSuccess,
  onError,
  disabled,
  children
}) => {
  const [useMultisig, setUseMultisig] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [isExecutingDirect, setIsExecutingDirect] = useState(false);
  const [protocolKit, setProtocolKit] = useState<any>(null);
  const [apiKit, setApiKit] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [poaManagerAddress, setPoaManagerAddress] = useState('');
  const [safeAddress, setSafeAddress] = useState('');
  const [safeInfo, setSafeInfo] = useState<any>(null);
  const [isPoaOwner, setIsPoaOwner] = useState<boolean | null>(null);
  const [isCheckingOwnership, setIsCheckingOwnership] = useState(false);

  const { coreWalletClient, publicClient } = useWalletStore();
  const viemChain = useViemChainStore();

  // Check wallet connection and ownership on mount
  useEffect(() => {
    checkWalletAndOwnership();
  }, [validatorManagerAddress]);

  // Initialize when user chooses multisig
  useEffect(() => {
    if (useMultisig && !protocolKit) {
      initializeMultisig();
    }
  }, [useMultisig]);

  const checkWalletAndOwnership = async () => {
    setIsCheckingOwnership(true);
    try {
      if (!window.ethereum) {
        setIsPoaOwner(false);
        return;
      }

      // Get current wallet address
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setWalletAddress(address);

      // Get PoAManager address by calling owner() on ValidatorManager
      const validatorManagerContract = new ethers.Contract(
        validatorManagerAddress,
        validatorManagerAbi.abi,
        provider
      );
      const poaManagerAddr = await validatorManagerContract.owner();
      setPoaManagerAddress(poaManagerAddr);

      // Get owner of PoAManager
      const poaManagerContract = new ethers.Contract(
        poaManagerAddr,
        poaManagerAbi.abi,
        provider
      );
      const poaOwner = await poaManagerContract.owner();

      // Check if current wallet is the owner of PoAManager
      const isOwner = poaOwner.toLowerCase() === address.toLowerCase();
      setIsPoaOwner(isOwner);

      // If not the owner, get the Safe address for potential multisig
      if (!isOwner) {
        setSafeAddress(poaOwner);
      }

    } catch (err) {
      console.error('Failed to check ownership:', err);
      setIsPoaOwner(false);
    } finally {
      setIsCheckingOwnership(false);
    }
  };

  const getSupportedChain = async (chainId: string): Promise<string> => {
    try {
      const response = await fetch('/api/safe_chains');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      const supportedChain = data.results.find((chain: ChainConfig) => chain.chainId === chainId);
      if (!supportedChain) {
        throw new Error(`Chain ${chainId} is not supported for Ash L1 Multisig operations`);
      }
      
      // Append /api to the transaction service URL if it doesn't already have it
      let txServiceUrl = supportedChain.transactionService;
      if (!txServiceUrl.endsWith('/api') && !txServiceUrl.includes('/api/')) {
        txServiceUrl = txServiceUrl.endsWith('/') ? txServiceUrl + 'api' : txServiceUrl + '/api';
      }
      
      return txServiceUrl;
    } catch (error) {
      throw new Error(`Failed to fetch supported chains: ${(error as Error).message}`);
    }
  };

  const initializeMultisig = async () => {
    setIsInitializing(true);
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask not found');
      }

      if (!poaManagerAddress || !safeAddress) {
        throw new Error('PoAManager or Safe address not determined');
      }

      // Connect wallet
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();

      // Check if chain is supported and get transaction service URL
      const txServiceUrl = await getSupportedChain(network.chainId.toString());

      // Initialize Safe API Kit with the transaction service URL
      const apiKitInstance = new SafeApiKit({ 
        chainId: BigInt(network.chainId),
        txServiceUrl: txServiceUrl
      });
      setApiKit(apiKitInstance);

      // Get Safe info to validate and check ownership
      try {
        const safeInfo = await apiKitInstance.getSafeInfo(safeAddress);
        setSafeInfo(safeInfo);
        
        // Check if the current wallet address is one of the Safe owners
        const isOwner = safeInfo.owners.some((owner: string) => 
          owner.toLowerCase() === address.toLowerCase()
        );
        
        if (!isOwner) {
          throw new Error(`Wallet address ${address} is not an owner of the Ash L1 Multisig at ${safeAddress}`);
        }
        
      } catch (err) {
        throw new Error(`Invalid Safe contract at address ${safeAddress}: ${(err as Error).message}`);
      }

      // Initialize Safe Protocol Kit with the Safe address
      const protocolKitInstance = await Safe.init({ 
        provider: window.ethereum! as any,
        signer: address,
        safeAddress: safeAddress
      });
      setProtocolKit(protocolKitInstance);

    } catch (err) {
      onError(`Failed to initialize Ash L1 Multisig: ${(err as Error).message}`);
      setUseMultisig(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const proposeTransaction = async () => {
    if (!protocolKit || !apiKit || !poaManagerAddress || !safeAddress) {
      onError('Safe SDK not initialized or addresses not found');
      return;
    }

    setIsProposing(true);
    try {
      const contractInterface = new ethers.Interface(poaManagerAbi.abi);
      const functionData = contractInterface.encodeFunctionData(functionName, args);
      
      const safeTransactionData: MetaTransactionData = {
        to: ethers.getAddress(poaManagerAddress),
        data: functionData,
        value: "0",
        operation: 0
      };
      
      const nonceString = await apiKit.getNextNonce(safeAddress);
      const nonceNumber = Number(nonceString);
      
      const safeTransaction = await protocolKit.createTransaction({
        transactions: [safeTransactionData],
        options: { nonce: nonceNumber, safeTxGas: 0 }
      });
      
      const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
      const signature = await protocolKit.signHash(safeTxHash);
      
      const proposalData = {
        safeAddress: ethers.getAddress(safeAddress),
        safeTransactionData: {
          ...safeTransaction.data,
          to: ethers.getAddress(safeTransaction.data.to),
          nonce: Number(safeTransaction.data.nonce),
        },
        safeTxHash,
        senderAddress: ethers.getAddress(walletAddress),
        senderSignature: signature.data,
        origin: 'Avalanche Toolbox'
      };
      
      await apiKit.proposeTransaction(proposalData);
      
      onSuccess(safeTxHash);
    } catch (err) {
      onError(`Failed to propose transaction: ${(err as Error).message}`);
    } finally {
      setIsProposing(false);
    }
  };

  const executeDirectTransaction = async () => {
    if (!poaManagerAddress) {
      onError('PoAManager address not found');
      return;
    }

    setIsExecutingDirect(true);
    try {
      const txHash = await coreWalletClient.writeContract({
        address: poaManagerAddress as `0x${string}`,
        abi: poaManagerAbi.abi,
        functionName: functionName,
        args: args,
        chain: viemChain,
        account: coreWalletClient.account!,
      });

      // Wait for transaction receipt
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status === 'reverted') {
        throw new Error(`Transaction reverted. Hash: ${txHash}`);
      }

      onSuccess(txHash);
    } catch (err: any) {
      let message = err instanceof Error ? err.message : String(err);
      
      // Handle specific error types
      if (message.includes('User rejected')) {
        message = 'Transaction was rejected by user';
      } else if (message.includes('insufficient funds')) {
        message = 'Insufficient funds for transaction';
      } else if (message.includes('execution reverted')) {
        message = `Transaction reverted: ${message}`;
      }
      
      onError(`Direct transaction failed: ${message}`);
    } finally {
      setIsExecutingDirect(false);
    }
  };

  // Show toggle and multisig interface
  return (
    <div className="space-y-4">
      {isCheckingOwnership && (
        <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-base">
          <div className="flex items-center justify-center">
            <span>Checking ownership...</span>
          </div>
        </div>
      )}

      {/* Show direct transaction if user is PoA owner */}
      {isPoaOwner === true && (
        <div className="space-y-3">
          <div className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <p className="text-green-700 dark:text-green-300 font-medium text-sm">
                You are the owner of this PoAManager. You can execute transactions directly.
              </p>
            </div>
          </div>
          
          {/* Direct transaction button */}
          <Button
            onClick={executeDirectTransaction}
            disabled={disabled || isExecutingDirect}
            loading={isExecutingDirect}
            loadingText="Executing transaction..."
          >
            Execute Directly on PoAManager
          </Button>
        </div>
      )}

      {/* Show multisig interface if user is NOT PoA owner */}
      {isPoaOwner === false && (
        <>
          <div className="p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center space-x-4 flex-1">
                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                <div className="flex-1 px-1">
                  <p className="text-yellow-700 dark:text-yellow-300 font-medium text-sm leading-tight">
                    This PoAManager is owned by a multisig. Enable Ash Wallet to propose transactions.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 flex-shrink-0">
                <img 
                  src="/images/ash.png" 
                  alt="Ash" 
                  className="h-5 w-5 flex-shrink-0"
                />
                <Toggle
                  label="Ash Wallet"
                  checked={useMultisig}
                  onChange={setUseMultisig}
                />
              </div>
            </div>
          </div>

          {useMultisig && (
            <div className="space-y-3">
              {!protocolKit && (
                <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-base">
                  <div className="flex items-center justify-center">
                    <img 
                      src="/images/ash.png" 
                      alt="Ash" 
                      className="h-6 w-6 mr-3 flex-shrink-0"
                    />
                    <span>{isInitializing ? 'Initializing Ash Wallet...' : 'Ready to initialize Ash Wallet'}</span>
                  </div>
                </div>
              )}
              
              {safeInfo && (
                <MultisigInfo safeInfo={safeInfo} walletAddress={walletAddress} />
              )}
              
              <Button
                onClick={proposeTransaction}
                disabled={disabled || !protocolKit || isProposing}
                loading={isProposing}
                loadingText="Proposing to Ash Wallet..."
              >
                Propose to Ash Wallet
              </Button>
              
              <Button
                onClick={() => {
                  setUseMultisig(false);
                  setProtocolKit(null);
                  setApiKit(null);
                  setPoaManagerAddress('');
                  setSafeAddress('');
                  setSafeInfo(null);
                }}
                variant="outline"
                size="sm"
              >
                Cancel Multisig
              </Button>
            </div>
          )}

          {!useMultisig && (
            <div className="opacity-50 pointer-events-none">
              {children}
            </div>
          )}
        </>
      )}
    </div>
  );
}; 