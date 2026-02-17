import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { Alert } from '@/components/toolbox/components/Alert';
import { decodeAbiParameters } from 'viem';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

interface SubmitPChainTxRegisterL1ValidatorProps {
  subnetIdL1: string;
  validatorBalance?: string;
  userPChainBalanceNavax?: bigint | null;
  blsProofOfPossession?: string;
  evmTxHash?: string;
  signingSubnetId: string;
  onSuccess: (pChainTxId: string) => void;
  onError: (message: string) => void;
}

const SubmitPChainTxRegisterL1Validator: React.FC<SubmitPChainTxRegisterL1ValidatorProps> = ({
  subnetIdL1,
  validatorBalance,
  userPChainBalanceNavax,
  blsProofOfPossession,
  evmTxHash,
  signingSubnetId,
  onSuccess,
  onError,
}) => {
  const { coreWalletClient, pChainAddress, publicClient, isTestnet } = useWalletStore();
  const walletType = useWalletStore((s) => s.walletType);
  const isCoreWallet = walletType === 'core';
  const { aggregateSignature } = useAvalancheSDKChainkit();
  const { notify } = useConsoleNotifications();
  const [evmTxHashState, setEvmTxHashState] = useState(evmTxHash || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);
  const [unsignedWarpMessage, setUnsignedWarpMessage] = useState<string | null>(null);
  const [signedWarpMessage, setSignedWarpMessage] = useState<string | null>(null);
  const [evmTxHashError, setEvmTxHashError] = useState<string | null>(null);
  const [manualPChainTxId, setManualPChainTxId] = useState('');

  useEffect(() => {
    if (evmTxHash && !evmTxHashState) {
      setEvmTxHashState(evmTxHash);
    }
  }, [evmTxHash, evmTxHashState]);

  const validateAndCleanTxHash = (hash: string): `0x${string}` | null => {
    if (!hash) return null;
    const cleanHash = hash.trim().toLowerCase();
    if (!cleanHash.startsWith('0x')) return null;
    if (cleanHash.length !== 66) return null;
    return cleanHash as `0x${string}`;
  };

  useEffect(() => {
    const extractWarpMessage = async () => {
      const validTxHash = validateAndCleanTxHash(evmTxHashState);
      if (!publicClient || !validTxHash) {
        setUnsignedWarpMessage(null);
        setSignedWarpMessage(null);
        return;
      }

      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: validTxHash });
        if (!receipt.logs || receipt.logs.length === 0) {
          throw new Error("Failed to get warp message from transaction receipt.");
        }

        let unsignedWarpMessage: string | null = null;
        const warpMessageTopic = "0x56600c567728a800c0aa927500f831cb451df66a7af570eb4df4dfbf4674887d";
        const warpPrecompileAddress = "0x0200000000000000000000000000000000000005";

        const warpEventLog = receipt.logs.find((log) => {
          return log && log.address && log.address.toLowerCase() === warpPrecompileAddress.toLowerCase() &&
            log.topics && log.topics[0] && log.topics[0].toLowerCase() === warpMessageTopic.toLowerCase();
        });

        if (warpEventLog && warpEventLog.data) {
          try {
            const [decodedMessage] = decodeAbiParameters(
              [{ type: 'bytes', name: 'message' }],
              warpEventLog.data as `0x${string}`
            );
            unsignedWarpMessage = decodedMessage as string;
          } catch {
            unsignedWarpMessage = warpEventLog.data;
          }
        } else {
          if (receipt.logs.length > 1 && receipt.logs[1].data) {
            try {
              const [decodedMessage] = decodeAbiParameters(
                [{ type: 'bytes', name: 'message' }],
                receipt.logs[1].data as `0x${string}`
              );
              unsignedWarpMessage = decodedMessage as string;
            } catch {
              unsignedWarpMessage = receipt.logs[1].data;
            }
          } else if (receipt.logs[0].data) {
            try {
              const [decodedMessage] = decodeAbiParameters(
                [{ type: 'bytes', name: 'message' }],
                receipt.logs[0].data as `0x${string}`
              );
              unsignedWarpMessage = decodedMessage as string;
            } catch {
              unsignedWarpMessage = receipt.logs[0].data;
            }
          }
        }

        if (!unsignedWarpMessage) {
          throw new Error("Could not extract warp message from transaction.");
        }

        setUnsignedWarpMessage(unsignedWarpMessage);
        setErrorState(null);
      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        setErrorState(`Failed to extract warp message: ${message}`);
        setUnsignedWarpMessage(null);
        setSignedWarpMessage(null);
      }
    };

    extractWarpMessage();
  }, [evmTxHashState, publicClient]);

  const handleSubmitPChainTx = async () => {
    setErrorState(null);
    setTxSuccess(null);

    if (isCoreWallet && !coreWalletClient) {
      setErrorState("Core wallet not found");
      return;
    }

    const evmTxValidation = !evmTxHashState.trim() ? "EVM transaction hash is required" : null;
    setEvmTxHashError(evmTxValidation);

    if (evmTxValidation) {
      setErrorState(evmTxValidation);
      onError(evmTxValidation);
      return;
    }

    if (!subnetIdL1) {
      setErrorState("L1 Subnet ID is required.");
      onError("L1 Subnet ID is required.");
      return;
    }

    if (!validatorBalance) {
      setErrorState("Validator balance is required.");
      onError("Validator balance is required.");
      return;
    }

    if (!blsProofOfPossession) {
      setErrorState("BLS Proof of Possession is required.");
      onError("BLS Proof of Possession is required.");
      return;
    }

    if (!unsignedWarpMessage) {
      setErrorState("Unsigned warp message not found. Check the transaction hash.");
      onError("Unsigned warp message not found.");
      return;
    }

    if (isCoreWallet && !pChainAddress) {
      setErrorState("P-Chain address is missing. Please connect your wallet.");
      onError("P-Chain address is missing.");
      return;
    }

    setIsProcessing(true);
    try {
      const aggregateSignaturePromise = aggregateSignature({
        message: unsignedWarpMessage,
        signingSubnetId: signingSubnetId || subnetIdL1,
        quorumPercentage: 67,
      });
      notify({
        type: 'local',
        name: 'Aggregate Signatures'
      }, aggregateSignaturePromise);
      const { signedMessage } = await aggregateSignaturePromise;

      setSignedWarpMessage(signedMessage);

      if (!isCoreWallet) {
        // Generic wallet: aggregation done, CLI command shown in render
        return;
      }

      const registerL1ValidatorPromise = coreWalletClient!.registerL1Validator({
        balance: validatorBalance.trim(),
        blsProofOfPossession: blsProofOfPossession.trim(),
        signedWarpMessage: signedMessage,
      });
      notify('registerL1Validator', registerL1ValidatorPromise);

      const pChainTxId = await registerL1ValidatorPromise;
      setTxSuccess(`P-Chain transaction successful! ID: ${pChainTxId}`);
      onSuccess(pChainTxId);
    } catch (err: any) {
      let message = err instanceof Error ? err.message : String(err);

      if (message.includes('User rejected')) {
        message = 'Transaction was rejected by user';
      } else if (message.includes('insufficient funds')) {
        message = 'Insufficient funds for transaction';
      } else if (message.includes('nonce')) {
        message = 'Transaction nonce error. Please try again.';
      }

      setErrorState(`P-Chain transaction failed: ${message}`);
      onError(`P-Chain transaction failed: ${message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTxHashChange = (value: string) => {
    setEvmTxHashState(value);
    setEvmTxHashError(null);
    setErrorState(null);
    setTxSuccess(null);
    setSignedWarpMessage(null);
    setManualPChainTxId('');
  };

  const handleContinueWithManualTxId = () => {
    if (!manualPChainTxId.trim()) {
      setErrorState("P-Chain transaction ID is required");
      return;
    }
    setTxSuccess(`P-Chain transaction submitted! ID: ${manualPChainTxId}`);
    onSuccess(manualPChainTxId);
  };

  const generateCLICommand = () => {
    if (!signedWarpMessage) return '';
    const nodeUrl = isTestnet
      ? 'https://api.avax-test.network'
      : 'https://api.avax.network';
    return [
      `avalanche contract registerL1Validator \\`,
      `  --node-url ${nodeUrl} \\`,
      `  --signed-warp-message "${signedWarpMessage}" \\`,
      `  --balance ${validatorBalance || '<BALANCE_AVAX>'} \\`,
      `  --bls-proof-of-possession "${blsProofOfPossession || '<BLS_PROOF>'}"`,
    ].join('\n');
  };

  if (!subnetIdL1) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        Please select an L1 subnet first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        label="initiateValidatorRegistration Transaction Hash"
        value={evmTxHashState}
        onChange={handleTxHashChange}
        placeholder="Enter the transaction hash from step 4 (0x...)"
        disabled={isProcessing || txSuccess !== null}
        error={evmTxHashError}
      />

      {(validatorBalance || blsProofOfPossession) && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 space-y-3">
          {validatorBalance && (
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Initial Balance</span>
              <span className="text-sm font-mono text-zinc-800 dark:text-zinc-200">{validatorBalance} AVAX</span>
            </div>
          )}
          {userPChainBalanceNavax && validatorBalance && BigInt(Number(validatorBalance) * 1e9) > userPChainBalanceNavax && (
            <p className="text-xs text-red-600 dark:text-red-400">
              Exceeds P-Chain balance ({(Number(userPChainBalanceNavax) / 1e9).toFixed(2)} AVAX)
            </p>
          )}
          {blsProofOfPossession && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">BLS Proof of Possession</span>
              <div className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 rounded border border-zinc-200 dark:border-zinc-700/50 px-3 py-2 break-all">
                {blsProofOfPossession}
              </div>
            </div>
          )}
        </div>
      )}

      <Button
        onClick={handleSubmitPChainTx}
        disabled={isProcessing || !evmTxHashState.trim() || !validatorBalance || !blsProofOfPossession || !unsignedWarpMessage || txSuccess !== null || (!!signedWarpMessage && !isCoreWallet)}
      >
        {isProcessing ? 'Processing...' : (isCoreWallet ? 'Sign & Submit to P-Chain' : 'Aggregate Signatures')}
      </Button>

      {!isCoreWallet && signedWarpMessage && !txSuccess && (
        <div className="space-y-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Signatures aggregated successfully. Run this command to submit the P-Chain transaction:
            </p>
          </div>
          <DynamicCodeBlock lang="bash" code={generateCLICommand()} />
          <Input
            label="P-Chain Transaction ID"
            value={manualPChainTxId}
            onChange={setManualPChainTxId}
            placeholder="Paste the P-Chain transaction ID after running the command above"
          />
          <Button
            onClick={handleContinueWithManualTxId}
            disabled={!manualPChainTxId.trim()}
          >
            Continue with P-Chain TX ID
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="error">{error}</Alert>
      )}

      {txSuccess && (
        <Success
          label="Transaction Hash"
          value={txSuccess.replace('P-Chain transaction successful! ID: ', '')}
        />
      )}
    </div>
  );
};

export default SubmitPChainTxRegisterL1Validator;
