import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { MultisigInfo } from './MultisigInfo';
import { AlertCircle } from 'lucide-react';
import { Toggle } from './Toggle';
import Safe from '@safe-global/protocol-kit';
import { ethers } from 'ethers';
import { MetaTransactionData } from '@safe-global/types-kit';
import validatorManagerAbi from '../../contracts/icm-contracts/compiled/ValidatorManager.json';
import multisigValidatorManagerAbi from '../../contracts/icm-contracts/compiled/MultisigValidatorManager.json';

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
 *   isContractOwner={isOwner}
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
 * - If isContractOwner === true: Renders children directly (normal transaction flow)
 * - If isContractOwner === false: Shows Ash Wallet toggle and multisig interface
 * - When multisig is enabled: Initializes Safe SDK and allows proposing transactions
 * - Children are disabled when user is not owner and multisig is not enabled
 * 
 * Requirements:
 * - ValidatorManager contract must have MultisigValidatorManager as owner
 * - MultisigValidatorManager must have Safe contract as owner
 * - Current wallet must be a signer of the Safe contract
 * - Chain must be supported by Safe Transaction Service
 * 
 * @param isContractOwner - Whether current wallet is the direct owner of the ValidatorManager
 * @param validatorManagerAddress - Address of the ValidatorManager contract
 * @param functionName - Function name to call on MultisigValidatorManager (e.g., "completeValidatorRegistration")
 * @param args - Arguments array to pass to the function
 * @param onSuccess - Callback when transaction/proposal succeeds, receives transaction hash
 * @param onError - Callback when error occurs, receives error message
 * @param disabled - Whether the action should be disabled
 * @param children - Content to render for direct transaction (when user is contract owner)
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
  const [protocolKit, setProtocolKit] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [multisigValidatorManagerAddress, setMultisigValidatorManagerAddress] = useState('');
  const [safeAddress, setSafeAddress] = useState('');
  const [safeInfo, setSafeInfo] = useState<any>(null);

  // Initialize when user chooses multisig
  useEffect(() => {
    if (useMultisig && !protocolKit) {
      initializeMultisig();
    }
  }, [useMultisig]);

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
      
      return supportedChain.transactionService;
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

      // Connect wallet
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      
      setWalletAddress(address);

      // Check if chain is supported and get transaction service URL
      const txServiceUrl = await getSupportedChain(network.chainId.toString());

      // Get MultisigValidatorManager address by calling owner() on ValidatorManager
      const validatorManagerContract = new ethers.Contract(
        validatorManagerAddress,
        validatorManagerAbi.abi,
        provider
      );
      const multisigValidatorManagerAddr = await validatorManagerContract.owner();
      setMultisigValidatorManagerAddress(multisigValidatorManagerAddr);

      // Get Safe address by calling owner() on MultisigValidatorManager
      const multisigValidatorManagerContract = new ethers.Contract(
        multisigValidatorManagerAddr,
        multisigValidatorManagerAbi.abi,
        provider
      );
      const safeAddr = await multisigValidatorManagerContract.owner();
      setSafeAddress(safeAddr);

      // Validate that the Safe address is actually a valid Safe contract using our proxy
      try {
        const safeInfoResponse = await fetch(`/api/safe/${network.chainId}/safes/${safeAddr}`);
        if (!safeInfoResponse.ok) {
          const errorData = await safeInfoResponse.json();
          throw new Error(errorData.error || 'Failed to fetch Safe info');
        }
        
        const safeInfo = await safeInfoResponse.json();
        console.log('Safe contract validated:', safeInfo);
        setSafeInfo(safeInfo);
        
        // Check if the current wallet address is one of the Safe owners
        const isOwner = safeInfo.owners.some((owner: string) => 
          owner.toLowerCase() === address.toLowerCase()
        );
        
        if (!isOwner) {
          throw new Error(`Wallet address ${address} is not an owner of the Ash L1 Multisig at ${safeAddr}`);
        }
        
      } catch (err) {
        throw new Error(`Invalid Safe contract at address ${safeAddr}: ${(err as Error).message}`);
      }

      // Initialize Safe SDK with the Safe address
      const protocolKitInstance = await Safe.init({ 
        provider: window.ethereum as any,
        signer: address,
        safeAddress: safeAddr
      });
      setProtocolKit(protocolKitInstance);

      console.log('Safe SDK initialized successfully');
      console.log('MultisigValidatorManager address:', multisigValidatorManagerAddr);
      console.log('Using transaction service URL:', txServiceUrl);

    } catch (err) {
      onError(`Failed to initialize Ash L1 Multisig: ${(err as Error).message}`);
      setUseMultisig(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const proposeTransaction = async () => {
    if (!protocolKit || !multisigValidatorManagerAddress || !safeAddress || !walletAddress) {
      onError('Safe SDK not initialized or addresses not found');
      return;
    }

    setIsProposing(true);
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      
      // Get the current nonce from the Safe contract
      const currentNonce = await protocolKit.getNonce();
      console.log('Current Safe nonce:', currentNonce);
      
      const contractInterface = new ethers.Interface(multisigValidatorManagerAbi.abi);
      const functionData = contractInterface.encodeFunctionData(functionName, args);
      
      const safeTransactionData: MetaTransactionData = {
        to: ethers.getAddress(multisigValidatorManagerAddress),
        data: functionData,
        value: "0",
        operation: 0
      };
      
      const safeTransaction = await protocolKit.createTransaction({
        transactions: [safeTransactionData],
        options: { 
          nonce: currentNonce, 
          safeTxGas: 0,
          baseGas: 0,
          gasPrice: 0,
          gasToken: "0x0000000000000000000000000000000000000000",
          refundReceiver: "0x0000000000000000000000000000000000000000"
        }
      });
      
      const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);
      const signature = await protocolKit.signHash(safeTxHash);
      
      console.log('Transaction hash:', safeTxHash);
      console.log('Signature:', signature.data);
      
      // Prepare the request body according to Safe API specification
      const requestBody = {
        to: ethers.getAddress(safeTransaction.data.to),
        value: safeTransaction.data.value,
        data: safeTransaction.data.data,
        operation: safeTransaction.data.operation,
        safeTxGas: safeTransaction.data.safeTxGas,
        baseGas: safeTransaction.data.baseGas,
        gasPrice: safeTransaction.data.gasPrice,
        gasToken: safeTransaction.data.gasToken,
        refundReceiver: safeTransaction.data.refundReceiver,
        nonce: Number(safeTransaction.data.nonce),
        contractTransactionHash: safeTxHash,
        sender: ethers.getAddress(walletAddress),
        signature: signature.data
      };
      
      console.log('Request body to be sent:', requestBody);
      
      // Propose transaction using our proxy API
      const proposeResponse = await fetch(`/api/safe/${network.chainId}/safes/${safeAddress}/multisig-transactions/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!proposeResponse.ok) {
        let errorData;
        try {
          errorData = await proposeResponse.json();
        } catch (jsonError) {
          // If response is not JSON, get text instead
          const errorText = await proposeResponse.text();
          console.error('Non-JSON error response:', errorText);
          throw new Error(`HTTP ${proposeResponse.status}: ${proposeResponse.statusText} - ${errorText}`);
        }
        console.error('Propose transaction error:', errorData);
        throw new Error(errorData.error || `HTTP ${proposeResponse.status}: Failed to propose transaction`);
      }
      
      let result;
      try {
        result = await proposeResponse.json();
      } catch (jsonError) {
        console.error('Failed to parse success response as JSON:', jsonError);
        throw new Error('Invalid response format from server');
      }
      console.log('Transaction proposed successfully:', result);
      
      onSuccess(safeTxHash);
    } catch (err) {
      console.error('Propose transaction error:', err);
      onError(`Failed to propose transaction: ${(err as Error).message}`);
    } finally {
      setIsProposing(false);
    }
  };

  // Show toggle and multisig interface
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-4 flex-1">
            <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <div className="flex-1 px-1">
              <p className="text-yellow-700 dark:text-yellow-300 font-medium text-sm leading-tight">
                Enable Ash Wallet if this ValidatorManager is owned by a MultisigValidatorManager
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
        </div>
      )}

      {!useMultisig && (
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
      )}
    </div>
  );
}; 