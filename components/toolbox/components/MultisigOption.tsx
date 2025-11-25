import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { MultisigInfo } from './MultisigInfo';
import { AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import Safe from '@safe-global/protocol-kit';
import { encodeFunctionData, getAddress } from 'viem';
import { MetaTransactionData } from '@safe-global/types-kit';
import validatorManagerAbi from '../../../contracts/icm-contracts/compiled/ValidatorManager.json';
import poaManagerAbi from '../../../contracts/icm-contracts/compiled/PoAManager.json';
import { useWalletStore } from '../stores/walletStore';
import { useViemChainStore } from '../stores/toolboxStore';
import { useSafeAPI, SafeInfo, NonceResponse, AshWalletUrlResponse } from '../hooks/useSafeAPI';



interface MultisigOptionProps {
  validatorManagerAddress: string;
  functionName: string;
  args: any[];
  onSuccess: (message: string) => void;
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
 * - Automatically detects if PoAManager is owned by a multisig
 * - If user is the owner: Shows direct transaction button
 * - If multisig-owned: Automatically initializes Ash Wallet and shows proposal interface
 * - No manual toggle required - multisig is detected and initialized automatically
 * 
 * Requirements:
 * - ValidatorManager contract must have PoAManager as owner
 * - PoAManager must have Safe contract as owner (for multisig)
 * - Current wallet must be a signer of the Safe contract (for multisig)
 * - Chain must be supported by Safe Transaction Service
 * 
 * @param validatorManagerAddress - Address of the ValidatorManager contract
 * @param functionName - Function name to call on PoAManager (e.g., "completeValidatorRegistration")
 * @param args - Arguments array to pass to the function
 * @param onSuccess - Callback when transaction/proposal succeeds, receives transaction hash or success message
 * @param onError - Callback when error occurs, receives error message
 * @param disabled - Whether the action should be disabled
 * @param children - Content to render for direct transaction (when user is the owner)
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
  const [isInitializing, setIsInitializing] = useState(false);
  const [isProposing, setIsProposing] = useState(false);
  const [isExecutingDirect, setIsExecutingDirect] = useState(false);
  const [protocolKit, setProtocolKit] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [poaManagerAddress, setPoaManagerAddress] = useState('');
  const [safeAddress, setSafeAddress] = useState('');
  const [safeInfo, setSafeInfo] = useState<SafeInfo | null>(null);
  const [isPoaOwner, setIsPoaOwner] = useState<boolean | null>(null);
  const [isCheckingOwnership, setIsCheckingOwnership] = useState(false);
  const [chainId, setChainId] = useState<string>('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [ashWalletUrl, setAshWalletUrl] = useState('');

  const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { callSafeAPI } = useSafeAPI();

  // Check wallet connection and ownership on mount
  useEffect(() => {
    checkWalletAndOwnership();
  }, [validatorManagerAddress]);

  // Automatically initialize multisig when PoAManager is owned by a multisig
  useEffect(() => {
    if (isPoaOwner === false && !protocolKit && safeAddress) {
      initializeMultisig();
    }
  }, [isPoaOwner, safeAddress]);

  const checkWalletAndOwnership = async () => {
    setIsCheckingOwnership(true);
    try {
      if (!coreWalletClient?.account) {
        setIsPoaOwner(false);
        return;
      }

      // Get current wallet address
      const address = walletEVMAddress;
      setWalletAddress(address);

      // Get PoAManager address by calling owner() on ValidatorManager
      const poaManagerAddr = await publicClient.readContract({
        address: validatorManagerAddress as `0x${string}`,
        abi: validatorManagerAbi.abi,
        functionName: 'owner',
      });
      setPoaManagerAddress(poaManagerAddr as string);

      // Get owner of PoAManager
      const poaOwner = await publicClient.readContract({
        address: poaManagerAddr as `0x${string}`,
        abi: poaManagerAbi.abi,
        functionName: 'owner',
      });

      // Check if current wallet is the owner of PoAManager
      const isOwner = (poaOwner as string).toLowerCase() === address.toLowerCase();
      setIsPoaOwner(isOwner);

      // If not the owner, get the Safe address for potential multisig
      if (!isOwner) {
        setSafeAddress(poaOwner as string);
      }

    } catch (err) {
      console.error('Failed to check ownership:', err);
      setIsPoaOwner(false);
    } finally {
      setIsCheckingOwnership(false);
    }
  };

  // Get chain ID helper
  const getChainId = (): string => {
    return viemChain?.id.toString() || '1';
  };

  const initializeMultisig = async () => {
    setIsInitializing(true);
    try {
      if (!coreWalletClient?.account) {
        throw new Error('Wallet not connected');
      }

      if (!poaManagerAddress || !safeAddress) {
        throw new Error('PoAManager or Safe address not determined');
      }

      const address = walletEVMAddress;
      const currentChainId = getChainId();
      setChainId(currentChainId);

      // Get Safe info from backend API
      try {
        const safeInfo = await callSafeAPI<SafeInfo>('getSafeInfo', {
          chainId: currentChainId,
          safeAddress: safeAddress
        });

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

      // Try to initialize Safe Protocol Kit normally first
      let protocolKitInstance;
      try {
        protocolKitInstance = await Safe.init({
          provider: window.ethereum! as any,
          signer: address,
          safeAddress: safeAddress
        });
      } catch (error) {
        // If initialization fails due to missing MultiSend addresses, retry with hardcoded deterministic addresses
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('multiSend') || errorMessage.includes('MultiSend')) {
          console.log('MultiSend addresses not found in Safe SDK, using hardcoded deterministic addresses...');
          
          // Hardcoded deterministic Safe contract addresses for Avalanche L1s
          // These are deployed via CREATE2 and have the same addresses across all chains for 1.3 deployments (What Ash Wallet uses)
          // ideally they are included in safe v1.3 deployments https://github.com/safe-global/safe-deployments/blob/main/src/assets/v1.3.0/multi_send.json
          protocolKitInstance = await Safe.init({
            provider: window.ethereum! as any,
            signer: address,
            safeAddress: safeAddress,
            contractNetworks: {
              [currentChainId]: {
                multiSendAddress: '0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761',
                multiSendCallOnlyAddress: '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D',
              }
            }
          });
        } else {
          // If it's a different error, rethrow it
          throw error;
        }
      }

      setProtocolKit(protocolKitInstance);

    } catch (err) {
      onError(`Failed to initialize Ash L1 Multisig: ${(err as Error).message}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const proposeTransaction = async () => {
    if (!protocolKit || !poaManagerAddress || !safeAddress || !chainId) {
      onError('Safe SDK not initialized or addresses not found');
      return;
    }

    setIsProposing(true);
    try {
      const functionData = encodeFunctionData({
        abi: poaManagerAbi.abi,
        functionName: functionName,
        args: args,
      });

      const safeTransactionData: MetaTransactionData = {
        to: getAddress(poaManagerAddress),
        data: functionData,
        value: "0",
        operation: 0
      };

      // Get next nonce from backend API
      const nonceData = await callSafeAPI<NonceResponse>('getNextNonce', {
        chainId: chainId,
        safeAddress: safeAddress
      });
      const nonceNumber = nonceData.nonce;

      const safeTransaction = await protocolKit.createTransaction({
        transactions: [safeTransactionData],
        options: { nonce: nonceNumber, safeTxGas: 0 }
      });

      const safeTxHash = await protocolKit.getTransactionHash(safeTransaction);

      // Sign the transaction using Safe Protocol Kit's method
      const signedSafeTransaction = await protocolKit.signTransaction(safeTransaction);

      // Extract the signature from the signed transaction
      const signature = signedSafeTransaction.signatures.get(walletAddress.toLowerCase())?.data || '';

      const proposalData = {
        safeAddress: getAddress(safeAddress),
        safeTransactionData: {
          ...safeTransaction.data,
          to: getAddress(safeTransaction.data.to),
          nonce: Number(safeTransaction.data.nonce),
        },
        safeTxHash,
        senderAddress: getAddress(walletAddress),
        senderSignature: signature,
        origin: 'Avalanche Toolbox'
      };

      // Propose transaction via backend API using Safe API Kit directly
      await callSafeAPI('proposeTransaction', {
        chainId: chainId,
        safeAddress: safeAddress,
        proposalData: proposalData
      });

      // Get Ash Wallet URL from backend API
      const ashWalletResponse = await callSafeAPI<AshWalletUrlResponse>('getAshWalletUrl', {
        chainId: chainId,
        safeAddress: safeAddress
      });

      // Show success UI directly in the component
      setShowSuccessMessage(true);
      setAshWalletUrl(ashWalletResponse.url);

      // Note: We don't call onSuccess here because there's no actual transaction hash yet
      // The transaction is only proposed, not executed. Users will get the tx hash
      // after it's been approved and executed in Ash Wallet.
    } catch (err) {
      onError(`Failed to propose transaction: ${(err as Error).message}`);
    } finally {
      setIsProposing(false);
    }
  };

  const executeDirectTransaction = async () => {
    if (!coreWalletClient) {
      onError('Core wallet not found');
      return;
    }


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
        hash: txHash as `0x${string}`,
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
        <div className="space-y-3">
          <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center space-x-3">
              <img
                src="/images/ash.png"
                alt="Ash Wallet"
                className="h-5 w-5 flex-shrink-0"
              />
              <p className="text-blue-700 dark:text-blue-300 font-medium text-sm">
                This PoAManager is owned by an Ash L1 Multisig. Transactions will be proposed to the multisig for approval.
              </p>
            </div>
          </div>

          {isInitializing && (
            <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-base">
              <div className="flex items-center justify-center">
                <img
                  src="/images/ash.png"
                  alt="Ash"
                  className="h-6 w-6 mr-3 flex-shrink-0"
                />
                <span>Initializing Ash Wallet multisig...</span>
              </div>
            </div>
          )}

          {safeInfo && (
            <MultisigInfo safeInfo={safeInfo} walletAddress={walletAddress} />
          )}

          {showSuccessMessage ? (
            <div className="p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>

                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Transaction Proposed Successfully
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Your transaction has been submitted to the multisig. Review and approve it in Ash Wallet to complete the process.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Next steps:</p>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4 list-disc">
                      <li>Review and approve the transaction</li>
                      <li>Wait for additional approvals if required</li>
                      <li>Copy the transaction hash once executed</li>
                    </ul>
                  </div>

                  <Button
                    onClick={() => window.open(ashWalletUrl, '_blank')}
                    className="inline-flex items-center space-x-2"
                  >
                    <img
                      src="/images/ash.png"
                      alt="Ash"
                      className="h-4 w-4 flex-shrink-0"
                    />
                    <span>Open Ash Wallet</span>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              onClick={proposeTransaction}
              disabled={disabled || !protocolKit || isProposing}
              loading={isProposing}
              loadingText="Proposing to Ash Wallet..."
            >
              Propose Transaction to Ash Wallet
            </Button>
          )}
        </div>
      )}
    </div>
  );
}; 
