import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { AlertCircle, CheckCircle } from 'lucide-react';
import Safe from '@safe-global/protocol-kit';
import SafeApiKit from '@safe-global/api-kit';
import { ethers } from 'ethers';
import { MetaTransactionData } from '@safe-global/types-kit';
import validatorManagerAbi from '../../contracts/icm-contracts/compiled/ValidatorManager.json';
import multisigValidatorManagerAbi from '../../contracts/icm-contracts/compiled/MultisigValidatorManager.json';

interface MultisigOptionProps {
  isContractOwner: boolean | null;
  validatorManagerAddress: string;
  functionName: string;
  args: any[];
  onSuccess: (txHash: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export const MultisigOption: React.FC<MultisigOptionProps> = ({
  isContractOwner,
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
  const [apiKit, setApiKit] = useState<any>(null);
  const [walletAddress, setWalletAddress] = useState('');
  const [chainId, setChainId] = useState<number | null>(null);
  const [multisigValidatorManagerAddress, setMultisigValidatorManagerAddress] = useState('');
  const [safeAddress, setSafeAddress] = useState('');

  // Initialize when user chooses multisig
  useEffect(() => {
    if (useMultisig && !protocolKit) {
      initializeMultisig();
    }
  }, [useMultisig]);

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
      setChainId(Number(network.chainId));

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

      // Initialize Safe SDK with the Safe address
      const apiKitInstance = new SafeApiKit({ 
        chainId: BigInt(network.chainId) 
      });
      setApiKit(apiKitInstance);

      console.log('Initializing Safe SDK with Safe address:', safeAddr);
      console.log('MultisigValidatorManager address:', multisigValidatorManagerAddr);
      const protocolKitInstance = await Safe.init({ 
        provider: window.ethereum,
        signer: address,
        safeAddress: safeAddr
      });
      setProtocolKit(protocolKitInstance);

    } catch (err) {
      onError(`Failed to initialize multisig: ${(err as Error).message}`);
      setUseMultisig(false);
    } finally {
      setIsInitializing(false);
    }
  };

  const proposeTransaction = async () => {
    if (!protocolKit || !apiKit || !multisigValidatorManagerAddress || !safeAddress) {
      onError('Safe SDK not initialized or addresses not found');
      return;
    }

    setIsProposing(true);
    try {
      const contractInterface = new ethers.Interface(multisigValidatorManagerAbi.abi);
      const functionData = contractInterface.encodeFunctionData(functionName, args);
      
      const safeTransactionData: MetaTransactionData = {
        to: ethers.getAddress(multisigValidatorManagerAddress),
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
      
      await apiKit.proposeTransaction({
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
      });
      
      onSuccess(safeTxHash);
    } catch (err) {
      onError(`Failed to propose transaction: ${(err as Error).message}`);
    } finally {
      setIsProposing(false);
    }
  };

  // Show multisig option if not contract owner
  if (isContractOwner === false && !useMultisig) {
    return (
      <div className="space-y-3">
        <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 text-sm">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 text-yellow-500 mr-2 flex-shrink-0" />
            <span>You are not the owner of this contract.</span>
          </div>
        </div>
        <Button
          onClick={() => setUseMultisig(true)}
          variant="outline"
        >
          Multisig owner?
        </Button>
      </div>
    );
  }

  // Show multisig interface if user chose multisig
  if (useMultisig) {
    return (
      <div className="space-y-3">
        {protocolKit ? (
          <div className="p-3 rounded-md bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
              <span>Safe SDK initialized for multisig</span>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm">
            <span>{isInitializing ? 'Initializing Safe SDK...' : 'Ready to initialize Safe SDK'}</span>
          </div>
        )}
        
        <Button
          onClick={proposeTransaction}
          disabled={disabled || !protocolKit || isProposing}
          loading={isProposing}
          loadingText="Proposing to Safe..."
        >
          Propose to Safe Multisig
        </Button>
        
        <Button
          onClick={() => {
            setUseMultisig(false);
            setProtocolKit(null);
            setApiKit(null);
            setMultisigValidatorManagerAddress('');
            setSafeAddress('');
          }}
          variant="outline"
          size="sm"
        >
          Cancel Multisig
        </Button>
      </div>
    );
  }

  // Show normal interface if user is contract owner
  return <>{children}</>;
}; 